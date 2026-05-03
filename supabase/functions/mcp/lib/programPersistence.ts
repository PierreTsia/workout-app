/**
 * Port of `file:src/lib/programPersistence.ts` for Edge — keep in sync with the web module.
 * Parity: run `npx vitest run src/lib/programPersistence.test.ts` after edits; optionally
 * `deno test supabase/functions/mcp/lib/programPersistence_test.ts` (mirrors key cases).
 */

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

export interface CatalogExerciseForProgram {
  id: string
  name: string
  muscle_group: string
  emoji: string | null
  equipment: string
  measurement_type?: "reps" | "duration" | null
  default_duration_seconds?: number | null
}

export interface GeneratedExerciseForProgram {
  exercise: CatalogExerciseForProgram
  sets: number
  reps: string
  restSeconds: number
  isCompound: boolean
  /**
   * Optional explicit prescription weight for object-form MCP `create_program`
   * (T74). Bare-string callers do NOT set this — fallback uses "0".
   * Persisted verbatim to `workout_exercises.weight` (TEXT column).
   */
  weightKg?: number
  /**
   * Optional explicit reps-range bounds for freezing progression on weighted
   * reps prescriptions (T74). Both must be set together. Bodyweight branch
   * IGNORES these (T75 enforces the always-auto-derive rule).
   */
  repRangeMin?: number
  repRangeMax?: number
  /**
   * Optional explicit set-range bounds for freezing progression. Same all-or-
   * nothing semantics as repRangeMin/Max.
   */
  setRangeMin?: number
  setRangeMax?: number
  /**
   * Optional explicit duration target for object-form duration prescriptions
   * (T75). Reps-mode exercises must reject this via cross-field validation
   * before reaching the persistence layer.
   */
  targetDurationSeconds?: number
}

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
  dayExercises: GeneratedExerciseForProgram[],
): WorkoutExerciseProgramInsertRow[] {
  return dayExercises.map((ge, idx) =>
    buildWorkoutExerciseInsertRow(workoutDayId, ge, idx),
  )
}

function buildWorkoutExerciseInsertRow(
  workoutDayId: string,
  ge: GeneratedExerciseForProgram,
  sortOrder: number,
): WorkoutExerciseProgramInsertRow {
  const isDuration = ge.exercise.measurement_type === "duration"
  const isBodyweight = ge.exercise.equipment === "bodyweight"
  const defaultSec = ge.exercise.default_duration_seconds ?? 30
  const repsNum = parseInt(ge.reps, 10)

  // T74: explicit-ranges branch only fires for non-bodyweight, non-duration
  // reps exercises. Bodyweight (T75) and duration (T75) get their own branches
  // ahead of this one. Bare-string callers leave the optional fields undefined
  // so legacy behavior is preserved verbatim.
  const hasExplicitRanges =
    !isBodyweight &&
    !isDuration &&
    ge.repRangeMin !== undefined &&
    ge.repRangeMax !== undefined &&
    ge.setRangeMin !== undefined &&
    ge.setRangeMax !== undefined

  const weightStr = !isBodyweight && ge.weightKg !== undefined ? String(ge.weightKg) : "0"

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
    target_duration_seconds: isDuration ? defaultSec : null,
    rep_range_min: hasExplicitRanges
      ? ge.repRangeMin!
      : Number.isNaN(repsNum) ? 8 : Math.max(1, repsNum - 2),
    rep_range_max: hasExplicitRanges
      ? ge.repRangeMax!
      : Number.isNaN(repsNum) ? 12 : repsNum + 2,
    set_range_min: hasExplicitRanges ? ge.setRangeMin! : Math.max(1, ge.sets - 1),
    set_range_max: hasExplicitRanges ? ge.setRangeMax! : Math.min(6, ge.sets + 2),
    max_weight_reached: isBodyweight,
    duration_range_min_seconds: isDuration ? Math.max(5, defaultSec - 10) : null,
    duration_range_max_seconds: isDuration ? defaultSec + 15 : null,
    duration_increment_seconds: isDuration ? 5 : null,
  }
}
