import type { WorkoutExercise } from "@/types/database"

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type WeightUnit = "kg" | "lbs"

export interface IntraSessionSuggestion {
  weight: number
  reps: string
}

export type AdjustmentTier = "weight-first" | "reps-only"

export interface CompletedSetInfo {
  reps: number
  weight: number
  rir: number
}

export interface RepRange {
  min: number
  max: number
}

export interface IntraSessionContext {
  completedSets: CompletedSetInfo[]
  currentRir: number
  currentWeight: number
  currentReps: number
  targetRepRange: RepRange | null
  unit: WeightUnit
  equipment: string
  tier: AdjustmentTier
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_INCREMENT: Record<WeightUnit, number> = { kg: 2.5, lbs: 5 }
const DUMBBELL_INCREMENT: Record<WeightUnit, number> = { kg: 2, lbs: 5 }

const WEIGHT_FIRST_EQUIPMENT = new Set([
  "barbell",
  "dumbbell",
  "ez_bar",
  "machine",
  "bench",
  "kettlebell",
])

const REPS_ONLY_EQUIPMENT = new Set(["bodyweight", "cable", "band"])

const MAX_CASCADE_STEPS = 2
const PROPORTIONAL_DELOAD_FACTOR = 0.85

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function resolveIncrement(unit: WeightUnit, equipment?: string): number {
  return equipment === "dumbbell"
    ? DUMBBELL_INCREMENT[unit]
    : DEFAULT_INCREMENT[unit]
}

export function getAdjustmentTier(
  equipment: string,
  loggedWeight: number,
): AdjustmentTier {
  if (equipment === "bodyweight" && loggedWeight > 0) return "weight-first"
  if (REPS_ONLY_EQUIPMENT.has(equipment)) return "reps-only"
  if (WEIGHT_FIRST_EQUIPMENT.has(equipment)) return "weight-first"
  return "weight-first"
}

const RANGE_RE = /^(\d+)-(\d+)$/
const FIXED_RE = /^\d+$/

export function parseTargetRepRange(
  exercise: WorkoutExercise,
): RepRange | null {
  if (
    exercise.rep_range_min != null &&
    exercise.rep_range_max != null &&
    exercise.rep_range_min > 0 &&
    exercise.rep_range_max > 0
  ) {
    return { min: exercise.rep_range_min, max: exercise.rep_range_max }
  }

  const match = RANGE_RE.exec(exercise.reps)
  if (match) return { min: Number(match[1]), max: Number(match[2]) }

  if (FIXED_RE.test(exercise.reps)) {
    const n = Number(exercise.reps)
    return { min: n, max: n }
  }

  return null
}

export function detectFatigue(completedSets: CompletedSetInfo[]): boolean {
  if (completedSets.length < 2) return false
  let declining = 0
  for (let i = completedSets.length - 1; i > 0; i--) {
    if (completedSets[i].rir < completedSets[i - 1].rir) {
      declining++
    } else {
      break
    }
  }
  return declining >= 1 // 2+ sets showing a decline (1 transition = 2 sets)
}

// ---------------------------------------------------------------------------
// Effective RIR bucket (with fatigue shift)
// ---------------------------------------------------------------------------

type RirBucket = "failure" | "efficiency" | "undershoot"

function effectiveBucket(rir: number, fatigued: boolean): RirBucket {
  if (rir === 0) return "failure"
  if (rir <= 2) return fatigued ? "failure" : "efficiency"
  // rir >= 3
  return fatigued ? "efficiency" : "undershoot"
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

export function computeIntraSessionSuggestion(
  ctx: IntraSessionContext,
): IntraSessionSuggestion {
  const fatigued = detectFatigue(ctx.completedSets)
  const bucket = effectiveBucket(ctx.currentRir, fatigued)
  const shortfall =
    ctx.targetRepRange != null && ctx.currentReps < ctx.targetRepRange.min
  const inc = resolveIncrement(ctx.unit, ctx.equipment)

  if (ctx.tier === "reps-only") {
    return repsOnlyRule(ctx, bucket, shortfall)
  }
  return weightFirstRule(ctx, bucket, shortfall, inc)
}

// ---------------------------------------------------------------------------
// Weight-first rule table
// ---------------------------------------------------------------------------

function weightFirstRule(
  ctx: IntraSessionContext,
  bucket: RirBucket,
  shortfall: boolean,
  inc: number,
): IntraSessionSuggestion {
  const w = ctx.currentWeight
  const reps = ctx.currentReps

  switch (bucket) {
    case "failure": {
      const newWeight = w <= 0 ? 0 : Math.max(inc, w - inc)
      return {
        weight: newWeight,
        reps: shortfall ? String(reps) : String(reps),
      }
    }
    case "efficiency":
      return { weight: w, reps: String(reps) }
    case "undershoot":
      if (shortfall) {
        return { weight: w, reps: String(reps) }
      }
      return { weight: w + inc, reps: String(reps) }
  }
}

// ---------------------------------------------------------------------------
// Reps-only rule table
// ---------------------------------------------------------------------------

function repsOnlyRule(
  ctx: IntraSessionContext,
  bucket: RirBucket,
  shortfall: boolean,
): IntraSessionSuggestion {
  const w = ctx.currentWeight
  const reps = ctx.currentReps

  switch (bucket) {
    case "failure": {
      if (shortfall) {
        return { weight: w, reps: String(reps) }
      }
      const deloaded = Math.round(reps * PROPORTIONAL_DELOAD_FACTOR)
      const newReps = Math.max(1, Math.min(deloaded, reps - 1))
      return { weight: w, reps: String(newReps) }
    }
    case "efficiency":
      return { weight: w, reps: String(reps) }
    case "undershoot": {
      if (shortfall) {
        return { weight: w, reps: String(reps) }
      }
      const maxReps = ctx.targetRepRange?.max
      const bumped = reps + 1
      const capped = maxReps != null ? Math.min(bumped, maxReps) : bumped
      return { weight: w, reps: String(capped) }
    }
  }
}

// ---------------------------------------------------------------------------
// Cascade
// ---------------------------------------------------------------------------

export function computeCascadeSuggestions(
  completedSets: CompletedSetInfo[],
  remainingCount: number,
  targetRepRange: RepRange | null,
  unit: WeightUnit,
  equipment: string,
): IntraSessionSuggestion[] {
  if (completedSets.length === 0 || remainingCount <= 0) return []

  const last = completedSets[completedSets.length - 1]
  const originalWeight = last.weight
  const inc = resolveIncrement(unit, equipment)
  const tier = getAdjustmentTier(equipment, originalWeight)

  const fatigued = detectFatigue(completedSets)
  const bucket = effectiveBucket(last.rir, fatigued)
  const effectiveRir =
    bucket === "failure" ? 0 : bucket === "efficiency" ? 2 : 3

  let previousWeight = last.weight
  let previousReps = last.reps
  let deloadSteps = 0
  const results: IntraSessionSuggestion[] = []

  for (let i = 0; i < remainingCount; i++) {
    const suggestion = computeIntraSessionSuggestion({
      completedSets,
      currentRir: effectiveRir,
      currentWeight: previousWeight,
      currentReps: previousReps,
      targetRepRange,
      unit,
      equipment,
      tier,
    })

    results.push(suggestion)

    const suggestedReps = parseInt(suggestion.reps, 10) || previousReps
    const isDeload =
      suggestion.weight < previousWeight || suggestedReps < previousReps

    if (isDeload) {
      deloadSteps++
      const totalWeightDrop = originalWeight - suggestion.weight
      if (
        deloadSteps >= MAX_CASCADE_STEPS ||
        totalWeightDrop >= inc * MAX_CASCADE_STEPS
      ) {
        for (let j = i + 1; j < remainingCount; j++) {
          results.push(suggestion)
        }
        break
      }
      previousWeight = suggestion.weight
      previousReps = suggestedReps
      continue
    }

    // Hold or increase — apply to all remaining and stop
    for (let j = i + 1; j < remainingCount; j++) {
      results.push(suggestion)
    }
    break
  }

  return results
}

