import { describe, it, expect } from "vitest"
import {
  getPrModality,
  scoreSetLogRow,
  scoreLiveRepSet,
  scoreLiveDurationSet,
} from "./prDetection"

describe("getPrModality", () => {
  it("prefers duration over bodyweight equipment", () => {
    expect(
      getPrModality({
        measurement_type: "duration",
        equipment: "bodyweight",
      }),
    ).toBe("duration")
  })

  it("detects bodyweight reps", () => {
    expect(getPrModality({ measurement_type: "reps", equipment: "bodyweight" })).toBe(
      "bodyweight_reps",
    )
  })

  it("defaults to weighted reps", () => {
    expect(getPrModality({ measurement_type: "reps", equipment: "barbell" })).toBe(
      "weighted_reps",
    )
  })
})

describe("scoreSetLogRow", () => {
  it("scores duration by seconds", () => {
    expect(
      scoreSetLogRow(
        { reps_logged: null, weight_logged: 0, duration_seconds: 90 },
        "duration",
      ),
    ).toBe(90)
  })

  it("scores bodyweight by reps", () => {
    expect(
      scoreSetLogRow(
        { reps_logged: "12", weight_logged: 5, estimated_1rm: null },
        "bodyweight_reps",
      ),
    ).toBe(12)
  })

  it("scores weighted by Epley when estimated_1rm absent", () => {
    expect(
      scoreSetLogRow(
        { reps_logged: "5", weight_logged: 100, estimated_1rm: null },
        "weighted_reps",
      ),
    ).toBeCloseTo(116.67, 1)
  })

  it("uses estimated_1rm when present for weighted", () => {
    expect(
      scoreSetLogRow(
        { reps_logged: "5", weight_logged: 100, estimated_1rm: 130 },
        "weighted_reps",
      ),
    ).toBe(130)
  })
})

describe("scoreLiveRepSet", () => {
  it("uses reps only for bodyweight modality", () => {
    expect(scoreLiveRepSet(10, 8, "bodyweight_reps")).toBe(8)
  })

  it("uses Epley for weighted", () => {
    expect(scoreLiveRepSet(100, 10, "weighted_reps")).toBeCloseTo(133.33, 1)
  })
})

describe("scoreLiveDurationSet", () => {
  it("returns seconds when positive", () => {
    expect(scoreLiveDurationSet(45)).toBe(45)
  })

  it("returns 0 for non-positive", () => {
    expect(scoreLiveDurationSet(0)).toBe(0)
  })
})
