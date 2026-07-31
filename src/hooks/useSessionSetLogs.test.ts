import { vi, describe, it, expect, beforeEach } from "vitest"
import { waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { useSessionSetLogs } from "./useSessionSetLogs"

const spies = vi.hoisted(() => ({
  select: vi.fn(),
  order: vi.fn(),
}))

vi.mock("@/lib/supabase", () => {
  const chain = {
    select: (arg: string) => {
      spies.select(arg)
      return chain
    },
    eq: () => chain,
    order: (arg: string) => {
      spies.order(arg)
      return chain
    },
    then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
      resolve({ data: [], error: null }),
  }
  return { supabase: { from: () => chain } }
})

describe("useSessionSetLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("orders chronologically, not on the frozen name", async () => {
    const { result } = renderHookWithProviders(() => useSessionSetLogs("sess-1"))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // The snapshot is a frozen French name: ordering on it made a session read
    // in a different order depending on the reader's language.
    expect(spies.order.mock.calls.map(([column]) => column)).toEqual([
      "logged_at",
      "set_number",
    ])
  })

  it("embeds the catalog row so labels resolve at render", async () => {
    const { result } = renderHookWithProviders(() => useSessionSetLogs("sess-1"))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(spies.select).toHaveBeenCalledWith(
      expect.stringContaining("exercise:exercises("),
    )
  })

  it("stays idle without a session", () => {
    const { result } = renderHookWithProviders(() => useSessionSetLogs(null))

    expect(result.current.fetchStatus).toBe("idle")
    expect(spies.select).not.toHaveBeenCalled()
  })
})
