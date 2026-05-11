import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  checkQuota,
  QUOTA_REGULAR_BY_SOURCE,
  type AIGenerationSource,
} from "./aiQuota.ts"

// Type-level guard: the union must accept every source allowed by the
// `chk_ai_generation_log_source` CHECK constraint. Type-check failure here
// means the latest migration and the TS contract have drifted.
Deno.test("AIGenerationSource union accepts all five sources (program, workout, embedded_chat, embedded_draft, quick_workout)", () => {
  const sources: AIGenerationSource[] = [
    "program",
    "workout",
    "embedded_chat",
    "embedded_draft",
    "quick_workout",
  ]
  if (new Set(sources).size !== sources.length) {
    throw new Error("duplicate sources in union sample")
  }
})

// Documents the canonical caps so any future change goes through this test
// (and the people who read it). The map MUST be exhaustive over
// AIGenerationSource — Record<AIGenerationSource, number> already enforces
// that at the type level; this assertion locks in the *values*.
Deno.test("QUOTA_REGULAR_BY_SOURCE locks the canonical caps per source", () => {
  assertEquals(QUOTA_REGULAR_BY_SOURCE.program, 5)
  assertEquals(QUOTA_REGULAR_BY_SOURCE.workout, 5)
  assertEquals(QUOTA_REGULAR_BY_SOURCE.quick_workout, 10)
  assertEquals(QUOTA_REGULAR_BY_SOURCE.embedded_chat, 40)
  assertEquals(QUOTA_REGULAR_BY_SOURCE.embedded_draft, 3)
})

// ---------------------------------------------------------------------------
// Behavioral tests for `checkQuota` — minimal in-memory Supabase chain
// recorder. Tracks the (table, source, count) shape we actually invoke, and
// returns hard-coded counts so the cap arithmetic is the only variable.
// ---------------------------------------------------------------------------

interface MockOpts {
  count: number
  whitelisted?: boolean
  whitelistedRecentCount?: number
}

// Structural type covering the only methods checkQuota exercises. The
// "real" supabase client returns much wider builders per call; here we
// describe just the chains we care about and cast through `unknown` at
// the boundary.
interface CountBuilder {
  select(columns: string, opts?: { count?: "exact"; head?: boolean }): CountBuilder
  eq(column: string, value: unknown): CountBuilder
  gte(column: string, value: string): Promise<{ count: number; error: null }>
}

interface WhitelistBuilder {
  select(columns: string): {
    eq(column: string, value: unknown): {
      maybeSingle(): Promise<{ data: { email: string } | null; error: null }>
    }
  }
}

interface MockSupabase {
  from(table: string): CountBuilder | WhitelistBuilder
}

type ServiceClientArg = Parameters<typeof checkQuota>[0]

function makeMock(opts: MockOpts): ServiceClientArg {
  let invocation = 0
  const mock: MockSupabase = {
    from(table: string): CountBuilder | WhitelistBuilder {
      if (table === "ai_whitelisted_users") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: opts.whitelisted ? { email: "x@y" } : null,
                  error: null,
                }),
            }),
          }),
        }
      }
      // ai_generation_log — the chain ends on `.gte()` returning a thenable
      // count. checkQuota issues two separate chains for whitelisted users
      // (regular window + 24h window). The second invocation returns
      // `whitelistedRecentCount` if provided.
      const builder: CountBuilder = {
        select: () => builder,
        eq: () => builder,
        gte: () => {
          invocation += 1
          const c = invocation === 1 ? opts.count : (opts.whitelistedRecentCount ?? 0)
          return Promise.resolve({ count: c, error: null })
        },
      }
      return builder
    },
  }
  return mock as unknown as ServiceClientArg
}

Deno.test("checkQuota allows the 10th quick_workout call but denies the 11th", async () => {
  const mockUnder = makeMock({ count: 9 })
  const under = await checkQuota(mockUnder, "user-1", null, "quick_workout")
  assertEquals(under.allowed, true, "9 prior rows → 10th call must be allowed")

  const mockAt = makeMock({ count: 10 })
  const at = await checkQuota(mockAt, "user-1", null, "quick_workout")
  assertEquals(at.allowed, false, "10 prior rows → 11th call must be denied (cap = 10)")
})

Deno.test("checkQuota preserves the 5/30 cap for `program` (regression)", async () => {
  const mockUnder = makeMock({ count: 4 })
  const under = await checkQuota(mockUnder, "user-1", null, "program")
  assertEquals(under.allowed, true)

  const mockAt = makeMock({ count: 5 })
  const at = await checkQuota(mockAt, "user-1", null, "program")
  assertEquals(at.allowed, false, "program cap stays at 5/30 — generate-program contract preserved")
})

Deno.test("checkQuota preserves the 5/30 cap for `workout` (regression — legacy generate-workout)", async () => {
  const mockUnder = makeMock({ count: 4 })
  const under = await checkQuota(mockUnder, "user-1", null, "workout")
  assertEquals(under.allowed, true)

  const mockAt = makeMock({ count: 5 })
  const at = await checkQuota(mockAt, "user-1", null, "workout")
  assertEquals(at.allowed, false)
})

Deno.test("checkQuota whitelisted path uses 5/24h regardless of source", async () => {
  // Whitelist short-circuit: cap stays QUOTA_WHITELISTED (5) over a 24h
  // window — independent of which source the caller is asking about.
  const mock = makeMock({ count: 99, whitelisted: true, whitelistedRecentCount: 4 })
  const under = await checkQuota(mock, "user-1", "vip@gymlogic.app", "quick_workout")
  assertEquals(under.allowed, true)

  const mockAt = makeMock({ count: 99, whitelisted: true, whitelistedRecentCount: 5 })
  const at = await checkQuota(mockAt, "user-1", "vip@gymlogic.app", "quick_workout")
  assertEquals(at.allowed, false)
})
