import { describe, it, expect, vi, beforeEach } from "vitest"
import { resolveOrCreateActiveCycle } from "./cycle"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

type SelectResult = { data: { id: string } | null; error: null | { message: string; code?: string } }
type InsertResult = { data: { id: string } | null; error: null | { message: string; code?: string } }

/**
 * Builds a mock supabase client that services:
 *  - `.from("cycles").select("id").eq(...).eq(...).is(...).maybeSingle()` (lookup)
 *  - `.from("cycles").insert(...).select("id").single()` (create)
 *
 * `selectResponses` is a queue — each call pops the next one. Lets us assert
 * behavior across the pre-insert lookup and the post-failure adoption re-query.
 */
function mockSupabaseCycleCalls(opts: {
  selectResponses: Array<SelectResult | (() => Promise<SelectResult>) | (() => SelectResult)>
  insertResult?: InsertResult | (() => Promise<InsertResult>) | (() => InsertResult) | Error
}) {
  const selectQueue = [...opts.selectResponses]

  const selectChain = () => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              const next = selectQueue.shift()
              if (!next) throw new Error("No more mocked select responses")
              return typeof next === "function" ? await next() : next
            }),
          })),
        })),
      })),
    })),
  })

  const insertChain = () => ({
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => {
          const r = opts.insertResult
          if (r instanceof Error) throw r
          if (typeof r === "function") return await r()
          return r ?? { data: null, error: { message: "no insert configured" } }
        }),
      })),
    })),
  })

  vi.mocked(supabase.from).mockImplementation(
    () =>
      ({
        ...selectChain(),
        ...insertChain(),
      }) as never,
  )
}

describe("resolveOrCreateActiveCycle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns existing cycle without inserting when one is already open", async () => {
    mockSupabaseCycleCalls({
      selectResponses: [{ data: { id: "existing-cycle-1" }, error: null }],
      insertResult: { data: null, error: { message: "should not be called" } },
    })

    const result = await resolveOrCreateActiveCycle("prog-1", "user-1")

    expect(result).toEqual({
      kind: "ok",
      cycleId: "existing-cycle-1",
      source: "existing",
    })
  })

  it("creates a new cycle when none exists", async () => {
    mockSupabaseCycleCalls({
      selectResponses: [{ data: null, error: null }],
      insertResult: { data: { id: "new-cycle-1" }, error: null },
    })

    const result = await resolveOrCreateActiveCycle("prog-1", "user-1")

    expect(result).toEqual({
      kind: "ok",
      cycleId: "new-cycle-1",
      source: "created",
    })
  })

  it("adopts an orphan cycle when insert fails with 23505 (unique constraint race)", async () => {
    mockSupabaseCycleCalls({
      selectResponses: [
        { data: null, error: null },
        { data: { id: "orphan-cycle-1" }, error: null },
      ],
      insertResult: {
        data: null,
        error: { message: "duplicate key", code: "23505" },
      },
    })

    const result = await resolveOrCreateActiveCycle("prog-1", "user-1")

    expect(result).toEqual({
      kind: "ok",
      cycleId: "orphan-cycle-1",
      source: "adopted",
    })
  })

  it("adopts an orphan cycle when insert throws mid-flight (request committed, response dropped)", async () => {
    mockSupabaseCycleCalls({
      selectResponses: [
        { data: null, error: null },
        { data: { id: "orphan-cycle-2" }, error: null },
      ],
      insertResult: new Error("NetworkError when attempting to fetch resource"),
    })

    const result = await resolveOrCreateActiveCycle("prog-1", "user-1")

    expect(result).toEqual({
      kind: "ok",
      cycleId: "orphan-cycle-2",
      source: "adopted",
    })
  })

  it("returns unavailable with the thrown error's message when offline (insert throws AND no orphan)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mockSupabaseCycleCalls({
      selectResponses: [
        { data: null, error: null },
        { data: null, error: null },
      ],
      insertResult: new Error("Failed to fetch"),
    })

    const result = await resolveOrCreateActiveCycle("prog-1", "user-1")

    expect(result).toEqual({ kind: "unavailable", reason: "Failed to fetch" })
    expect(warn).toHaveBeenCalledWith(
      "[cycle:insert] threw",
      expect.any(Error),
    )
    warn.mockRestore()
  })

  it("returns unavailable with the supabase error message for non-race insert failures (e.g. RLS)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mockSupabaseCycleCalls({
      selectResponses: [
        { data: null, error: null },
        { data: null, error: null },
      ],
      insertResult: {
        data: null,
        error: { message: "new row violates row-level security policy", code: "42501" },
      },
    })

    const result = await resolveOrCreateActiveCycle("prog-1", "user-1")

    expect(result).toEqual({
      kind: "unavailable",
      reason: "new row violates row-level security policy",
    })
    expect(warn).toHaveBeenCalledWith(
      "[cycle:insert] failed",
      expect.objectContaining({ code: "42501" }),
    )
    warn.mockRestore()
  })

  it("swallows a throw during the initial lookup and still creates a cycle", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mockSupabaseCycleCalls({
      selectResponses: [
        async () => {
          throw new Error("transient read failure")
        },
        { data: null, error: null },
      ],
      insertResult: { data: { id: "new-after-read-fail" }, error: null },
    })

    const result = await resolveOrCreateActiveCycle("prog-1", "user-1")

    expect(result).toEqual({
      kind: "ok",
      cycleId: "new-after-read-fail",
      source: "created",
    })
    expect(warn).toHaveBeenCalledWith(
      "[cycle:lookup] select threw",
      expect.any(Error),
    )
    warn.mockRestore()
  })

  it("falls back to lookup-stage error message when insert didn't run (no insertError recorded)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    mockSupabaseCycleCalls({
      selectResponses: [
        { data: null, error: { message: "initial lookup soft-failed" } },
        { data: null, error: { message: "recheck also soft-failed" } },
      ],
      insertResult: new Error("insert blew up too"),
    })

    const result = await resolveOrCreateActiveCycle("prog-1", "user-1")

    // insertError takes priority over lookup/recheck errors when present
    expect(result).toEqual({
      kind: "unavailable",
      reason: "insert blew up too",
    })
  })
})
