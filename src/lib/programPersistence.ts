import type { GeneratedExercise } from "@/types/generator"

/** Emojis assigned to each program day index when persisting AI-generated programs (matches UI preview). */
export const AI_PROGRAM_DAY_EMOJIS = ["💪", "🔥", "⚡", "🏋️", "🎯", "🚀"] as const

export function dayEmojiForProgramDayIndex(dayIndex: number): string {
  return AI_PROGRAM_DAY_EMOJIS[dayIndex % AI_PROGRAM_DAY_EMOJIS.length]
}

/**
 * Parse a reps prescription string into bounds. Accepts "N" (linear, min === max)
 * or "N-M" (double progression, requires M >= N >= 0). Throws on any other shape so
 * callers must validate with the same regex `/^\d+(-\d+)?$/` upstream when handling
 * untrusted input (e.g. MCP create_program object form).
 */
export function parseRepsBounds(reps: string): { min: number; max: number } {
  const match = reps.match(/^(\d+)(?:-(\d+))?$/)
  if (!match) {
    throw new Error(`Invalid reps format: "${reps}". Expected "N" or "N-M".`)
  }
  const min = parseInt(match[1], 10)
  const max = match[2] !== undefined ? parseInt(match[2], 10) : min
  if (max < min) {
    throw new Error(`Invalid reps range: "${reps}". Max (${max}) < min (${min}).`)
  }
  return { min, max }
}

/** Row shape passed to `supabase.from("workout_exercises").insert(...)` when creating a program from AI preview. */
export interface WorkoutExerciseProgramInsertRow {
  workout_day_id: string
  exercise_id: string
  name_snapshot: string
  muscle_snapshot: string
  emoji_snapshot: string
  sets: number
  reps: string
  weight: string
  rest_seconds: number
  sort_order: number
  target_duration_seconds: number | null
  rep_range_min: number
  rep_range_max: number
  set_range_min: number
  set_range_max: number
  max_weight_reached: boolean
  duration_range_min_seconds: number | null
  duration_range_max_seconds: number | null
  duration_increment_seconds: number | null
}

export function buildWorkoutExerciseInsertRowsForDay(
  workoutDayId: string,
  dayExercises: GeneratedExercise[],
): WorkoutExerciseProgramInsertRow[] {
  return dayExercises.map((ge, idx) =>
    buildWorkoutExerciseInsertRow(workoutDayId, ge, idx),
  )
}

function buildWorkoutExerciseInsertRow(
  workoutDayId: string,
  ge: GeneratedExercise,
  sortOrder: number,
): WorkoutExerciseProgramInsertRow {
  const isDuration = ge.exercise.measurement_type === "duration"
  const isBodyweight = ge.exercise.equipment === "bodyweight"
  const defaultSec = ge.exercise.default_duration_seconds ?? 30
  const repsNum = parseInt(ge.reps, 10)

  // T74: explicit-ranges branch only fires for non-bodyweight, non-duration
  // reps exercises. Bodyweight short-circuits to legacy auto-derive (T75 also
  // verifies persistence is the safety net when handler validation is bypassed).
  // Duration exercises with explicit targetDurationSeconds get their own freeze
  // semantics for duration_range_min/max_seconds (T75).
  const hasExplicitRanges =
    !isBodyweight &&
    !isDuration &&
    ge.repRangeMin !== undefined &&
    ge.repRangeMax !== undefined &&
    ge.setRangeMin !== undefined &&
    ge.setRangeMax !== undefined

  const weightStr = !isBodyweight && ge.weightKg !== undefined ? String(ge.weightKg) : "0"

  // T75: when the agent supplies an explicit targetDurationSeconds on a
  // duration exercise, freeze duration_range_min/max_seconds to that value so
  // the progression engine treats it as a fixed prescription. Bare-string and
  // legacy callers leave targetDurationSeconds undefined → fall through to the
  // pre-T75 auto-derive (defaultSec - 10 / defaultSec + 15).
  const useExplicitDuration =
    isDuration && ge.targetDurationSeconds !== undefined && ge.targetDurationSeconds !== null
  const effectiveDurationSec = useExplicitDuration ? ge.targetDurationSeconds! : defaultSec

  return {
    workout_day_id: workoutDayId,
    exercise_id: ge.exercise.id,
    name_snapshot: ge.exercise.name,
    muscle_snapshot: ge.exercise.muscle_group,
    emoji_snapshot: ge.exercise.emoji ?? "🏋️",
    sets: ge.sets,
    reps: isDuration ? "0" : ge.reps,
    weight: weightStr,
    rest_seconds: ge.restSeconds,
    sort_order: sortOrder,
    target_duration_seconds: isDuration ? effectiveDurationSec : null,
    rep_range_min: hasExplicitRanges
      ? ge.repRangeMin!
      : Number.isNaN(repsNum) ? 8 : Math.max(1, repsNum - 2),
    rep_range_max: hasExplicitRanges
      ? ge.repRangeMax!
      : Number.isNaN(repsNum) ? 12 : repsNum + 2,
    set_range_min: hasExplicitRanges ? ge.setRangeMin! : Math.max(1, ge.sets - 1),
    set_range_max: hasExplicitRanges ? ge.setRangeMax! : Math.min(6, ge.sets + 2),
    max_weight_reached: isBodyweight,
    duration_range_min_seconds: !isDuration
      ? null
      : useExplicitDuration
        ? effectiveDurationSec
        : Math.max(5, defaultSec - 10),
    duration_range_max_seconds: !isDuration
      ? null
      : useExplicitDuration
        ? effectiveDurationSec
        : defaultSec + 15,
    duration_increment_seconds: isDuration ? 5 : null,
  }
}
