import { describe, it, expect } from "vitest"
import {
  computeNextSessionTarget,
  resolveWeightIncrement,
  type ProgressionPrescription,
  type SetPerformance,
  type VolumePrescription,
} from "./progression"

function makeVolume(
  overrides: Partial<VolumePrescription> = {},
): VolumePrescription {
  return {
    type: "reps",
    current: 8,
    min: 8,
    max: 12,
    increment: 1,
    ...overrides,
  }
}

function makePrescription(
  overrides: Partial<ProgressionPrescription> = {},
): ProgressionPrescription {
  const vol = overrides.volume ?? makeVolume()
  return {
    volume: vol,
    currentWeight: 80,
    currentSets: 3,
    setRangeMin: 3,
    setRangeMax: 5,
    weightIncrement: 2.5,
    maxWeightReached: false,
    currentReps: vol.type === "reps" ? vol.current : 0,
    repRangeMin: vol.type === "reps" ? vol.min : 0,
    repRangeMax: vol.type === "reps" ? vol.max : 0,
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

function makeDurationSets(
  count: number,
  durationSeconds: number,
  weight = 0,
): SetPerformance[] {
  return Array.from({ length: count }, () => ({
    reps: 0,
    weight,
    completed: true,
    rir: null,
    durationSeconds,
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
    const rx = makePrescription({ volume: makeVolume({ current: 8 }) })
    const perf = makeSets(3, 8, 80)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("REPS_UP")
    expect(result.reps).toBe(9)
    expect(result.weight).toBe(80)
    expect(result.sets).toBe(3)
    expect(result.volumeType).toBe("reps")
  })

  it("WEIGHT_UP — intensity jump when all sets hit rep_range_max (3×12 → 3×8 @ +2.5kg)", () => {
    const rx = makePrescription({ volume: makeVolume({ current: 12 }) })
    const perf = makeSets(3, 12, 80)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("WEIGHT_UP")
    expect(result.reps).toBe(8)
    expect(result.weight).toBe(82.5)
    expect(result.sets).toBe(3)
  })

  it("SETS_UP — density progression at equipment ceiling (3×12 @ 30kg → 4×8 @ 30kg)", () => {
    const rx = makePrescription({
      volume: makeVolume({ current: 12 }),
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
    const rx = makePrescription({ volume: makeVolume({ current: 12 }) })
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
    const rx = makePrescription({ volume: makeVolume({ current: 10 }) })
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
      volume: makeVolume({ current: 12 }),
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
    const rx = makePrescription({ volume: makeVolume({ current: 12 }) })
    const perf = makeSets(3, 12, 80, 1)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("WEIGHT_UP")
  })

  it("null RIR on all sets — RIR safety gate is skipped", () => {
    const rx = makePrescription({ volume: makeVolume({ current: 12 }) })
    const perf = makeSets(3, 12, 80, null)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("WEIGHT_UP")
  })

  it("dumbbell increment via resolveWeightIncrement", () => {
    const inc = resolveWeightIncrement(null, "dumbbell")
    expect(inc).toBe(2)

    const rx = makePrescription({ volume: makeVolume({ current: 12 }), weightIncrement: inc })
    const perf = makeSets(3, 12, 80)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("WEIGHT_UP")
    expect(result.weight).toBe(82)
  })

  it("custom weight increment is respected", () => {
    const inc = resolveWeightIncrement(1.25)
    expect(inc).toBe(1.25)

    const rx = makePrescription({ volume: makeVolume({ current: 12 }), weightIncrement: 1.25 })
    const perf = makeSets(3, 12, 80)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.weight).toBe(81.25)
  })
})

describe("computeNextSessionTarget — duration exercises", () => {
  function durationVolume(overrides: Partial<VolumePrescription> = {}): VolumePrescription {
    return {
      type: "duration",
      current: 30,
      min: 20,
      max: 45,
      increment: 5,
      ...overrides,
    }
  }

  it("DURATION_UP — all sets completed at target, not at max (3×30s → 3×35s)", () => {
    const rx = makePrescription({
      volume: durationVolume({ current: 30 }),
      currentWeight: 0,
      maxWeightReached: true,
    })
    const perf = makeDurationSets(3, 30)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("DURATION_UP")
    expect(result.duration).toBe(35)
    expect(result.reps).toBe(0)
    expect(result.weight).toBe(0)
    expect(result.sets).toBe(3)
    expect(result.volumeType).toBe("duration")
    expect(result.delta).toBe("+5s")
  })

  it("HOLD_INCOMPLETE — not all duration sets completed", () => {
    const rx = makePrescription({
      volume: durationVolume(),
      currentSets: 3,
      currentWeight: 0,
    })
    const perf: SetPerformance[] = [
      { reps: 0, weight: 0, completed: true, rir: null, durationSeconds: 30 },
      { reps: 0, weight: 0, completed: true, rir: null, durationSeconds: 30 },
      { reps: 0, weight: 0, completed: false, rir: null, durationSeconds: 15 },
    ]
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("HOLD_INCOMPLETE")
    expect(result.volumeType).toBe("duration")
  })

  it("HOLD_INCOMPLETE — completed but duration below target", () => {
    const rx = makePrescription({
      volume: durationVolume({ current: 30 }),
      currentSets: 3,
      currentWeight: 0,
    })
    const perf: SetPerformance[] = [
      { reps: 0, weight: 0, completed: true, rir: null, durationSeconds: 30 },
      { reps: 0, weight: 0, completed: true, rir: null, durationSeconds: 25 },
      { reps: 0, weight: 0, completed: true, rir: null, durationSeconds: 28 },
    ]
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("HOLD_INCOMPLETE")
  })

  it("WEIGHT_UP — all sets at max duration, maxWeightReached=false (loadable exercise)", () => {
    const rx = makePrescription({
      volume: durationVolume({ current: 45 }),
      currentWeight: 5,
      maxWeightReached: false,
      weightIncrement: 2.5,
    })
    const perf = makeDurationSets(3, 45, 5)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("WEIGHT_UP")
    expect(result.weight).toBe(7.5)
    expect(result.duration).toBe(20)
    expect(result.sets).toBe(3)
  })

  it("SETS_UP — all at max duration, maxWeightReached=true, sets < setRangeMax", () => {
    const rx = makePrescription({
      volume: durationVolume({ current: 45 }),
      currentWeight: 0,
      currentSets: 3,
      maxWeightReached: true,
      setRangeMax: 5,
    })
    const perf = makeDurationSets(3, 45)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("SETS_UP")
    expect(result.duration).toBe(20)
    expect(result.sets).toBe(4)
  })

  it("PLATEAU — all dimensions maxed for duration exercise", () => {
    const rx = makePrescription({
      volume: durationVolume({ current: 45 }),
      currentWeight: 0,
      currentSets: 5,
      maxWeightReached: true,
      setRangeMax: 5,
    })
    const perf = makeDurationSets(5, 45)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("PLATEAU")
    expect(result.duration).toBe(45)
    expect(result.sets).toBe(5)
  })

  it("first session for duration — returns null", () => {
    const rx = makePrescription({
      volume: durationVolume(),
      currentWeight: 0,
    })
    expect(computeNextSessionTarget(rx, null)).toBeNull()
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
