import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  EMBEDDED_TURNS_PER_HOUR,
  enforceTurnQuota,
  logBillableCall,
} from "./quota.ts"

// ---------- fake Supabase for ai_generation_log ----------
//
// quota.ts only ever queries `ai_generation_log` and inserts into the same
// table. We mimic the chain shape it needs and record every call so the test
// asserts on observable behavior (was the right window queried? was the
// right row inserted?) rather than internal call shapes.

interface LoggedRow {
  user_id: string
  source: string
  created_at: string
}

interface FakeOptions {
  rows?: LoggedRow[]
  insertError?: { message?: string } | null
}

interface FakeClient {
  client: {
    from(table: string): {
      select(columns: string): {
        eq(col: string, val: unknown): {
          eq(col: string, val: unknown): {
            gte(col: string, val: string): Promise<{ data: LoggedRow[]; error: null }>
          }
        }
      }
      insert(values: Record<string, unknown>): Promise<{ error: { message?: string } | null }>
    }
  }
  inserts: Array<Record<string, unknown>>
  selects: Array<{
    table: string
    columns: string
    filters: Record<string, unknown>
    gteFilter?: { column: string; value: string }
  }>
}

function makeFake({ rows = [], insertError = null }: FakeOptions = {}): FakeClient {
  const inserts: Array<Record<string, unknown>> = []
  const selects: FakeClient["selects"] = []

  const client = {
    from(table: string) {
      return {
        select(columns: string) {
          const filters: Record<string, unknown> = {}
          return {
            eq(col1: string, val1: unknown) {
              filters[col1] = val1
              return {
                eq(col2: string, val2: unknown) {
                  filters[col2] = val2
                  return {
                    gte: async (col: string, val: string) => {
                      selects.push({
                        table,
                        columns,
                        filters: { ...filters },
                        gteFilter: { column: col, value: val },
                      })
                      const cutoffMs = new Date(val).getTime()
                      const matching = rows.filter((r) =>
                        r.user_id === filters.user_id &&
                        r.source === filters.source &&
                        new Date(r.created_at).getTime() >= cutoffMs
                      )
                      return { data: matching, error: null }
                    },
                  }
                },
              }
            },
          }
        },
        insert: async (values: Record<string, unknown>) => {
          inserts.push(values)
          return { error: insertError }
        },
      }
    },
  }

  return { client, inserts, selects }
}

// ---------- enforceTurnQuota ----------

Deno.test("enforceTurnQuota allows the call when no embedded_chat rows exist", async () => {
  const { client } = makeFake({ rows: [] })

  const result = await enforceTurnQuota(client, "user-1")

  assertEquals(result.allowed, true)
  assertEquals(result.used, 0)
  assertEquals(result.limit, EMBEDDED_TURNS_PER_HOUR)
})

Deno.test("enforceTurnQuota blocks the call when the user is at the hourly cap", async () => {
  const now = new Date("2026-05-08T12:00:00Z").getTime()
  const recent = (offsetMs: number): LoggedRow => ({
    user_id: "user-1",
    source: "embedded_chat",
    created_at: new Date(now - offsetMs).toISOString(),
  })
  const rows = Array.from({ length: EMBEDDED_TURNS_PER_HOUR }, (_, i) => recent(i * 60 * 1000))
  const { client } = makeFake({ rows })

  const result = await enforceTurnQuota(client, "user-1", now)

  assertEquals(result.allowed, false)
  assertEquals(result.used, EMBEDDED_TURNS_PER_HOUR)
})

Deno.test("enforceTurnQuota only counts rows within the trailing 1h window", async () => {
  const now = new Date("2026-05-08T12:00:00Z").getTime()
  const justInside = new Date(now - 59 * 60 * 1000).toISOString()
  const justOutside = new Date(now - 61 * 60 * 1000).toISOString()
  const rows: LoggedRow[] = [
    { user_id: "user-1", source: "embedded_chat", created_at: justInside },
    { user_id: "user-1", source: "embedded_chat", created_at: justOutside },
  ]
  const { client } = makeFake({ rows })

  const result = await enforceTurnQuota(client, "user-1", now)

  assertEquals(result.used, 1)
  assertEquals(result.allowed, true)
})

Deno.test("enforceTurnQuota does not count rows from other sources (e.g. program, embedded_draft)", async () => {
  const now = new Date("2026-05-08T12:00:00Z").getTime()
  const rows: LoggedRow[] = [
    { user_id: "user-1", source: "program", created_at: new Date(now - 1000).toISOString() },
    { user_id: "user-1", source: "embedded_draft", created_at: new Date(now - 1000).toISOString() },
    { user_id: "user-1", source: "embedded_chat", created_at: new Date(now - 1000).toISOString() },
  ]
  const { client } = makeFake({ rows })

  const result = await enforceTurnQuota(client, "user-1", now)

  assertEquals(result.used, 1)
})

// ---------- logBillableCall ----------

Deno.test("logBillableCall inserts a single ai_generation_log row tagged with the source", async () => {
  const { client, inserts } = makeFake()

  await logBillableCall(client, "user-1", "embedded_chat")

  assertEquals(inserts.length, 1)
  assertEquals(inserts[0].user_id, "user-1")
  assertEquals(inserts[0].source, "embedded_chat")
})

Deno.test("logBillableCall surfaces insert errors so the caller can decide what to do", async () => {
  const { client } = makeFake({ insertError: { message: "rls denied" } })

  let caught: Error | null = null
  try {
    await logBillableCall(client, "user-1", "embedded_chat")
  } catch (e) {
    caught = e as Error
  }

  assertEquals(caught?.message.includes("rls denied"), true)
})
