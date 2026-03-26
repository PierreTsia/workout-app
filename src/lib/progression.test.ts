import { describe, it, expect } from "vitest"
import {
  computeNextSessionTarget,
  resolveWeightIncrement,
  type ProgressionPrescription,
  type SetPerformance,
} from "./progression"

function makePrescription(
  overrides: Partial<ProgressionPrescription> = {},
): ProgressionPrescription {
  return {
    currentReps: 8,
    currentWeight: 80,
    currentSets: 3,
    repRangeMin: 8,
    repRangeMax: 12,
    setRangeMin: 3,
    setRangeMax: 5,
    weightIncrement: 2.5,
    maxWeightReached: false,
    ...overrides,
  }
}

function makeSets(
  count: number,
  reps: number,
  weight: number,
  rir: number | null = 2,
): SetPerformance[] {
  return Array.from({ length: count }, () => ({
    reps,
    weight,
    completed: true,
    rir,
  }))
}

describe("computeNextSessionTarget", () => {
  it("returns null when no last performance", () => {
    expect(computeNextSessionTarget(makePrescription(), null)).toBeNull()
  })

  it("returns null when last performance is empty", () => {
    expect(computeNextSessionTarget(makePrescription(), [])).toBeNull()
  })

  it("REPS_UP — classical volumetric progression (3×8 → 3×9)", () => {
    const rx = makePrescription({ currentReps: 8 })
    const perf = makeSets(3, 8, 80)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("REPS_UP")
    expect(result.reps).toBe(9)
    expect(result.weight).toBe(80)
    expect(result.sets).toBe(3)
  })

  it("WEIGHT_UP — intensity jump when all sets hit rep_range_max (3×12 → 3×8 @ +2.5kg)", () => {
    const rx = makePrescription({ currentReps: 12 })
    const perf = makeSets(3, 12, 80)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("WEIGHT_UP")
    expect(result.reps).toBe(8)
    expect(result.weight).toBe(82.5)
    expect(result.sets).toBe(3)
  })

  it("SETS_UP — density progression at equipment ceiling (3×12 @ 30kg → 4×8 @ 30kg)", () => {
    const rx = makePrescription({
      currentReps: 12,
      currentWeight: 30,
      currentSets: 3,
      maxWeightReached: true,
    })
    const perf = makeSets(3, 12, 30)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("SETS_UP")
    expect(result.reps).toBe(8)
    expect(result.weight).toBe(30)
    expect(result.sets).toBe(4)
  })

  it("HOLD_NEAR_FAILURE — safety gate when avg RIR < 1", () => {
    const rx = makePrescription({ currentReps: 12 })
    const perf = makeSets(3, 12, 80, 0.5)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("HOLD_NEAR_FAILURE")
    expect(result.reps).toBe(12)
    expect(result.weight).toBe(80)
    expect(result.sets).toBe(3)
  })

  it("HOLD_INCOMPLETE — not all sets completed", () => {
    const rx = makePrescription({ currentSets: 3 })
    const perf: SetPerformance[] = [
      { reps: 8, weight: 80, completed: true, rir: 2 },
      { reps: 8, weight: 80, completed: true, rir: 2 },
      { reps: 6, weight: 80, completed: false, rir: null },
    ]
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("HOLD_INCOMPLETE")
    expect(result.reps).toBe(8)
    expect(result.weight).toBe(80)
  })

  it("HOLD_INCOMPLETE — all completed but some sets missed target reps", () => {
    const rx = makePrescription({ currentReps: 10 })
    const perf: SetPerformance[] = [
      { reps: 10, weight: 80, completed: true, rir: 2 },
      { reps: 9, weight: 80, completed: true, rir: 2 },
      { reps: 8, weight: 80, completed: true, rir: 2 },
    ]
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("HOLD_INCOMPLETE")
  })

  it("PLATEAU — all dimensions maxed", () => {
    const rx = makePrescription({
      currentReps: 12,
      currentWeight: 30,
      currentSets: 5,
      maxWeightReached: true,
      setRangeMax: 5,
    })
    const perf = makeSets(5, 12, 30)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("PLATEAU")
    expect(result.reps).toBe(12)
    expect(result.weight).toBe(30)
    expect(result.sets).toBe(5)
  })

  it("RIR boundary — avg RIR = 1.0 does NOT trigger hold (threshold is < 1)", () => {
    const rx = makePrescription({ currentReps: 12 })
    const perf = makeSets(3, 12, 80, 1)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("WEIGHT_UP")
  })

  it("null RIR on all sets — RIR safety gate is skipped", () => {
    const rx = makePrescription({ currentReps: 12 })
    const perf = makeSets(3, 12, 80, null)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("WEIGHT_UP")
  })

  it("dumbbell increment via resolveWeightIncrement", () => {
    const inc = resolveWeightIncrement(null, "dumbbell")
    expect(inc).toBe(2)

    const rx = makePrescription({ currentReps: 12, weightIncrement: inc })
    const perf = makeSets(3, 12, 80)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("WEIGHT_UP")
    expect(result.weight).toBe(82)
  })

  it("custom weight increment is respected", () => {
    const inc = resolveWeightIncrement(1.25)
    expect(inc).toBe(1.25)

    const rx = makePrescription({ currentReps: 12, weightIncrement: 1.25 })
    const perf = makeSets(3, 12, 80)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.weight).toBe(81.25)
  })
})

describe("resolveWeightIncrement", () => {
  it("returns user value when provided", () => {
    expect(resolveWeightIncrement(1.25)).toBe(1.25)
  })

  it("returns dumbbell default when equipment is dumbbell", () => {
    expect(resolveWeightIncrement(null, "dumbbell")).toBe(2)
  })

  it("returns barbell default when no user value and non-dumbbell", () => {
    expect(resolveWeightIncrement(null)).toBe(2.5)
    expect(resolveWeightIncrement(null, "barbell")).toBe(2.5)
    expect(resolveWeightIncrement(null, "machine")).toBe(2.5)
  })
})
