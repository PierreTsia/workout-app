import { describe, it, expect } from "vitest"
import {
  buildPrescription,
  computeNextSessionTarget,
  deriveDurationRangeMax,
  resolveWeightIncrement,
  shouldDeload,
  DURATION_TARGET_CEILING_SECONDS,
  STALL_SESSIONS,
  type ProgressionPrescription,
  type SetPerformance,
  type SlotSessionSummary,
  type VolumePrescription,
  type ComputeNextSessionTargetOptions,
} from "./progression"
import { resolveLoadLadder } from "./loadLadder"
import type { WorkoutExercise } from "@/types/database"

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
    adjustmentTier: "weight-first",
    loadLadder: null,
    useSnapshot: true,
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

function makeSlotSession(
  overrides: Partial<SlotSessionSummary> = {},
): SlotSessionSummary {
  return {
    sessionFinishedAt: "2026-05-01T00:00:00Z",
    prescribedReps: 10,
    anchorReps: null,
    prescribedWeight: 80,
    avgRir: 1,
    ...overrides,
  }
}

/** `STALL_SESSIONS` sessions serving the same target, the last at RIR ≤ 1. */
function makeStall(overrides: Partial<SlotSessionSummary> = {}): SlotSessionSummary[] {
  return Array.from({ length: STALL_SESSIONS }, () => makeSlotSession(overrides))
}

describe("shouldDeload (ADR 0033)", () => {
  it("fires on STALL_SESSIONS equal targets whose last session is at RIR ≤ 1", () => {
    expect(shouldDeload(makeStall())).toBe(true)
  })

  it("does not fire below STALL_SESSIONS", () => {
    expect(shouldDeload(makeStall().slice(0, STALL_SESSIONS - 1))).toBe(false)
    expect(shouldDeload([])).toBe(false)
  })

  it("does not fire when a target in the window advances", () => {
    const sessions = makeStall()
    sessions[1] = makeSlotSession({ prescribedReps: 11 })
    expect(shouldDeload(sessions)).toBe(false)
  })

  it("does not fire when a target in the window drops (a served deload, or a manual change)", () => {
    const sessions = makeStall()
    sessions[2] = makeSlotSession({ prescribedWeight: 77.5 })
    expect(shouldDeload(sessions)).toBe(false)
  })

  it("does not fire when the last session declared no RIR", () => {
    const sessions = makeStall()
    sessions[STALL_SESSIONS - 1] = makeSlotSession({ avgRir: null })
    expect(shouldDeload(sessions)).toBe(false)
  })

  it("does not fire when the last session's average RIR is above 1", () => {
    const sessions = makeStall()
    sessions[STALL_SESSIONS - 1] = makeSlotSession({ avgRir: 2 })
    expect(shouldDeload(sessions)).toBe(false)
  })

  it("reads the served target as anchor_reps ?? prescribed_reps (ADR 0032)", () => {
    // The anchor moved down on the last session: the served target dropped, so
    // the streak is broken even though prescribed_reps never budged.
    const sessions = makeStall({ anchorReps: 10 })
    sessions[STALL_SESSIONS - 1] = makeSlotSession({ anchorReps: 8 })
    expect(shouldDeload(sessions)).toBe(false)

    // A constant anchor is the served target — equality holds.
    expect(shouldDeload(makeStall({ anchorReps: 8 }))).toBe(true)
  })
})

