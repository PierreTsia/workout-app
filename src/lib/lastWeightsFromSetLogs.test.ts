import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import {
  fetchLastWeightsForExerciseIds,
  latestWeightPerExerciseFromRows,
} from "@/lib/lastWeightsFromSetLogs"

describe("latestWeightPerExerciseFromRows", () => {
  it("returns empty object for empty input", () => {
    expect(latestWeightPerExerciseFromRows([])).toEqual({})
  })

  it("maps a single row", () => {
    expect(
      latestWeightPerExerciseFromRows([
        { exercise_id: "a", weight_logged: 80 },
      ]),
    ).toEqual({ a: 80 })
  })

  it("keeps first occurrence per exercise (newest-first order)", () => {
    expect(
      latestWeightPerExerciseFromRows([
        { exercise_id: "a", weight_logged: 100 },
        { exercise_id: "a", weight_logged: 80 },
        { exercise_id: "b", weight_logged: 40 },
      ]),
    ).toEqual({ a: 100, b: 40 })
  })

  it("coerces string weights to numbers", () => {
    expect(
      latestWeightPerExerciseFromRows([{ exercise_id: "x", weight_logged: "62.5" }]),
    ).toEqual({ x: 62.5 })
  })
})

describe("fetchLastWeightsForExerciseIds", () => {
  it("returns {} when ids empty without hitting the network layer", async () => {
    expect(await fetchLastWeightsForExerciseIds([])).toEqual({})
  })

  it("excludes block set logs from the prefill query (ADR 0007)", async () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const m of ["select", "in", "is", "order"]) {
      chain[m] = vi.fn(() => chain)
    }
    chain.limit = vi.fn(() => Promise.resolve({ data: [], error: null }))
    const { supabase } = await import("@/lib/supabase")
    vi.mocked(supabase.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabase.from>,
    )

    await fetchLastWeightsForExerciseIds(["ex-1"])

    expect(chain.is).toHaveBeenCalledWith("block_exercise_id", null)
  })
})
