import { vi, describe, it, expect, beforeEach } from "vitest"
import { act, waitFor } from "@testing-library/react"
import { useQuery } from "@tanstack/react-query"
import { renderHookWithProviders } from "@/test/utils"
import { applySortOrders } from "@/lib/dayItems"
import { useReorderExercises } from "@/hooks/useBuilderMutations"

let updateGate: Promise<{ error: null }>

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      update: () => ({
        eq: () => updateGate,
      }),
    }),
  },
}))

const seed = [
  { id: "ex-a", sort_order: 0 },
  { id: "ex-b", sort_order: 1 },
]

const nextOrder = [
  { id: "ex-b", sort_order: 0 },
  { id: "ex-a", sort_order: 1 },
]

describe("useReorderExercises", () => {
  let releaseUpdate: () => void

  beforeEach(() => {
    updateGate = new Promise((resolve) => {
      releaseUpdate = () => resolve({ error: null })
    })
  })

  it("rewrites the day cache before the update resolves", async () => {
    const { result, queryClient } = renderHookWithProviders(() => {
      const cache = useQuery({
        queryKey: ["workout-exercises", "day-1"],
        queryFn: async () => seed,
        enabled: false,
        initialData: seed,
      })
      const reorder = useReorderExercises()
      return { cache, reorder }
    })

    act(() => {
      result.current.reorder.mutate({ dayId: "day-1", exercises: nextOrder })
    })

    await waitFor(() => {
      expect(
        queryClient.getQueryData<typeof seed>(["workout-exercises", "day-1"]),
      ).toEqual(applySortOrders(seed, nextOrder))
    })
    expect(result.current.reorder.isPending).toBe(true)

    await act(async () => {
      releaseUpdate()
    })
    await waitFor(() => {
      expect(result.current.reorder.isSuccess).toBe(true)
    })
  })
})
