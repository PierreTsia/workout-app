import { vi, describe, it, expect, beforeEach } from "vitest"
import { act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import * as cycleLib from "@/lib/cycle"
import { useAbandonAndRestartCycle } from "./useAbandonAndRestartCycle"

const mockUpdateEqUser = vi.fn()
const mockUpdateEqId = vi.fn(() => ({ eq: mockUpdateEqUser }))
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEqId }))

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({ update: mockUpdate })),
  },
}))

vi.mock("@/lib/cycle", async () => {
  const actual = await vi.importActual<typeof import("@/lib/cycle")>(
    "@/lib/cycle",
  )
  return {
    ...actual,
    resolveOrCreateActiveCycle: vi.fn(),
  }
})

const ARGS = {
  cycleId: "cycle-old",
  programId: "prog-1",
  userId: "user-1",
}

function setup() {
  return renderHookWithProviders(() => useAbandonAndRestartCycle())
}

describe("useAbandonAndRestartCycle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("closes the active cycle scoped by id+user then resolves a new one and returns its id", async () => {
    mockUpdateEqUser.mockResolvedValueOnce({ error: null })
    vi.mocked(cycleLib.resolveOrCreateActiveCycle).mockResolvedValueOnce({
      kind: "ok",
      cycleId: "cycle-new",
      source: "created",
    })

    const { result } = setup()

    let returned: { newCycleId: string } | undefined
    await act(async () => {
      returned = await result.current.mutateAsync(ARGS)
    })

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ finished_at: expect.any(String) }),
    )
    expect(mockUpdateEqId).toHaveBeenCalledWith("id", "cycle-old")
    expect(mockUpdateEqUser).toHaveBeenCalledWith("user_id", "user-1")
    expect(cycleLib.resolveOrCreateActiveCycle).toHaveBeenCalledWith(
      "prog-1",
      "user-1",
    )
    expect(returned).toEqual({ newCycleId: "cycle-new" })
  })

  it("rejects without calling resolveOrCreateActiveCycle when close fails", async () => {
    mockUpdateEqUser.mockResolvedValueOnce({
      error: { message: "RLS denied", code: "42501" },
    })

    const { result } = setup()

    await expect(
      act(async () => {
        await result.current.mutateAsync(ARGS)
      }),
    ).rejects.toMatchObject({ message: "RLS denied" })

    expect(cycleLib.resolveOrCreateActiveCycle).not.toHaveBeenCalled()
  })

  it("rejects with the resolve reason when the new cycle cannot be created", async () => {
    mockUpdateEqUser.mockResolvedValueOnce({ error: null })
    vi.mocked(cycleLib.resolveOrCreateActiveCycle).mockResolvedValueOnce({
      kind: "unavailable",
      reason: "Failed to fetch",
    })

    const { result } = setup()

    await expect(
      act(async () => {
        await result.current.mutateAsync(ARGS)
      }),
    ).rejects.toMatchObject({ message: "Failed to fetch" })
  })
})
