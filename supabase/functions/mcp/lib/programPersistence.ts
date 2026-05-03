/**
 * Port of `file:src/lib/programPersistence.ts` for Edge — keep in sync with the web module.
 * Parity: run `npx vitest run src/lib/programPersistence.test.ts` after edits; optionally
 * `deno test supabase/functions/mcp/lib/programPersistence_test.ts` (mirrors key cases).
 *
 * Types-pure by design: this module MUST NOT import `supabase-js` (Edge-only
 * apply helpers live in `applyDayUpdate.ts`). The Deno CI typecheck on
 * `lib/*_test.ts` walks transitive type imports; reaching a `SupabaseClient`
 * reference here would drag in `@types/node` and break the Node-less runner.
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

