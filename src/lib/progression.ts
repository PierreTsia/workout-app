import type { WorkoutExercise } from "@/types/database"

export type ProgressionRule =
  | "HOLD_INCOMPLETE"
  | "HOLD_NEAR_FAILURE"
  | "REPS_UP"
  | "DURATION_UP"
  | "WEIGHT_UP"
  | "SETS_UP"
  | "PLATEAU"

export interface VolumePrescription {
  type: "reps" | "duration"
  current: number
  min: number
  max: number
  increment: number
}

export interface ProgressionPrescription {
  volume: VolumePrescription
  currentWeight: number
  currentSets: number
  setRangeMin: number
  setRangeMax: number
  weightIncrement: number
  maxWeightReached: boolean
  /** @deprecated Use volume.current — kept for backward compat */
  currentReps: number
  /** @deprecated Use volume.min */
  repRangeMin: number
  /** @deprecated Use volume.max */
  repRangeMax: number
}

export interface SetPerformance {
  reps: number
  weight: number
  completed: boolean
  rir: number | null
  durationSeconds?: number
  /**
   * Prescription Snapshot — the engine's pristine target for this set at session-start.
   * Source of `volume.current` / `currentSets` / `currentWeight` for subsequent sessions
   * when the **Manual Override Window** is closed. NULL on legacy rows pre-migration. See ADR 0006.
   */
  prescribedReps?: number | null
  prescribedWeight?: number | null
  prescribedSets?: number | null
  prescribedDurationSeconds?: number | null
}

export interface ProgressionSuggestion {
  rule: ProgressionRule
  reps: number
  weight: number
  sets: number
  reasonKey: string
  delta: string
  volumeType: "reps" | "duration"
  duration?: number
}

const DEFAULT_INCREMENT_KG = 2.5
const DUMBBELL_INCREMENT_KG = 2.0
const RIR_SAFETY_THRESHOLD = 1

const DEFAULT_DURATION_SECONDS = 30
const DURATION_BAND_LOW = 10
const DURATION_BAND_HIGH = 15
const DEFAULT_DURATION_INCREMENT = 5

export function resolveWeightIncrement(
  userIncrement: number | null | undefined,
  equipment?: string,
): number {
  if (userIncrement != null && userIncrement > 0) return userIncrement
  return equipment === "dumbbell" ? DUMBBELL_INCREMENT_KG : DEFAULT_INCREMENT_KG
}

export interface BuildPrescriptionOptions {
  measurementType?: "reps" | "duration"
  equipment?: string
  catalogExercise?: { default_duration_seconds?: number | null } | null
  /**
   * ISO timestamp of the most recent session that logged this exercise.
   * Compared against `exercise.template_updated_at` to decide whether the
   * **Manual Override Window** is open: if the user edited the template
   * since their last session, the engine reads from **Template Prescription**
   * (today's path). Otherwise it reads from the **Prescription Snapshot** on
   * the last session's set logs. See ADR 0006.
   */
  lastSessionFinishedAt?: string | null
}

export function buildPrescription(
  exercise: WorkoutExercise,
  lastPerformance: SetPerformance[] | null,
  options: BuildPrescriptionOptions,
): ProgressionPrescription | null {
  const { measurementType, equipment, catalogExercise, lastSessionFinishedAt } = options
  const isDuration = measurementType === "duration"

  // Manual Override Window: when the user edited the template since the last
  // session's finish, the snapshot is stale by definition — fall through to
  // template values. See ADR 0006.
  const useSnapshot =
    lastPerformance != null &&
    lastPerformance.length > 0 &&
    lastSessionFinishedAt != null &&
    new Date(exercise.template_updated_at) <= new Date(lastSessionFinishedAt)

  let volume: VolumePrescription

  if (isDuration) {
    const snapshotDuration = useSnapshot
      ? lastPerformance[0].prescribedDurationSeconds
      : null
    const target =
      snapshotDuration ??
      exercise.target_duration_seconds ??
      catalogExercise?.default_duration_seconds ??
      DEFAULT_DURATION_SECONDS
    volume = {
      type: "duration",
      current: target,
      min: exercise.duration_range_min_seconds ?? Math.max(5, target - DURATION_BAND_LOW),
      max: exercise.duration_range_max_seconds ?? target + DURATION_BAND_HIGH,
      increment: exercise.duration_increment_seconds ?? DEFAULT_DURATION_INCREMENT,
    }
  } else {
    const snapshotReps = useSnapshot ? lastPerformance[0].prescribedReps : null
    let currentReps: number
    if (snapshotReps != null) {
      currentReps = snapshotReps
    } else {
      currentReps = parseInt(exercise.reps, 10)
      if (isNaN(currentReps)) {
        const inferredReps = lastPerformance?.[0]?.reps
        if (!inferredReps || inferredReps <= 0) return null
        currentReps = inferredReps
      }
    }
    volume = {
      type: "reps",
      current: currentReps,
      min: exercise.rep_range_min ?? Math.max(1, currentReps - 2),
      max: exercise.rep_range_max ?? currentReps + 2,
      increment: 1,
    }
  }

  const templateWeight = Number(exercise.weight) || 0
  const lastSessionWeight = lastPerformance?.[0]?.weight ?? 0
  const currentWeight = lastSessionWeight > 0 ? lastSessionWeight : templateWeight

  const snapshotSets = useSnapshot ? lastPerformance[0].prescribedSets : null
  const currentSets = snapshotSets ?? exercise.sets

  return {
    volume,
    currentWeight,
    currentSets,
    setRangeMin: exercise.set_range_min ?? Math.max(1, currentSets - 1),
    setRangeMax: exercise.set_range_max ?? Math.min(6, currentSets + 2),
    weightIncrement: resolveWeightIncrement(exercise.weight_increment ?? null, equipment),
    maxWeightReached: exercise.max_weight_reached ?? false,
    currentReps: volume.type === "reps" ? volume.current : 0,
    repRangeMin: volume.type === "reps" ? volume.min : 0,
    repRangeMax: volume.type === "reps" ? volume.max : 0,
  }
}

