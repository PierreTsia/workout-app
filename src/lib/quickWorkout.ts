// PWA → MCP shape adapter for Quick Workout AI commits (T128, #342).
//
// Why this exists: the AI generator produces a rich `GeneratedExercise`
// shape with sets / reps / rest / weight / duration. The MCP
// `create_workout_day` tool accepts either bare UUIDs (defaults applied)
// OR an object form that preserves the prescription. We always pick the
// object form so the day persisted by /commit-quick-workout matches the
// preview the user just saw — bare strings would silently rewrite to
// "3 sets, 10 reps, 90s rest" defaults.
//
// Validation rules we mirror locally so we never POST a payload that
// MCP will reject:
//   R1: bodyweight → weight_kg MUST be 0 (no weighted-bodyweight in v0.3.0).
//   R5: duration exercises → target_duration_seconds REQUIRED, reps "0".
//
// Falling back to the catalog `default_duration_seconds` (and finally to
// 30s) keeps duration entries valid even when the AI generator forgets
// the field — same defensive default the persistence layer applies today.

import type { GeneratedExercise } from "@/types/generator"

const FALLBACK_DURATION_SECONDS = 30

export interface McpWorkoutDayExercise {
  exercise_id: string
  sets: number
  reps: string
  weight_kg: number
  rest_seconds: number
  target_duration_seconds?: number
}

export function workoutToMcpExercises(
  exercises: GeneratedExercise[],
): McpWorkoutDayExercise[] {
  return exercises.map(toMcpExercise)
}

function toMcpExercise(ge: GeneratedExercise): McpWorkoutDayExercise {
  const isBodyweight = ge.exercise.equipment === "bodyweight"
  const isDuration = ge.exercise.measurement_type === "duration"

  const base: McpWorkoutDayExercise = {
    exercise_id: ge.exercise.id,
    sets: ge.sets,
    reps: ge.reps,
    weight_kg: isBodyweight ? 0 : (ge.weightKg ?? 0),
    rest_seconds: ge.restSeconds,
  }

  if (isDuration) {
    base.target_duration_seconds =
      ge.targetDurationSeconds ??
      ge.exercise.default_duration_seconds ??
      FALLBACK_DURATION_SECONDS
  }

  return base
}
