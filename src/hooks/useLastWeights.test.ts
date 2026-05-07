import { describe, expect, it } from "vitest"
import { lastWeightsQueryConfig } from "./useLastWeights"

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
