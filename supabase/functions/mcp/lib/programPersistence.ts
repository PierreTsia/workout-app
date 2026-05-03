/**
 * Port of `file:src/lib/programPersistence.ts` for Edge — keep in sync with the web module.
 * Parity: run `npx vitest run src/lib/programPersistence.test.ts` after edits; optionally
 * `deno test supabase/functions/mcp/lib/programPersistence_test.ts` (mirrors key cases).
 *
 * NOTE: the `applyDayUpdate` helper at the bottom is Edge-only — it has no
 * web mirror by design (T80, Tech Plan: `update_program` is MCP-only).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.103.3"
import type { ParsedExercise } from "./createProgramValidation.ts"

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

/**
 * Defaults applied to bare-string entries that lack an explicit prescription.
 * Mirror of `createProgram.ts` constants — duplicated intentionally to keep
 * `applyDayUpdate` self-contained on the Edge side.
 */
const APPLY_DEFAULT_SETS = 3
const APPLY_DEFAULT_REPS = "10"
const APPLY_DEFAULT_REST_SECONDS = 90

/**
 * Build the `GeneratedExerciseForProgram` shape for an `update_program` apply
 * step. Mirror of the equivalent helper in `tools/createProgram.ts` —
 * duplicated intentionally to keep the apply pipeline self-contained on the
 * Edge side (no cross-tool import). Throws on catalog miss; callers MUST
 * pre-flight via `catalogById.has(...)`.
 */
export function parsedExerciseToGeneratedForApply(
  parsed: ParsedExercise,
  catalogById: Map<string, CatalogExerciseForProgram>,
): GeneratedExerciseForProgram {
  const catalogEx = catalogById.get(parsed.exerciseId)
  if (!catalogEx) {
    throw new Error(`Catalog miss for exercise_id ${parsed.exerciseId}`)
  }

  if (parsed.kind === "bare") {
    const isDuration = catalogEx.measurement_type === "duration"
    return {
      exercise: catalogEx,
      sets: APPLY_DEFAULT_SETS,
      reps: isDuration ? "0" : APPLY_DEFAULT_REPS,
      restSeconds: APPLY_DEFAULT_REST_SECONDS,
      isCompound: false,
    }
  }

  const bounds = parseRepsBounds(parsed.reps)
  return {
    exercise: catalogEx,
    sets: parsed.sets,
    reps: parsed.reps,
    restSeconds: parsed.restSeconds,
    isCompound: false,
    weightKg: parsed.weightKg,
    repRangeMin: bounds.min,
    repRangeMax: bounds.max,
    setRangeMin: parsed.sets,
    setRangeMax: parsed.sets,
    targetDurationSeconds: parsed.targetDurationSeconds ?? undefined,
  }
}

/**
 * Wipe-and-reinsert the `workout_exercises` rows for a single day. Used by
 * the `update_program` apply orchestrator (T80) for every day touched by the
 * patch — both UPDATE-day flows and (indirectly) INSERT-day flows when the
 * orchestrator chooses to reuse this helper.
 *
 * Pre-flight: every `parsed.exerciseId` must be present in `catalogById`. If
 * any miss, returns `{ ok: false }` BEFORE touching the database — we never
 * DELETE rows we cannot then reinsert.
 *
 * RLS scopes both DELETE and INSERT to the caller; `userId` is accepted for
 * interface symmetry with future helpers but is not used here (the
 * `workout_exercises` table has no `user_id` column — RLS joins through
 * `workout_days.user_id`).
 */
export async function applyDayUpdate(
  supabase: SupabaseClient,
  dayId: string,
  parsedExercises: ParsedExercise[],
  catalogById: Map<string, CatalogExerciseForProgram>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _userId: string,
): Promise<{ ok: true; inserted_count: number } | { ok: false; error: string }> {
  const missing = parsedExercises.find((p) => !catalogById.has(p.exerciseId))
  if (missing) {
    return { ok: false, error: `Catalog miss for exercise_id ${missing.exerciseId}` }
  }

  const generated = parsedExercises.map((p) => parsedExerciseToGeneratedForApply(p, catalogById))

  const { error: deleteErr } = await supabase
    .from("workout_exercises")
    .delete()
    .eq("workout_day_id", dayId)

  if (deleteErr) return { ok: false, error: deleteErr.message }

  const rows = buildWorkoutExerciseInsertRowsForDay(dayId, generated)
  const { error: insertErr } = await supabase.from("workout_exercises").insert(rows)
  if (insertErr) return { ok: false, error: insertErr.message }

  return { ok: true, inserted_count: rows.length }
}
