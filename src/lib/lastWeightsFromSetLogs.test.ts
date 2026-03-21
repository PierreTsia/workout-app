import { describe, expect, it } from "vitest"
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
})
