import { vi, describe, it, expect, beforeEach } from "vitest"
import { renderHookWithProviders } from "@/test/utils"
import { useAutoCloseStuckCycle } from "./useAutoCloseStuckCycle"
import type { Cycle } from "@/types/database"

const mockMutate = vi.fn()

vi.mock("./useFinishCycle", () => ({
  useFinishCycle: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}))

const STUCK_CYCLE: Cycle = {
  id: "cycle-stuck",
  user_id: "user-1",
  program_id: "program-1",
  started_at: "2026-05-01T00:00:00.000Z",
  finished_at: null,
}

describe("useAutoCloseStuckCycle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("closes a stuck active cycle on mount", () => {
    renderHookWithProviders(() =>
      useAutoCloseStuckCycle({
        activeCycle: STUCK_CYCLE,
        isComplete: true,
        isLoading: false,
      }),
    )

    expect(mockMutate).toHaveBeenCalledTimes(1)
    expect(mockMutate).toHaveBeenCalledWith("cycle-stuck")
  })

  it("does not fire while the progress query is still loading", () => {
    renderHookWithProviders(() =>
      useAutoCloseStuckCycle({
        activeCycle: STUCK_CYCLE,
        isComplete: true,
        isLoading: true,
      }),
    )

    expect(mockMutate).not.toHaveBeenCalled()
  })

  it("does not fire when there is no active cycle", () => {
    renderHookWithProviders(() =>
      useAutoCloseStuckCycle({
        activeCycle: null,
        isComplete: true,
        isLoading: false,
      }),
    )

    expect(mockMutate).not.toHaveBeenCalled()
  })

  it("does not fire when the cycle is incomplete", () => {
    renderHookWithProviders(() =>
      useAutoCloseStuckCycle({
        activeCycle: STUCK_CYCLE,
        isComplete: false,
        isLoading: false,
      }),
    )

    expect(mockMutate).not.toHaveBeenCalled()
  })

  it("does not fire when disabled (e.g. during normal post-session flow)", () => {
    renderHookWithProviders(() =>
      useAutoCloseStuckCycle({
        activeCycle: STUCK_CYCLE,
        isComplete: true,
        isLoading: false,
        enabled: false,
      }),
    )

    expect(mockMutate).not.toHaveBeenCalled()
  })

  it("only fires once per mount even if dependencies re-trigger the effect", () => {
    const { rerender } = renderHookWithProviders<
      void,
      {
        activeCycle: Cycle | null
        isComplete: boolean
        isLoading: boolean
      }
    >(
      (props) => useAutoCloseStuckCycle(props),
      {
        initialProps: {
          activeCycle: STUCK_CYCLE,
          isComplete: true,
          isLoading: false,
        },
      },
    )

    rerender({
      activeCycle: STUCK_CYCLE,
      isComplete: true,
      isLoading: false,
    })
    rerender({
      activeCycle: { ...STUCK_CYCLE },
      isComplete: true,
      isLoading: false,
    })

    expect(mockMutate).toHaveBeenCalledTimes(1)
  })
})
