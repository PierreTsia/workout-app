export type ProgressionRule =
  | "HOLD_INCOMPLETE"
  | "HOLD_NEAR_FAILURE"
  | "REPS_UP"
  | "WEIGHT_UP"
  | "SETS_UP"
  | "PLATEAU"

export interface ProgressionPrescription {
  currentReps: number
  currentWeight: number
  currentSets: number
  repRangeMin: number
  repRangeMax: number
  setRangeMin: number
  setRangeMax: number
  weightIncrement: number
  maxWeightReached: boolean
}

export interface SetPerformance {
  reps: number
  weight: number
  completed: boolean
  rir: number | null
}

export interface ProgressionSuggestion {
  rule: ProgressionRule
  reps: number
  weight: number
  sets: number
  reasonKey: string
  delta: string
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

  const { currentReps, currentWeight, currentSets } = prescription
  const { repRangeMin, repRangeMax, setRangeMax, maxWeightReached, weightIncrement } =
    prescription

  const completedSets = lastPerformance.filter((s) => s.completed)
  const allCompleted = completedSets.length >= currentSets

  if (!allCompleted) {
    return {
      rule: "HOLD_INCOMPLETE",
      reps: currentReps,
      weight: currentWeight,
      sets: currentSets,
      reasonKey: "progression.holdIncomplete",
      delta: "—",
    }
  }

  const avgRir = averageRir(completedSets)
  if (avgRir != null && avgRir < RIR_SAFETY_THRESHOLD) {
    return {
      rule: "HOLD_NEAR_FAILURE",
      reps: currentReps,
      weight: currentWeight,
      sets: currentSets,
      reasonKey: "progression.holdNearFailure",
      delta: "—",
    }
  }

  const allHitTargetReps = completedSets.every((s) => s.reps >= currentReps)

  if (!allHitTargetReps) {
    return {
      rule: "HOLD_INCOMPLETE",
      reps: currentReps,
      weight: currentWeight,
      sets: currentSets,
      reasonKey: "progression.holdIncomplete",
      delta: "—",
    }
  }

  const allAtMaxReps = completedSets.every((s) => s.reps >= repRangeMax)

  if (!allAtMaxReps) {
    const nextReps = Math.min(currentReps + 1, repRangeMax)
    return {
      rule: "REPS_UP",
      reps: nextReps,
      weight: currentWeight,
      sets: currentSets,
      reasonKey: "progression.repsUp",
      delta: `+1 rep`,
    }
  }

  if (!maxWeightReached) {
    const nextWeight = currentWeight + weightIncrement
    return {
      rule: "WEIGHT_UP",
      reps: repRangeMin,
      weight: nextWeight,
      sets: currentSets,
      reasonKey: "progression.weightUp",
      delta: `+${weightIncrement}kg`,
    }
  }

  if (currentSets < setRangeMax) {
    return {
      rule: "SETS_UP",
      reps: repRangeMin,
      weight: currentWeight,
      sets: currentSets + 1,
      reasonKey: "progression.setsUp",
      delta: `+1 set`,
    }
  }

  return {
    rule: "PLATEAU",
    reps: currentReps,
    weight: currentWeight,
    sets: currentSets,
    reasonKey: "progression.plateau",
    delta: "—",
  }
}
