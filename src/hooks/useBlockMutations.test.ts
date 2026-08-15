import { vi, describe, it, expect, beforeEach } from "vitest"
import { act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { useUpdateBlockMeta } from "@/hooks/useBlockMutations"

interface UpdateCall {
  table: string
  payload: unknown
  id: string
}

const updates: UpdateCall[] = []

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      update: (payload: unknown) => ({
        eq: (_col: string, id: string) => {
          updates.push({ table, payload, id })
          return Promise.resolve({ error: null })
        },
      }),
    }),
  },
}))

describe("useUpdateBlockMeta", () => {
  beforeEach(() => {
    updates.length = 0
  })

  it("does not clone per_round to N cells when the block is AMRAP", async () => {
    const { result } = renderHookWithProviders(() => useUpdateBlockMeta())

    await act(async () => {
      await result.current.mutateAsync({
        blockId: "b-cindy",
        dayId: "day-1",
        mode: "amrap",
        rounds: 4,
        cap_seconds: 1200,
        rest_seconds: 0,
        transition_seconds: 0,
        exercises: [
          { id: "be-pull", per_round: [{ amount: 5, weight: 0 }] },
          { id: "be-push", per_round: [{ amount: 10, weight: 0 }] },
          { id: "be-squat", per_round: [{ amount: 15, weight: 0 }] },
        ],
      })
    })

    const exerciseUpdates = updates.filter((u) => u.table === "block_exercises")
    expect(exerciseUpdates).toHaveLength(3)
    expect(
      exerciseUpdates.map((u) => {
        if (
          typeof u.payload !== "object" ||
          u.payload === null ||
          !("per_round" in u.payload)
        ) {
          return null
        }
        return u.payload.per_round
      }),
    ).toEqual([
      [{ amount: 5, weight: 0 }],
      [{ amount: 10, weight: 0 }],
      [{ amount: 15, weight: 0 }],
    ])
  })
})
