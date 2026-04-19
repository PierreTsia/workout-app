import type { GeneratedExercise } from "@/types/generator"

/** Emojis assigned to each program day index when persisting AI-generated programs (matches UI preview). */
export const AI_PROGRAM_DAY_EMOJIS = ["💪", "🔥", "⚡", "🏋️", "🎯", "🚀"] as const

export function dayEmojiForProgramDayIndex(dayIndex: number): string {
  return AI_PROGRAM_DAY_EMOJIS[dayIndex % AI_PROGRAM_DAY_EMOJIS.length]
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

  return {
    workout_day_id: workoutDayId,
    exercise_id: ge.exercise.id,
    name_snapshot: ge.exercise.name,
    muscle_snapshot: ge.exercise.muscle_group,
    emoji_snapshot: ge.exercise.emoji ?? "🏋️",
    sets: ge.sets,
    reps: isDuration ? "0" : ge.reps,
    weight: "0",
    rest_seconds: ge.restSeconds,
    sort_order: sortOrder,
    target_duration_seconds: isDuration ? defaultSec : null,
    rep_range_min: Number.isNaN(repsNum) ? 8 : Math.max(1, repsNum - 2),
    rep_range_max: Number.isNaN(repsNum) ? 12 : repsNum + 2,
    set_range_min: Math.max(1, ge.sets - 1),
    set_range_max: Math.min(6, ge.sets + 2),
    max_weight_reached: isBodyweight,
    duration_range_min_seconds: isDuration ? Math.max(5, defaultSec - 10) : null,
    duration_range_max_seconds: isDuration ? defaultSec + 15 : null,
    duration_increment_seconds: isDuration ? 5 : null,
  }
}
