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

export function resolveWeightIncrement(
  userIncrement: number | null | undefined,
  equipment?: string,
): number {
  if (userIncrement != null && userIncrement > 0) return userIncrement
  return equipment === "dumbbell" ? DUMBBELL_INCREMENT_KG : DEFAULT_INCREMENT_KG
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
    const delta =
      volume.type === "duration"
        ? `+${volume.increment}s`
        : `+${volume.increment} rep`
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
