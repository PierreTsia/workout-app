import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import {
  lastWeightsForSlotsQueryConfig,
  lastWeightsQueryConfig,
} from "./useLastWeights"

describe("lastWeightsQueryConfig", () => {
  it("produces a stable queryKey regardless of input id order", () => {
    // The factory is the single source of truth for the cache key, so
    // the hook (which calls it internally) and any imperative
    // queryClient.fetchQuery(lastWeightsQueryConfig(...)) consumer hit
    // the SAME cache entry for the same id set, in any order.
    const a = lastWeightsQueryConfig(["b", "a", "c"])
    const b = lastWeightsQueryConfig(["c", "b", "a"])
    expect(a.queryKey).toEqual(b.queryKey)
    expect(a.queryKey).toEqual(["last-weights", ["a", "b", "c"]])
  })
})

describe("lastWeightsForSlotsQueryConfig", () => {
  it("produces a stable queryKey regardless of slot order", () => {
    const a = lastWeightsForSlotsQueryConfig([
      { workoutExerciseId: "we-b", exerciseId: "ex-1" },
      { workoutExerciseId: "we-a", exerciseId: "ex-2" },
    ])
    const b = lastWeightsForSlotsQueryConfig([
      { workoutExerciseId: "we-a", exerciseId: "ex-2" },
      { workoutExerciseId: "we-b", exerciseId: "ex-1" },
    ])
    expect(a.queryKey).toEqual(b.queryKey)
    expect(a.queryKey[0]).toBe("last-weights-slots")
  })
})
