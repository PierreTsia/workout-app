import { describe, it, expect } from "vitest"
import {
  buildPrescription,
  computeNextSessionTarget,
  resolveWeightIncrement,
  type ProgressionPrescription,
  type SetPerformance,
  type VolumePrescription,
} from "./progression"
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

  // Weight axis: same Prescription Snapshot semantics. The override window
  // must let manual Builder edits to weight win (deload / return-from-injury).
  // Today's code ignores both prescribedWeight and the override window — it
  // always prefers lastPerformance[0].weight. See ADR 0006.
  it("snapshot path: currentWeight comes from prescribedWeight, not from logged weight", () => {
    const exercise = makeExercise({
      reps: "10",
      weight: "60", // drifted post-bump
      sets: 3,
      template_updated_at: "2026-01-01T00:00:00Z",
    })

    // Last session: prescribed 50, user actually loaded 55 (typo / impromptu bump).
    // Snapshot must win — engine's currentWeight = 50, not 55.
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

    expect(prescription.currentWeight).toBe(50) // snapshot wins
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
})