describe("computeNextSessionTarget — DELOAD (ADR 0033)", () => {
  it("preempts the rule chain: a Stall at RIR 0.5 deloads instead of holding near failure", () => {
    const rx = makePrescription({ volume: makeVolume({ current: 10 }), currentWeight: 80 })
    const result = computeNextSessionTarget(rx, makeSets(3, 10, 80, 0.5), {
      stallHistory: makeStall(),
    })!

    expect(result.rule).toBe("DELOAD")
    expect(result.reasonKey).toBe("progression.deload")
    expect(result.delta).toBe("—")
    expect(result.sets).toBe(3)
  })

  it("weight-first: one increment off the load, reps untouched", () => {
    const rx = makePrescription({
      volume: makeVolume({ current: 10 }),
      currentWeight: 80,
      weightIncrement: 2.5,
    })
    const result = computeNextSessionTarget(rx, makeSets(3, 10, 80), {
      stallHistory: makeStall(),
    })!

    expect(result.rule).toBe("DELOAD")
    expect(result.weight).toBe(77.5)
    expect(result.reps).toBe(10)
  })

  it("weight-first: at one increment the deload lowers nothing, so it falls through", () => {
    const rx = makePrescription({
      volume: makeVolume({ current: 10 }),
      currentWeight: 2.5,
      weightIncrement: 2.5,
    })
    const result = computeNextSessionTarget(rx, makeSets(3, 10, 2.5), {
      stallHistory: makeStall(),
    })!

    expect(result.rule).not.toBe("DELOAD")
    expect(result.weight).toBe(2.5)
  })

  it("reps-only: at one rep the deload lowers nothing, so it falls through", () => {
    const rx = makePrescription({
      volume: makeVolume({ current: 1 }),
      currentWeight: 0,
      adjustmentTier: "reps-only",
    })
    const result = computeNextSessionTarget(rx, makeSets(3, 1, 0), {
      stallHistory: makeStall({ prescribedWeight: 0 }),
    })!

    expect(result.rule).not.toBe("DELOAD")
  })

  it("weight-first: a 0 kg slot deloads reps, not load (no phantom increment)", () => {
    // equipment `other` (or `""` while the catalog row loads) is weight-first,
    // but a 0 kg slot has no load to shave: the old `Math.max(weightIncrement,
    // currentWeight - weightIncrement)` raised it to 2.5 kg.
    const exercise = makeExercise({ reps: "10", weight: "0", sets: 3 })
    const lastPerformance = makeSets(3, 10, 0)
    const prescription = buildPrescription(exercise, lastPerformance, {
      equipment: "other",
      lastSessionFinishedAt: "2026-05-01T00:00:00Z",
    })!
    const result = computeNextSessionTarget(prescription, lastPerformance, {
      stallHistory: makeStall({ prescribedWeight: 0 }),
    })!

    expect(result.rule).toBe("DELOAD")
    expect(result.weight).toBe(0)
    expect(result.reps).toBe(9)
  })

  it("reps-only: reps ×0.85 when the slot carries no load", () => {
    const rx = makePrescription({
      volume: makeVolume({ current: 10 }),
      currentWeight: 0,
      adjustmentTier: "reps-only",
    })
    const result = computeNextSessionTarget(rx, makeSets(3, 10, 0), {
      stallHistory: makeStall({ prescribedWeight: 0 }),
    })!

    expect(result.rule).toBe("DELOAD")
    expect(result.reps).toBe(9)
    expect(result.weight).toBe(0)
  })

  it("reps-only: a loaded cable slot deloads reps, not load (tier, not the load)", () => {
    // The tier comes from `getAdjustmentTier` (cable is reps-only), so a cable
    // slot carrying load must still deload on reps — the old `currentWeight > 0`
    // heuristic would have treated it weight-first.
    const exercise = makeExercise({ reps: "10", weight: "30", sets: 3 })
    const lastPerformance = makeSets(3, 10, 30)
    const prescription = buildPrescription(exercise, lastPerformance, {
      equipment: "cable",
      lastSessionFinishedAt: "2026-05-01T00:00:00Z",
    })!
    const result = computeNextSessionTarget(prescription, lastPerformance, {
      stallHistory: makeStall({ prescribedWeight: 30 }),
    })!

    expect(result.rule).toBe("DELOAD")
    expect(result.reps).toBe(9)
    expect(result.weight).toBe(30)
  })

  it("the Manual Override Window suppresses it — the template wins", () => {
    const rx = makePrescription({
      volume: makeVolume({ current: 10 }),
      currentWeight: 80,
      useSnapshot: false,
    })
    const result = computeNextSessionTarget(rx, makeSets(3, 10, 80), {
      stallHistory: makeStall(),
    })!

    expect(result.rule).not.toBe("DELOAD")
  })

  it("keeps its behaviour when opts is undefined", () => {
    const rx = makePrescription({ volume: makeVolume({ current: 8 }) })
    expect(computeNextSessionTarget(rx, makeSets(3, 8, 80))!.rule).toBe("REPS_UP")
  })
})

