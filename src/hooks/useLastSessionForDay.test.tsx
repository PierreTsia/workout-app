import { describe, it, expect, vi, beforeEach } from "vitest"
import { waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { useLastSessionForDay } from "./useLastSessionForDay"
import { supabase } from "@/lib/supabase"

const maybeSingle = vi.fn()

const sessionsChain = {
  select: vi.fn(function select() {
    return sessionsChain
  }),
  eq: vi.fn(function eq() {
    return sessionsChain
  }),
  not: vi.fn(function notCol() {
    return sessionsChain
  }),
  order: vi.fn(function order() {
    return sessionsChain
  }),
  limit: vi.fn(function limit() {
    return sessionsChain
  }),
  maybeSingle,
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => sessionsChain),
  },
}))

describe("useLastSessionForDay", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    maybeSingle.mockResolvedValue({ data: null, error: null })
  })

  it("does not run the query when dayId is null", () => {
    const { result } = renderHookWithProviders(() => useLastSessionForDay(null))
    expect(result.current.fetchStatus).toBe("idle")
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("resolves to null when maybeSingle returns no row (no PGRST116 / .single() path)", async () => {
    const { result } = renderHookWithProviders(() =>
      useLastSessionForDay("day-1"),
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
    expect(maybeSingle).toHaveBeenCalledTimes(1)
  })

  it("returns session data when maybeSingle returns a row", async () => {
    const row = {
      id: "sess-1",
      started_at: "2026-01-01T10:00:00Z",
      finished_at: "2026-01-01T11:00:00Z",
      active_duration_ms: 3600000,
      total_sets_done: 12,
      has_skipped_sets: false,
    }
    maybeSingle.mockResolvedValue({ data: row, error: null })

    const { result } = renderHookWithProviders(() =>
      useLastSessionForDay("day-1"),
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(row)
  })
})
