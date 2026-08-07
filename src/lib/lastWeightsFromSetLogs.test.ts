import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import {
  fetchLastWeightsForExerciseIds,
  fetchLastWeightsForSlots,
  latestWeightPerExerciseFromRows,
  latestWeightPerSlotFromRows,
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

describe("latestWeightPerSlotFromRows", () => {
  it("keeps first occurrence per workout_exercise_id (newest-first)", () => {
    expect(
      latestWeightPerSlotFromRows([
        { workout_exercise_id: "we-heavy", weight_logged: 22 },
        { workout_exercise_id: "we-heavy", weight_logged: 20 },
        { workout_exercise_id: "we-light", weight_logged: 8 },
      ]),
    ).toEqual({ "we-heavy": 22, "we-light": 8 })
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

describe("fetchLastWeightsForSlots", () => {
  it("returns {} when slots empty without hitting the network layer", async () => {
    expect(await fetchLastWeightsForSlots([])).toEqual({})
  })

  it("queries by workout_exercise_id and excludes block logs", async () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const m of ["select", "in", "is", "not", "order"]) {
      chain[m] = vi.fn(() => chain)
    }
    chain.limit = vi.fn(() =>
      Promise.resolve({
        data: [
          {
            workout_exercise_id: "we-heavy",
            exercise_id: "ex-rowing",
            weight_logged: 22,
          },
          {
            workout_exercise_id: "we-light",
            exercise_id: "ex-rowing",
            weight_logged: 8,
          },
        ],
        error: null,
      }),
    )
    const { supabase } = await import("@/lib/supabase")
    vi.mocked(supabase.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabase.from>,
    )

    const result = await fetchLastWeightsForSlots([
      { workoutExerciseId: "we-heavy", exerciseId: "ex-rowing" },
      { workoutExerciseId: "we-light", exerciseId: "ex-rowing" },
    ])

    expect(chain.in).toHaveBeenCalledWith("workout_exercise_id", [
      "we-heavy",
      "we-light",
    ])
    expect(chain.is).toHaveBeenCalledWith("block_exercise_id", null)
    expect(result).toEqual({ "we-heavy": 22, "we-light": 8 })
  })
})