describe("computeNextSessionTarget — DELOAD steps down the Load Ladder (T311)", () => {
  const DUMBBELL_KG = resolveLoadLadder("dumbbell", "kg")!
  const BARBELL_KG = resolveLoadLadder("barbell", "kg")!

  it("a stalled dumbbell slot at 25 kg deloads to the previous rung (20 kg), not 23 kg", () => {
    const rx = makePrescription({
      volume: makeVolume({ current: 10 }),
      currentWeight: 25,
      weightIncrement: 2,
      loadLadder: DUMBBELL_KG,
    })
    const result = computeNextSessionTarget(rx, makeSets(3, 10, 25), {
      stallHistory: makeStall({ prescribedWeight: 25 }),
    })!

    expect(result.rule).toBe("DELOAD")
    expect(result.weight).toBe(20)
  })

  it("at the first rung the deload falls back to Math.max(weightIncrement, currentWeight - weightIncrement)", () => {
    const rx = makePrescription({
      volume: makeVolume({ current: 10 }),
      currentWeight: 20,
      weightIncrement: 2.5,
      loadLadder: BARBELL_KG,
    })
    const result = computeNextSessionTarget(rx, makeSets(3, 10, 20), {
      stallHistory: makeStall({ prescribedWeight: 20 }),
    })!

    expect(result.rule).toBe("DELOAD")
    expect(result.weight).toBe(17.5)
  })

  it("without a ladder the behaviour is unchanged", () => {
    const rx = makePrescription({
      volume: makeVolume({ current: 10 }),
      currentWeight: 80,
      weightIncrement: 2.5,
      loadLadder: null,
    })
    const result = computeNextSessionTarget(rx, makeSets(3, 10, 80), {
      stallHistory: makeStall(),
    })!

    expect(result.rule).toBe("DELOAD")
    expect(result.weight).toBe(77.5)
  })

  it("reps-only equipment still deloads reps ×0.85 and never reads the ladder", () => {
    const rx = makePrescription({
      volume: makeVolume({ current: 10 }),
      currentWeight: 30,
      adjustmentTier: "reps-only",
      loadLadder: resolveLoadLadder("cable", "kg"),
    })
    const result = computeNextSessionTarget(rx, makeSets(3, 10, 30), {
      stallHistory: makeStall({ prescribedWeight: 30 }),
    })!

    expect(result.rule).toBe("DELOAD")
    expect(result.reps).toBe(9)
    expect(result.weight).toBe(30)
  })

  it("an off-ladder current load (23 kg) steps down to the lower rung (20 kg)", () => {
    const rx = makePrescription({
      volume: makeVolume({ current: 10 }),
      currentWeight: 23,
      weightIncrement: 2,
      loadLadder: DUMBBELL_KG,
    })
    const result = computeNextSessionTarget(rx, makeSets(3, 10, 23), {
      stallHistory: makeStall({ prescribedWeight: 23 }),
    })!

    expect(result.rule).toBe("DELOAD")
    expect(result.weight).toBe(20)
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

  // #713: a duration exercise has no load axis — the WEIGHT_UP branch must not
  // exist for it. At the duration ceiling the engine escalates to SETS_UP, never
  // to a load (which would prescribe kilos on a plank, with seconds in `reps`).
  it("SETS_UP — duration at max, maxWeightReached=false, sets < setRangeMax (#713)", () => {
    const rx = makePrescription({
      volume: durationVolume({ current: 45 }),
      currentWeight: 0,
      currentSets: 3,
      maxWeightReached: false,
      weightIncrement: 2.5,
      setRangeMax: 5,
    })
    const perf = makeDurationSets(3, 45)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).not.toBe("WEIGHT_UP")
    expect(result.rule).toBe("SETS_UP")
    expect(result.weight).toBe(0)
    expect(result.sets).toBe(4)
  })

  it("PLATEAU — duration at max, maxWeightReached=false, sets at setRangeMax (#713)", () => {
    const rx = makePrescription({
      volume: durationVolume({ current: 45 }),
      currentWeight: 0,
      currentSets: 5,
      maxWeightReached: false,
      weightIncrement: 2.5,
      setRangeMax: 5,
    })
    const perf = makeDurationSets(5, 45)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).not.toBe("WEIGHT_UP")
    expect(result.rule).toBe("PLATEAU")
    expect(result.weight).toBe(0)
  })

  // #713: the invariant is "no rule prescribes a load on a duration exercise".
  // The two rule tests above cover SETS_UP / PLATEAU; this walks the whole chain
  // — including the DELOAD branch (P2) — on a loadless hold, the bug's case.
  it("no rule prescribes a weight on a loadless duration exercise (#713)", () => {
    const loadless = { currentWeight: 0, weightIncrement: 2.5 }
    const cases: Array<{
      rule: string
      rx: ProgressionPrescription
      perf: SetPerformance[]
      opts?: ComputeNextSessionTargetOptions
    }> = [
      {
        rule: "HOLD_INCOMPLETE",
        rx: makePrescription({ volume: durationVolume(), currentSets: 3, ...loadless }),
        perf: [
          { reps: 0, weight: 0, completed: true, rir: null, durationSeconds: 30 },
          { reps: 0, weight: 0, completed: false, rir: null, durationSeconds: 15 },
          { reps: 0, weight: 0, completed: false, rir: null, durationSeconds: 15 },
        ],
      },
      {
        rule: "HOLD_NEAR_FAILURE",
        rx: makePrescription({ volume: durationVolume(), currentSets: 3, ...loadless }),
        perf: makeDurationSets(3, 30).map((s) => ({ ...s, rir: 0.5 })),
      },
      {
        rule: "DURATION_UP",
        rx: makePrescription({ volume: durationVolume({ current: 30 }), currentSets: 3, ...loadless }),
        perf: makeDurationSets(3, 30),
      },
      {
        rule: "SETS_UP",
        rx: makePrescription({ volume: durationVolume({ current: 45 }), currentSets: 3, setRangeMax: 5, ...loadless }),
        perf: makeDurationSets(3, 45),
      },
      {
        rule: "PLATEAU",
        rx: makePrescription({ volume: durationVolume({ current: 45 }), currentSets: 5, setRangeMax: 5, ...loadless }),
        perf: makeDurationSets(5, 45),
      },
      {
        rule: "DELOAD",
        rx: makePrescription({ volume: durationVolume({ current: 45 }), currentSets: 3, ...loadless }),
        perf: makeDurationSets(3, 45),
        opts: {
          stallHistory: makeStall({ prescribedWeight: 0, prescribedReps: 0, anchorReps: 0 }),
        },
      },
    ]

    for (const c of cases) {
      const result = computeNextSessionTarget(c.rx, c.perf, c.opts)!
      expect(result.rule, c.rule).toBe(c.rule)
      expect(result.weight, `${c.rule} prescribed a weight`).toBe(0)
    }
  })

  // The flip side, asserted so the distinction is written down: a *weighted* hold
  // (bodyweight with a logged plate) is weight-first, so the Deload lowers its
  // load — the load axis, not the reps axis. #713's invariant is about the
  // loadless hold only.
  it("a weighted hold deloads its load, not its duration (#713)", () => {
    const exercise = makeExercise({
      reps: "0",
      weight: "10",
      sets: 3,
      target_duration_seconds: 45,
      duration_range_min_seconds: 20,
      duration_range_max_seconds: 45,
      duration_increment_seconds: 5,
    })
    const lastPerformance = makeDurationSets(3, 45, 10)
    const prescription = buildPrescription(exercise, lastPerformance, {
      measurementType: "duration",
      equipment: "bodyweight",
      lastSessionFinishedAt: "2026-05-01T00:00:00Z",
    })!
    expect(prescription.adjustmentTier).toBe("weight-first")

    const result = computeNextSessionTarget(prescription, lastPerformance, {
      stallHistory: makeStall({ prescribedWeight: 10, prescribedReps: 0, anchorReps: 0 }),
    })!

    expect(result.rule).toBe("DELOAD")
    expect(result.weight).toBeLessThan(10)
    expect(result.duration).toBe(45)
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

  // Regression for #379: an iso bodyweight hold (hollow hold / planche) sitting at
  // its STARTING target must keep climbing the time axis, not plateau. The bug was a
  // persistence freeze that set volume.max === volume.current; with the 90s ceiling
  // the engine correctly suggests DURATION_UP.
  it("DURATION_UP — iso hold at 5×35s with 90s ceiling keeps climbing (#379)", () => {
    const rx = makePrescription({
      volume: durationVolume({ current: 35, min: 35, max: 90 }),
      currentWeight: 0,
      currentSets: 5,
      maxWeightReached: true,
      setRangeMax: 5,
    })
    const perf = makeDurationSets(5, 35)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("DURATION_UP")
    expect(result.duration).toBe(40)
    expect(result.delta).toBe("+5s")
    expect(result.sets).toBe(5)
  })

  // The flip side: once the hold reaches the 90s ceiling and every other axis is
  // maxed, a real PLATEAU is the correct verdict (time to vary the stimulus).
  it("PLATEAU — iso hold only once it reaches the 90s ceiling (#379)", () => {
    const rx = makePrescription({
      volume: durationVolume({ current: 90, min: 35, max: 90 }),
      currentWeight: 0,
      currentSets: 5,
      maxWeightReached: true,
      setRangeMax: 5,
    })
    const perf = makeDurationSets(5, 90)
    const result = computeNextSessionTarget(rx, perf)!

    expect(result.rule).toBe("PLATEAU")
    expect(result.duration).toBe(90)
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

function makeExercise(overrides: Partial<WorkoutExercise> = {}): WorkoutExercise {
  return {
    id: "we-1",
    workout_day_id: "day-1",
    exercise_id: "ex-1",
    name_snapshot: "Bench Press",
    muscle_snapshot: "chest",
    emoji_snapshot: "🏋️",
    sets: 3,
    reps: "10",
    weight: "80",
    rest_seconds: 90,
    sort_order: 0,
    rep_range_min: 8,
    rep_range_max: 12,
    set_range_min: 2,
    set_range_max: 5,
    weight_increment: null,
    max_weight_reached: false,
    template_updated_at: "2020-01-01T00:00:00Z",
    ...overrides,
  }
}

describe("buildPrescription", () => {
  it("bootstraps a reps prescription from template values when no last performance", () => {
    const exercise = makeExercise({ reps: "10", weight: "80", sets: 3 })

    const result = buildPrescription(exercise, null, {})

    expect(result).not.toBeNull()
    expect(result!.volume).toMatchObject({
      type: "reps",
      current: 10,
      min: 8,
      max: 12,
      increment: 1,
    })
    expect(result!.currentWeight).toBe(80)
    expect(result!.currentSets).toBe(3)
    expect(result!.weightIncrement).toBe(2.5)
    expect(result!.maxWeightReached).toBe(false)
  })

  it("builds a duration prescription from explicit duration_range_* + increment", () => {
    const exercise = makeExercise({
      reps: "0",
      weight: "0",
      sets: 3,
      target_duration_seconds: 30,
      duration_range_min_seconds: 20,
      duration_range_max_seconds: 45,
      duration_increment_seconds: 5,
    })

    const result = buildPrescription(exercise, null, {
      measurementType: "duration",
    })

    expect(result).not.toBeNull()
    expect(result!.volume).toMatchObject({
      type: "duration",
      current: 30,
      min: 20,
      max: 45,
      increment: 5,
    })
    expect(result!.currentReps).toBe(0)
    expect(result!.repRangeMin).toBe(0)
    expect(result!.repRangeMax).toBe(0)
  })

  it("uses last session weight as currentWeight when last performance exists (snapshot path, prescribedWeight NULL legacy row)", () => {
    const exercise = makeExercise({ reps: "10", weight: "48", sets: 3 })
    // Legacy rows have NULL prescribedWeight; the snapshot path falls back to
    // the logged weight in that case.
    const lastPerformance: SetPerformance[] = [
      { reps: 10, weight: 57, completed: true, rir: 1 },
      { reps: 10, weight: 57, completed: true, rir: 1 },
      { reps: 10, weight: 57, completed: true, rir: 1 },
    ]

    const result = buildPrescription(exercise, lastPerformance, {
      lastSessionFinishedAt: "2026-05-01T00:00:00Z",
    })

    expect(result).not.toBeNull()
    expect(result!.currentWeight).toBe(57)
  })

  it("returns null when template reps is non-numeric and no inferred reps are available", () => {
    const exercise = makeExercise({ reps: "AMRAP", weight: "80", sets: 3 })

    expect(buildPrescription(exercise, null, {})).toBeNull()
    expect(buildPrescription(exercise, [], {})).toBeNull()
    expect(
      buildPrescription(exercise, [{ reps: 0, weight: 80, completed: true, rir: 2 }], {}),
    ).toBeNull()
  })

  it("infers reps from last performance when template reps is non-numeric", () => {
    const exercise = makeExercise({
      reps: "AMRAP",
      weight: "80",
      sets: 3,
      rep_range_min: undefined,
      rep_range_max: undefined,
    })
    const lastPerformance: SetPerformance[] = [
      { reps: 12, weight: 80, completed: true, rir: 2 },
      { reps: 11, weight: 80, completed: true, rir: 2 },
      { reps: 10, weight: 80, completed: true, rir: 1 },
    ]

    const result = buildPrescription(exercise, lastPerformance, {})

    expect(result).not.toBeNull()
    expect(result!.volume).toMatchObject({
      type: "reps",
      current: 12,
      min: 10,
      max: 14,
    })
  })

  // Duration axis: same Prescription Snapshot semantics as reps. The bug at
  // #373 affects all four volume axes (see ADR 0006); duration must not read
  // `target_duration_seconds` from a drifted template when the snapshot has
  // the engine's prescribed value.
  it("snapshot path: duration volume.current comes from prescribed_duration_seconds", () => {
    const exercise = makeExercise({
      reps: "0",
      weight: "0",
      sets: 3,
      target_duration_seconds: 35, // simulates drifted template (post-bump from 30)
      duration_range_min_seconds: 20,
      duration_range_max_seconds: 45,
      duration_increment_seconds: 5,
      template_updated_at: "2026-01-01T00:00:00Z",
    })

    const lastPerformance: SetPerformance[] = [
      {
        reps: 0,
        weight: 0,
        completed: true,
        rir: null,
        durationSeconds: 30,
        prescribedDurationSeconds: 30, // engine prescribed 30 last session
        prescribedSets: 3,
      },
      {
        reps: 0,
        weight: 0,
        completed: true,
        rir: null,
        durationSeconds: 30,
        prescribedDurationSeconds: 30,
        prescribedSets: 3,
      },
      {
        reps: 0,
        weight: 0,
        completed: true,
        rir: null,
        durationSeconds: 30,
        prescribedDurationSeconds: 30,
        prescribedSets: 3,
      },
    ]

    const prescription = buildPrescription(exercise, lastPerformance, {
      measurementType: "duration",
      lastSessionFinishedAt: "2026-05-01T00:00:00Z",
    })!

    expect(prescription.volume.current).toBe(30) // snapshot wins
  })

  // Weight axis tracks REALITY, NOT the prescribed snapshot. This is the one
  // axis that intentionally diverges from ADR 0006's "read prescribed_*" rule:
  // there is no "incomplete weight" signal to preserve, so the engine must
  // follow what the user actually lifted. Reading prescribedWeight here made the
  // engine read back its own stale bootstrap forever (follow-up to #381). The override
  // window still lets a deliberate Builder deload win (separate test below).
  it("snapshot path: currentWeight comes from the logged weight, not prescribedWeight", () => {
    const exercise = makeExercise({
      reps: "10",
      weight: "60", // drifted post-bump
      sets: 3,
      template_updated_at: "2026-01-01T00:00:00Z",
    })

    // Last session: engine prescribed 50, user actually loaded 55 (impromptu
    // bump — the prescription was too light). Reality must win: currentWeight = 55.
    const lastPerformance: SetPerformance[] = [
      {
        reps: 10,
        weight: 55,
        completed: true,
        rir: 2,
        prescribedReps: 10,
        prescribedWeight: 50,
        prescribedSets: 3,
      },
      {
        reps: 10,
        weight: 55,
        completed: true,
        rir: 2,
        prescribedReps: 10,
        prescribedWeight: 50,
        prescribedSets: 3,
      },
      {
        reps: 10,
        weight: 55,
        completed: true,
        rir: 2,
        prescribedReps: 10,
        prescribedWeight: 50,
        prescribedSets: 3,
      },
    ]

    const prescription = buildPrescription(exercise, lastPerformance, {
      lastSessionFinishedAt: "2026-05-01T00:00:00Z",
    })!

    expect(prescription.currentWeight).toBe(55) // reality (logged) wins
  })

  it("override window: currentWeight reads template when user edited weight post-session (deload)", () => {
    const exercise = makeExercise({
      reps: "10",
      weight: "40", // user deloaded from 50 to 40
      sets: 3,
      template_updated_at: "2026-06-01T00:00:00Z", // newer than last session
    })

    // Last session was at 50kg cleanly.
    const lastPerformance: SetPerformance[] = [
      {
        reps: 10,
        weight: 50,
        completed: true,
        rir: 2,
        prescribedReps: 10,
        prescribedWeight: 50,
        prescribedSets: 3,
      },
      {
        reps: 10,
        weight: 50,
        completed: true,
        rir: 2,
        prescribedReps: 10,
        prescribedWeight: 50,
        prescribedSets: 3,
      },
      {
        reps: 10,
        weight: 50,
        completed: true,
        rir: 2,
        prescribedReps: 10,
        prescribedWeight: 50,
        prescribedSets: 3,
      },
    ]

    const prescription = buildPrescription(exercise, lastPerformance, {
      lastSessionFinishedAt: "2026-05-15T00:00:00Z", // older than template edit
    })!

    expect(prescription.currentWeight).toBe(40) // template wins → user's deload respected
  })

  // Sets axis: same Prescription Snapshot semantics. Drifted exercise.sets must
  // not override the engine's prescribed_sets from the snapshot. See ADR 0006.
  it("snapshot path: currentSets comes from prescribed_sets, not exercise.sets", () => {
    const exercise = makeExercise({
      reps: "12",
      weight: "30",
      sets: 4, // simulates drifted template (post-bump from 3)
      template_updated_at: "2026-01-01T00:00:00Z",
    })

    const lastPerformance: SetPerformance[] = [
      {
        reps: 12,
        weight: 30,
        completed: true,
        rir: 2,
        prescribedReps: 12,
        prescribedWeight: 30,
        prescribedSets: 3, // engine prescribed 3 sets last session
      },
      {
        reps: 12,
        weight: 30,
        completed: true,
        rir: 2,
        prescribedReps: 12,
        prescribedWeight: 30,
        prescribedSets: 3,
      },
      {
        reps: 12,
        weight: 30,
        completed: true,
        rir: 2,
        prescribedReps: 12,
        prescribedWeight: 30,
        prescribedSets: 3,
      },
    ]

    const prescription = buildPrescription(exercise, lastPerformance, {
      lastSessionFinishedAt: "2026-05-01T00:00:00Z",
    })!

    expect(prescription.currentSets).toBe(3) // snapshot wins
  })

  // Bootstrap: no last session → no snapshot to read from. Template path always.
  it("bootstrap: lastSessionFinishedAt null falls through to template", () => {
    const exercise = makeExercise({ reps: "10", weight: "80", sets: 3 })

    const result = buildPrescription(exercise, null, {
      lastSessionFinishedAt: null,
    })!

    expect(result.volume.current).toBe(10)
  })

  // Manual Override Window: user edited the template after their last session
  // (e.g. deloaded from 10 → 8 between sessions). Engine should respect the
  // edit and read from template, not from the snapshot's pre-deload value.
  // See ADR 0006.
  it("override window: template wins when template_updated_at > last_session.finished_at", () => {
    const exercise = makeExercise({
      reps: "8", // user deloaded from 10 to 8
      weight: "50",
      sets: 3,
      template_updated_at: "2026-06-01T00:00:00Z", // newer than last session
    })

    // Last session was prescribed 11 (engine's pre-deload state), user logged 11.
    const lastPerformance: SetPerformance[] = [
      {
        reps: 11,
        weight: 50,
        completed: true,
        rir: 2,
        prescribedReps: 11,
        prescribedWeight: 50,
        prescribedSets: 3,
      },
      {
        reps: 11,
        weight: 50,
        completed: true,
        rir: 2,
        prescribedReps: 11,
        prescribedWeight: 50,
        prescribedSets: 3,
      },
      {
        reps: 11,
        weight: 50,
        completed: true,
        rir: 2,
        prescribedReps: 11,
        prescribedWeight: 50,
        prescribedSets: 3,
      },
    ]

    const prescription = buildPrescription(exercise, lastPerformance, {
      lastSessionFinishedAt: "2026-05-15T00:00:00Z", // older than template edit
    })!

    // Template wins → user's manual deload is respected.
    expect(prescription.volume.current).toBe(8)
  })

  // Regression for #373 — see ADR 0006.
  // Pre-fix: writeback bumped exercise.reps to 11 after a successful REPS_UP,
  // engine then read template = 11, compared against pre-bump logs of 10 → HOLD_INCOMPLETE.
  // Post-fix: engine reads volume.current from set_logs.prescribed_reps (the Prescription Snapshot),
  // ignoring any drift on workout_exercises.reps unless the user manually edited it post-session.
  it("snapshot path: volume.current comes from prescribed_reps even if exercise.reps drifted", () => {
    const exercise = makeExercise({
      reps: "11", // simulates post-bump drift OR a legacy row
      weight: "50",
      sets: 3,
      template_updated_at: "2026-01-01T00:00:00Z", // older than last session → snapshot wins
    })

    const lastPerformance: SetPerformance[] = [
      {
        reps: 10,
        weight: 50,
        completed: true,
        rir: 2,
        prescribedReps: 10,
        prescribedWeight: 50,
        prescribedSets: 3,
      },
      {
        reps: 10,
        weight: 50,
        completed: true,
        rir: 2,
        prescribedReps: 10,
        prescribedWeight: 50,
        prescribedSets: 3,
      },
      {
        reps: 10,
        weight: 50,
        completed: true,
        rir: 2,
        prescribedReps: 10,
        prescribedWeight: 50,
        prescribedSets: 3,
      },
    ]

    const prescription = buildPrescription(exercise, lastPerformance, {
      lastSessionFinishedAt: "2026-05-01T00:00:00Z",
    })!

    // Snapshot wins, not the drifted "11" template.
    expect(prescription.volume.current).toBe(10)

    // And the engine emits REPS_UP, not HOLD_INCOMPLETE — which is the bug fix.
    const result = computeNextSessionTarget(prescription, lastPerformance)!
    expect(result.rule).toBe("REPS_UP")
    expect(result.reps).toBe(11)
  })

  // ADR 0032 — an in-session deload (the intra-session engine) must reach the
  // next prescription via the anchor; `prescribed_*` stays the pristine snapshot.
  it("snapshot path: volume.current comes from the last set's anchor_reps after an in-session deload (ADR 0032)", () => {
    const exercise = makeExercise({
      reps: "10",
      weight: "50",
      sets: 3,
      template_updated_at: "2026-01-01T00:00:00Z",
    })
    const lastPerformance: SetPerformance[] = [
      { reps: 10, weight: 50, completed: true, rir: 2, setNumber: 1, prescribedReps: 10, anchorReps: 10 },
      { reps: 10, weight: 50, completed: true, rir: 2, setNumber: 2, prescribedReps: 10, anchorReps: 10 },
      { reps: 8, weight: 50, completed: true, rir: 0, setNumber: 3, prescribedReps: 10, anchorReps: 8 },
    ]

    const prescription = buildPrescription(exercise, lastPerformance, {
      lastSessionFinishedAt: "2026-05-01T00:00:00Z",
    })!

    expect(prescription.volume.current).toBe(8)
  })

  it("snapshot path: the anchor is read by set_number, not array position (ADR 0032)", () => {
    const exercise = makeExercise({
      reps: "10",
      weight: "50",
      sets: 3,
      template_updated_at: "2026-01-01T00:00:00Z",
    })
    const asc: SetPerformance[] = [
      { reps: 10, weight: 50, completed: true, rir: 2, setNumber: 1, prescribedReps: 10, anchorReps: 10 },
      { reps: 10, weight: 50, completed: true, rir: 2, setNumber: 2, prescribedReps: 10, anchorReps: 10 },
      { reps: 8, weight: 50, completed: true, rir: 0, setNumber: 3, prescribedReps: 10, anchorReps: 8 },
    ]
    const opts = { lastSessionFinishedAt: "2026-05-01T00:00:00Z" }

    // The two Last Performance readers order sets oppositely — the result must not.
    expect(buildPrescription(exercise, asc, opts)!.volume.current).toBe(8)
    expect(buildPrescription(exercise, [...asc].reverse(), opts)!.volume.current).toBe(8)
  })

  it("snapshot path: falls back to prescribed_reps when no anchor is present (ADR 0032)", () => {
    const exercise = makeExercise({
      reps: "10",
      weight: "50",
      sets: 3,
      template_updated_at: "2026-01-01T00:00:00Z",
    })
    const lastPerformance: SetPerformance[] = [
      { reps: 10, weight: 50, completed: true, rir: 2, setNumber: 1, prescribedReps: 10 },
      { reps: 8, weight: 50, completed: true, rir: 0, setNumber: 2, prescribedReps: 10 },
    ]

    const prescription = buildPrescription(exercise, lastPerformance, {
      lastSessionFinishedAt: "2026-05-01T00:00:00Z",
    })!

    expect(prescription.volume.current).toBe(10)
  })

  it("Manual Override Window wins over the anchor when the template was edited after the session (ADR 0032)", () => {
    const exercise = makeExercise({
      reps: "6",
      weight: "50",
      sets: 3,
      template_updated_at: "2026-06-01T00:00:00Z", // newer than the session finish
    })
    const lastPerformance: SetPerformance[] = [
      { reps: 8, weight: 50, completed: true, rir: 2, setNumber: 1, prescribedReps: 10, anchorReps: 8 },
    ]

    const prescription = buildPrescription(exercise, lastPerformance, {
      lastSessionFinishedAt: "2026-05-01T00:00:00Z",
    })!

    // The template's 6 wins; the anchor is ignored on the template path.
    expect(prescription.volume.current).toBe(6)
  })

  it("legacy sets without set_number fall back to the first element (ADR 0032)", () => {
    const exercise = makeExercise({
      reps: "10",
      weight: "50",
      sets: 3,
      template_updated_at: "2026-01-01T00:00:00Z",
    })
    const lastPerformance: SetPerformance[] = [
      { reps: 10, weight: 50, completed: true, rir: 2, prescribedReps: 10, anchorReps: 10 },
      { reps: 8, weight: 50, completed: true, rir: 0, prescribedReps: 10, anchorReps: 8 },
    ]

    const prescription = buildPrescription(exercise, lastPerformance, {
      lastSessionFinishedAt: "2026-05-01T00:00:00Z",
    })!

    expect(prescription.volume.current).toBe(10)
  })
})

describe("deriveDurationRangeMax (#379)", () => {
  it("raises a low ceiling up to the 90s progression ceiling", () => {
    expect(deriveDurationRangeMax(35)).toBe(90) // explicit freeze case
    expect(deriveDurationRangeMax(45)).toBe(90) // default 30 + band
    expect(DURATION_TARGET_CEILING_SECONDS).toBe(90)
  })

  it("preserves a deliberately higher explicit ceiling", () => {
    expect(deriveDurationRangeMax(120)).toBe(120)
    expect(deriveDurationRangeMax(90)).toBe(90)
  })
})

describe("load ladder (T309)", () => {
  it("WEIGHT_UP lands on the next ladder rung — dumbbell 20 kg → 25 kg, reps back to the floor", () => {
    const exercise = makeExercise({ reps: "12", weight: "20", sets: 3 })
    const lastPerformance = makeSets(3, 12, 20)
    const prescription = buildPrescription(exercise, lastPerformance, {
      measurementType: "reps",
      equipment: "dumbbell",
      weightUnit: "kg",
      lastSessionFinishedAt: "2026-05-01T00:00:00Z",
    })!

    expect(prescription.loadLadder).toContain(25)

    const result = computeNextSessionTarget(prescription, lastPerformance)!

    expect(result.rule).toBe("WEIGHT_UP")
    expect(result.weight).toBe(25) // not 22.5
    expect(result.reps).toBe(prescription.volume.min)
  })

  it("prescribes no load outside the ladder — the inherited increment is the fallback", () => {
    const exercise = makeExercise({ reps: "12", weight: "30", sets: 3 })
    const lastPerformance = makeSets(3, 12, 30)
    const prescription = buildPrescription(exercise, lastPerformance, {
      measurementType: "reps",
      equipment: "bodyweight",
      weightUnit: "kg",
      lastSessionFinishedAt: "2026-05-01T00:00:00Z",
    })!

    expect(prescription.loadLadder).toBeNull()

    const result = computeNextSessionTarget(prescription, lastPerformance)!

    expect(result.rule).toBe("WEIGHT_UP")
    expect(result.weight).toBe(32.5)
  })

  it("a duration exercise resolves no ladder — today's behaviour is unchanged", () => {
    const exercise = makeExercise({
      reps: "0",
      weight: "0",
      sets: 3,
      target_duration_seconds: 30,
      duration_range_min_seconds: 20,
      duration_range_max_seconds: 40,
      duration_increment_seconds: 5,
    })
    const prescription = buildPrescription(exercise, makeDurationSets(3, 40), {
      measurementType: "duration",
      equipment: "dumbbell",
      weightUnit: "kg",
      lastSessionFinishedAt: "2026-05-01T00:00:00Z",
    })!

    expect(prescription.loadLadder).toBeNull()
  })

  it("an athlete in lbs at 45 lb gets the exact 50 lb rung", () => {
    const kg45 = 45 / 2.20462
    const exercise = makeExercise({ reps: "12", weight: String(kg45), sets: 3 })
    const lastPerformance = makeSets(3, 12, kg45)
    const prescription = buildPrescription(exercise, lastPerformance, {
      measurementType: "reps",
      equipment: "dumbbell",
      weightUnit: "lbs",
      lastSessionFinishedAt: "2026-05-01T00:00:00Z",
    })!

    const result = computeNextSessionTarget(prescription, lastPerformance)!

    expect(result.rule).toBe("WEIGHT_UP")
    expect(result.weight * 2.20462).toBeCloseTo(50, 2)
  })

  it("defaults to kg when no unit is passed — existing callers are untouched", () => {
    const exercise = makeExercise({ reps: "12", weight: "20", sets: 3 })
    const prescription = buildPrescription(exercise, null, {
      equipment: "dumbbell",
    })!

    expect(prescription.loadLadder).toEqual(
      resolveLoadLadder("dumbbell", "kg"),
    )
  })
})

describe("load jump refusal (T310)", () => {
  const DUMBBELL_KG = resolveLoadLadder("dumbbell", "kg")!
  // A poor gym: nothing between 20 and 30 — the +50 % step we must refuse.
  const POOR_LADDER = [10, 20, 30, 40]

  const atCeiling = (overrides: Partial<ProgressionPrescription>) =>
    makePrescription({
      volume: makeVolume({ current: 12, min: 8, max: 12 }),
      currentWeight: 20,
      loadLadder: DUMBBELL_KG,
      ...overrides,
    })

  it("accepts the +25 % dumbbell step — 20 kg → 25 kg stays WEIGHT_UP", () => {
    const result = computeNextSessionTarget(atCeiling({}), makeSets(3, 12, 20))!

    expect(result.rule).toBe("WEIGHT_UP")
    expect(result.weight).toBe(25)
  })

  it("refuses a +35 % step — pins the threshold, it is not looser than 30 %", () => {
    const rx = atCeiling({ loadLadder: [20, 27] })
    const result = computeNextSessionTarget(rx, makeSets(3, 12, 20))!

    expect(result.rule).toBe("SETS_UP")
    expect(result.weight).toBe(20)
  })

  it("reports the load delta raw, so the pill renders the exact lbs step", () => {
    // 45 → 50 lb is 2.2679… kg. Pre-rounding it to 2.3 kg made the pill read
    // "+5.1 lbs" for a 5 lb rung, because the pill converts then rounds.
    const currentKg = 45 * 0.453592
    const rx = makePrescription({
      volume: makeVolume({ current: 12, min: 8, max: 12 }),
      currentWeight: currentKg,
      loadLadder: resolveLoadLadder("dumbbell", "lbs")!,
    })
    const result = computeNextSessionTarget(rx, makeSets(3, 12, currentKg))!

    expect(result.rule).toBe("WEIGHT_UP")
    expect(result.weight).toBeCloseTo(50 * 0.453592, 4)
    expect(Number(result.delta)).toBeCloseTo(50 * 0.453592 - currentKg, 4)
  })

  it("refuses a +50 % step — 20 kg → 30 kg produces no WEIGHT_UP", () => {
    const rx = atCeiling({ loadLadder: POOR_LADDER })
    const result = computeNextSessionTarget(rx, makeSets(3, 12, 20))!

    expect(result.rule).not.toBe("WEIGHT_UP")
    expect(result.weight).toBe(20)
  })

  it("a refused jump escalates to SETS_UP at the same load when sets remain", () => {
    const rx = atCeiling({ loadLadder: POOR_LADDER, currentSets: 3, setRangeMax: 5 })
    const result = computeNextSessionTarget(rx, makeSets(3, 12, 20))!

    expect(result.rule).toBe("SETS_UP")
    expect(result.weight).toBe(20)
    expect(result.sets).toBe(4)
    expect(result.reasonKey).toBe("progression.setsUp")
  })

  it("a refused jump at the set ceiling plateaus", () => {
    const rx = atCeiling({ loadLadder: POOR_LADDER, currentSets: 5, setRangeMax: 5 })
    const result = computeNextSessionTarget(rx, makeSets(5, 12, 20))!

    expect(result.rule).toBe("PLATEAU")
    expect(result.weight).toBe(20)
  })

  it("leaves the Stall → Deload hand-off untouched — a real stall still deloads", () => {
    const rx = atCeiling({ loadLadder: POOR_LADDER, currentSets: 5, setRangeMax: 5 })
    const stallHistory: SlotSessionSummary[] = Array.from(
      { length: STALL_SESSIONS },
      (_, i) => ({
        sessionFinishedAt: `2026-05-0${i + 1}T00:00:00Z`,
        prescribedReps: 12,
        anchorReps: 12,
        prescribedWeight: 20,
        avgRir: i === STALL_SESSIONS - 1 ? 1 : 2,
      }),
    )

    const result = computeNextSessionTarget(rx, makeSets(5, 12, 20), {
      stallHistory,
    })!

    expect(result.rule).toBe("DELOAD")
  })

  it("maxWeightReached still wins over an acceptable ladder step", () => {
    const rx = atCeiling({ maxWeightReached: true, currentSets: 3, setRangeMax: 5 })
    const result = computeNextSessionTarget(rx, makeSets(3, 12, 20))!

    expect(result.rule).toBe("SETS_UP")
    expect(result.weight).toBe(20)
  })

  it("without a ladder the inherited increment is prescribed, never refused", () => {
    const rx = atCeiling({ loadLadder: null, weightIncrement: 2.5 })
    const result = computeNextSessionTarget(rx, makeSets(3, 12, 20))!

    expect(result.rule).toBe("WEIGHT_UP")
    expect(result.weight).toBe(22.5)
  })

  it("a step off zero is refused — loadJumpRatio is Infinity", () => {
    const rx = atCeiling({ currentWeight: 0, currentSets: 3, setRangeMax: 5 })
    const result = computeNextSessionTarget(rx, makeSets(3, 12, 0))!

    expect(result.rule).toBe("SETS_UP")
    expect(result.weight).toBe(0)

    const maxedRx = atCeiling({ currentWeight: 0, currentSets: 5, setRangeMax: 5 })
    expect(computeNextSessionTarget(maxedRx, makeSets(5, 12, 0))!.rule).toBe(
      "PLATEAU",
    )
  })
})

