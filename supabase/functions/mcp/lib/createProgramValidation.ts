/**
 * Pure validation + parsing helpers for the `create_program` MCP tool (T74).
 * All side-effect-free (no Supabase, no env access) so they can be unit-tested
 * with both Vitest (web parity / fast feedback) and Deno (Edge runtime parity).
 *
 * Validation order locked in the Tech Plan:
 *   auth → legacy detection → shape → bounds → regex → catalog fetch → cross-field → build
 *
 * This module covers the "shape → bounds → regex" pure phases for one exercise
 * and the "legacy detection" up-front check; the handler in `tools/createProgram.ts`
 * wires the rest (auth, catalog fetch, cross-field with catalog data, build, persist).
 */

import { isUuid } from "./uuid.ts"
import { parseRepsBounds } from "./programPersistence.ts"

export const BOUNDS = {
  sets: { min: 1, max: 10 },
  // reps min is 0 because "0" is the legitimate sentinel for duration-mode
  // exercises (planks, holds). Non-duration callers passing reps "0" are
  // rejected by cross-field rule R6 — bounds stays semantics-free.
  reps: { min: 0, max: 50 },
  weight_kg: { min: 0, max: 500 },
  rest_seconds: { min: 0, max: 600 },
  target_duration_seconds: { min: 5, max: 600 },
} as const

export type ParsedExercise =
  | { kind: "bare"; exerciseId: string }
  | {
      kind: "object"
      exerciseId: string
      sets: number
      reps: string
      weightKg: number
      restSeconds: number
      targetDurationSeconds: number | null
    }

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

const REPS_REGEX = /^\d+(-\d+)?$/

/**
 * Detect a v0.2.x legacy call where the agent sends `exercise_ids` at the day
 * level instead of the new `exercises` field. Used to surface a structured
 * migration error before any other validation runs.
 */
export function detectLegacyExerciseIds(args: Record<string, unknown>): boolean {
  const days = args.days
  if (!Array.isArray(days)) return false
  return days.some((d) => d !== null && typeof d === "object" && "exercise_ids" in d)
}

export const LEGACY_MIGRATION_ERROR_MESSAGE = `create_program v0.3.0 introduced a breaking change to the input shape.

The \`exercise_ids\` field has been replaced by \`exercises\`, which accepts
either a bare UUID string (defaults applied) or a full prescription object.

Old:
  { "name": "Push", "exercise_ids": ["uuid-1", "uuid-2"] }

New (bare UUID — same behavior as before):
  { "name": "Push", "exercises": ["uuid-1", "uuid-2"] }

New (explicit prescription):
  { "name": "Push", "exercises": [
    { "exercise_id": "uuid-1", "sets": 4, "reps": "8", "weight_kg": 80, "rest_seconds": 120 }
  ]}

See get_exercise_details for weight_convention guidance.`

function locator(dayLabel: string, position: number): string {
  return `days["${dayLabel}"].exercises[${position}]`
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

/**
 * Parse one entry of `exercises[]` into a ParsedExercise. Bare strings must be
 * UUIDs. Object form must have ALL of {exercise_id, sets, reps, weight_kg,
 * rest_seconds} (target_duration_seconds is optional). Bounds and reps regex
 * are enforced here so the handler can fail fast before fetching the catalog.
 */
export function parseExerciseInput(
  raw: unknown,
  dayLabel: string,
  position: number,
): ParseResult<ParsedExercise> {
  const at = locator(dayLabel, position)

  if (typeof raw === "string") {
    if (!isUuid(raw)) {
      return { ok: false, error: `Invalid UUID at ${at}: "${raw}"` }
    }
    return { ok: true, value: { kind: "bare", exerciseId: raw } }
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      error: `${at} must be a UUID string or a prescription object, got ${typeof raw}`,
    }
  }

  const obj = raw as Record<string, unknown>

  const exerciseId = obj.exercise_id
  if (typeof exerciseId !== "string" || !isUuid(exerciseId)) {
    return { ok: false, error: `${at}.exercise_id must be a valid UUID` }
  }

  const sets = obj.sets
  if (!isFiniteNumber(sets) || !Number.isInteger(sets) || sets < BOUNDS.sets.min || sets > BOUNDS.sets.max) {
    return {
      ok: false,
      error: `${at}.sets must be an integer in [${BOUNDS.sets.min}, ${BOUNDS.sets.max}], got ${String(sets)}`,
    }
  }

  const reps = obj.reps
  if (typeof reps !== "string" || !REPS_REGEX.test(reps)) {
    return {
      ok: false,
      error: `${at}.reps must match "N" or "N-M" (e.g. "8" or "8-12"), got "${String(reps)}"`,
    }
  }

  let bounds: { min: number; max: number }
  try {
    bounds = parseRepsBounds(reps)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `${at}.reps: ${message}` }
  }
  if (bounds.min < BOUNDS.reps.min || bounds.max > BOUNDS.reps.max) {
    return {
      ok: false,
      error: `${at}.reps bounds out of range: must be in [${BOUNDS.reps.min}, ${BOUNDS.reps.max}], got "${reps}"`,
    }
  }

  const weightKg = obj.weight_kg
  if (!isFiniteNumber(weightKg) || weightKg < BOUNDS.weight_kg.min || weightKg > BOUNDS.weight_kg.max) {
    return {
      ok: false,
      error: `${at}.weight_kg must be a number in [${BOUNDS.weight_kg.min}, ${BOUNDS.weight_kg.max}], got ${String(weightKg)}`,
    }
  }

  const restSeconds = obj.rest_seconds
  if (
    !isFiniteNumber(restSeconds) ||
    !Number.isInteger(restSeconds) ||
    restSeconds < BOUNDS.rest_seconds.min ||
    restSeconds > BOUNDS.rest_seconds.max
  ) {
    return {
      ok: false,
      error: `${at}.rest_seconds must be an integer in [${BOUNDS.rest_seconds.min}, ${BOUNDS.rest_seconds.max}], got ${String(restSeconds)}`,
    }
  }

  let targetDurationSeconds: number | null = null
  if (obj.target_duration_seconds !== undefined && obj.target_duration_seconds !== null) {
    const tds = obj.target_duration_seconds
    if (
      !isFiniteNumber(tds) ||
      !Number.isInteger(tds) ||
      tds < BOUNDS.target_duration_seconds.min ||
      tds > BOUNDS.target_duration_seconds.max
    ) {
      return {
        ok: false,
        error: `${at}.target_duration_seconds must be an integer in [${BOUNDS.target_duration_seconds.min}, ${BOUNDS.target_duration_seconds.max}], got ${String(tds)}`,
      }
    }
    targetDurationSeconds = tds
  }

  return {
    ok: true,
    value: {
      kind: "object",
      exerciseId,
      sets,
      reps,
      weightKg,
      restSeconds,
      targetDurationSeconds,
    },
  }
}