function averageRir(sets: SetPerformance[]): number | null {
  const withRir = sets.filter((s) => s.completed && s.rir != null)
  if (withRir.length === 0) return null
  return withRir.reduce((sum, s) => sum + s.rir!, 0) / withRir.length
}

export function computeNextSessionTarget(
  prescription: ProgressionPrescription,
  lastPerformance: SetPerformance[] | null,
): ProgressionSuggestion | null {
  if (!lastPerformance || lastPerformance.length === 0) return null

  const { volume, currentWeight, currentSets } = prescription
  const { setRangeMax, maxWeightReached, weightIncrement } = prescription

  const volumeValue = (s: SetPerformance) =>
    volume.type === "duration" ? (s.durationSeconds ?? 0) : s.reps

  const volumeRule: "REPS_UP" | "DURATION_UP" =
    volume.type === "duration" ? "DURATION_UP" : "REPS_UP"

  const makeSuggestion = (
    rule: ProgressionRule,
    vol: number,
    weight: number,
    sets: number,
    reasonKey: string,
    delta: string,
  ): ProgressionSuggestion => ({
    rule,
    reps: volume.type === "reps" ? vol : 0,
    weight,
    sets,
    reasonKey,
    delta,
    volumeType: volume.type,
    duration: volume.type === "duration" ? vol : undefined,
  })

  const completedSets = lastPerformance.filter((s) => s.completed)
  const allCompleted = completedSets.length >= currentSets

  if (!allCompleted) {
    return makeSuggestion(
      "HOLD_INCOMPLETE",
      volume.current,
      currentWeight,
      currentSets,
      "progression.holdIncomplete",
      "—",
    )
  }

  const avgRir = averageRir(completedSets)
  if (avgRir != null && avgRir < RIR_SAFETY_THRESHOLD) {
    return makeSuggestion(
      "HOLD_NEAR_FAILURE",
      volume.current,
      currentWeight,
      currentSets,
      "progression.holdNearFailure",
      "—",
    )
  }

  const allHitTarget = completedSets.every((s) => volumeValue(s) >= volume.current)

  if (!allHitTarget) {
    return makeSuggestion(
      "HOLD_INCOMPLETE",
      volume.current,
      currentWeight,
      currentSets,
      "progression.holdIncomplete",
      "—",
    )
  }

  const allAtMax = completedSets.every((s) => volumeValue(s) >= volume.max)

  if (!allAtMax) {
    const nextVolume = Math.min(volume.current + volume.increment, volume.max)
    const actualDelta = nextVolume - volume.current
    const delta =
      volume.type === "duration"
        ? `+${actualDelta}s`
        : `+${actualDelta} rep`
    return makeSuggestion(
      volumeRule,
      nextVolume,
      currentWeight,
      currentSets,
      volume.type === "duration" ? "progression.durationUp" : "progression.repsUp",
      delta,
    )
  }

  if (!maxWeightReached) {
    const nextWeight = currentWeight + weightIncrement
    return makeSuggestion(
      "WEIGHT_UP",
      volume.min,
      nextWeight,
      currentSets,
      "progression.weightUp",
      String(weightIncrement),
    )
  }

  if (currentSets < setRangeMax) {
    return makeSuggestion(
      "SETS_UP",
      volume.min,
      currentWeight,
      currentSets + 1,
      "progression.setsUp",
      "+1 set",
    )
  }

  return makeSuggestion(
    "PLATEAU",
    volume.current,
    currentWeight,
    currentSets,
    "progression.plateau",
    "—",
  )
}