/**
 * All cross-field rules for `create_program` object-form prescriptions.
 * Bare-string entries always pass — defaults are applied downstream.
 *
 *   R1 (T75): bodyweight equipment + weight_kg > 0 → reject (link to #281)
 *   R2 (T75): duration exercise + reps != "0" → reject
 *   R3 (T75): duration exercise + weight_kg > 0 → reject
 *   R4 (T74): reps exercise + target_duration_seconds → reject
 *   R5 (T75): duration exercise object form without target_duration_seconds → reject
 *   R6 (post-T75): non-duration exercise + reps "0" → reject ("0" reserved for duration mode)
 *
 * Returns the FIRST violation in declaration order so the agent gets one
 * actionable error per call instead of a wall of text.
 */
export function validateExerciseCrossFields(
  parsed: ParsedExercise,
  catalog: { name: string; equipment: string; measurement_type?: "reps" | "duration" | null },
  dayLabel: string,
  position: number,
): ParseResult<true> {
  if (parsed.kind !== "object") return { ok: true, value: true }

  const isDuration = catalog.measurement_type === "duration"
  const isBodyweight = catalog.equipment === "bodyweight"
  const at = locator(dayLabel, position)
  const name = catalog.name

  // R1: bodyweight + weight_kg > 0 (#281 tracks weighted bodyweight)
  if (isBodyweight && parsed.weightKg > 0) {
    return {
      ok: false,
      error: `${at}: bodyweight exercise "${name}" cannot have weight_kg > 0 (got ${parsed.weightKg}). Weighted bodyweight (weighted dips, weighted pull-ups) is not supported in v0.3.0 — tracked in #281.`,
    }
  }

  // R2: duration + non-"0" reps (use target_duration_seconds instead)
  if (isDuration && parsed.reps !== "0") {
    return {
      ok: false,
      error: `${at}: duration exercise "${name}" cannot have reps "${parsed.reps}" — set reps to "0" and use target_duration_seconds instead.`,
    }
  }

  // R3: duration + weight_kg > 0 (weighted duration exercises not yet modelled)
  if (isDuration && parsed.weightKg > 0) {
    return {
      ok: false,
      error: `${at}: duration exercise "${name}" cannot have weight_kg > 0 (got ${parsed.weightKg}). Weighted duration exercises are not supported in v0.3.0.`,
    }
  }

  // R4 (T74): reps exercise + target_duration_seconds → reject
  if (!isDuration && parsed.targetDurationSeconds !== null) {
    return {
      ok: false,
      error: `${at}: reps exercise "${name}" cannot have target_duration_seconds. Use reps + weight_kg instead.`,
    }
  }

  // R6 (post-T75 fix): non-duration exercise + reps "0" → reject. The "0"
  // sentinel is reserved for duration mode (paired with target_duration_seconds);
  // a reps exercise with 0 reps is nonsensical and would persist garbage rows.
  if (!isDuration && parsed.reps === "0") {
    return {
      ok: false,
      error: `${at}: reps exercise "${name}" cannot have reps "0". Use reps "1" or higher (e.g. "8" or "8-12"); reps "0" is reserved for duration exercises.`,
    }
  }

  // R5: duration object form requires target_duration_seconds (or use bare UUID for catalog default)
  if (isDuration && parsed.targetDurationSeconds === null) {
    return {
      ok: false,
      error: `${at}: duration exercise "${name}" requires target_duration_seconds in object form (got null). Either provide target_duration_seconds (5-600s) or pass the exercise as a bare UUID to use the catalog default.`,
    }
  }

  return { ok: true, value: true }
}

/**
 * @deprecated Use `validateExerciseCrossFields` (T75 superset). Kept as a thin
 * shim so the T74 callers compile until they're migrated.
 */
export function validateRepsModeCrossField(
  parsed: ParsedExercise,
  catalog: { name: string; measurement_type?: "reps" | "duration" | null },
  dayLabel: string,
  position: number,
): ParseResult<true> {
  return validateExerciseCrossFields(
    parsed,
    { name: catalog.name, equipment: "barbell", measurement_type: catalog.measurement_type },
    dayLabel,
    position,
  )
}
