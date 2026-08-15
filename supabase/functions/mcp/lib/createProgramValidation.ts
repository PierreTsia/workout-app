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
import { parseRepsBounds, type CatalogExerciseForProgram } from "./programPersistence.ts"

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

/** Bounds + defaults for MCP Circuit Items (ADR 0011 / T163 / T187). */
export const CIRCUIT_BOUNDS = {
  rounds: { min: 1, max: 10, default: 3 },
  rest_seconds: { min: 0, max: 600, default: 90 },
  transition_seconds: { min: 0, max: 600, default: 0 },
  cap_minutes: { min: 1, max: 60, default: 20 },
  exercises: { min: 2, max: 8 },
  amount_reps: { min: 1, max: 50 },
  amount_duration: { min: 5, max: 600 },
} as const

export type ParsedCircuitExercise =
  | { mode: "flat"; exerciseId: string; amount: number; weightKg: number }
  | {
      mode: "per_round"
      exerciseId: string
      perRound: { amount: number; weightKg: number }[]
    }

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
  | {
      kind: "circuit"
      label: string | null
      rounds: number
      restSeconds: number
      transitionSeconds: number
      exercises: ParsedCircuitExercise[]
      /** Termination mode. Omitted on Tours-only fixtures; parse always sets it. */
      mode?: "rounds" | "amrap"
      capMinutes?: number | null
    }

/** Alias used by day-sequence code; same union as ParsedExercise. */
export type ParsedDayItem = ParsedExercise

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

function parseOptionalIntBound(
  value: unknown,
  field: string,
  at: string,
  bound: { min: number; max: number; default: number },
): ParseResult<number> {
  if (value === undefined || value === null) {
    return { ok: true, value: bound.default }
  }
  if (!isFiniteNumber(value) || !Number.isInteger(value) || value < bound.min || value > bound.max) {
    return {
      ok: false,
      error: `${at}.${field} must be an integer in [${bound.min}, ${bound.max}], got ${String(value)}`,
    }
  }
  return { ok: true, value }
}

function parseCircuitExercise(
  raw: unknown,
  atEx: string,
  rounds: number,
): ParseResult<ParsedCircuitExercise> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: `${atEx} must be an object` }
  }
  const obj = raw as Record<string, unknown>
  const exerciseId = obj.exercise_id
  if (typeof exerciseId !== "string" || !isUuid(exerciseId)) {
    return { ok: false, error: `${atEx}.exercise_id must be a valid UUID` }
  }

  const hasPerRound = obj.per_round !== undefined && obj.per_round !== null
  const hasFlat = obj.amount !== undefined || obj.weight_kg !== undefined

  if (hasPerRound && hasFlat) {
    return {
      ok: false,
      error: `${atEx}: provide either flat {amount, weight_kg} OR per_round, not both`,
    }
  }

  if (hasPerRound) {
    if (!Array.isArray(obj.per_round)) {
      return { ok: false, error: `${atEx}.per_round must be an array` }
    }
    if (obj.per_round.length !== rounds) {
      return {
        ok: false,
        error: `${atEx}.per_round length must equal rounds (${rounds}), got ${obj.per_round.length}`,
      }
    }
    const perRound: { amount: number; weightKg: number }[] = []
    for (const [i, cell] of obj.per_round.entries()) {
      if (cell === null || typeof cell !== "object" || Array.isArray(cell)) {
        return { ok: false, error: `${atEx}.per_round[${i}] must be an object` }
      }
      const c = cell as Record<string, unknown>
      if (
        !isFiniteNumber(c.amount) ||
        !Number.isInteger(c.amount) ||
        c.amount < CIRCUIT_BOUNDS.amount_reps.min ||
        c.amount > CIRCUIT_BOUNDS.amount_duration.max
      ) {
        // Broad gate here; measurement_type narrows in cross-field after catalog.
        return {
          ok: false,
          error: `${atEx}.per_round[${i}].amount must be an integer in [${CIRCUIT_BOUNDS.amount_reps.min}, ${CIRCUIT_BOUNDS.amount_duration.max}], got ${String(c.amount)}`,
        }
      }
      if (
        !isFiniteNumber(c.weight_kg) ||
        c.weight_kg < BOUNDS.weight_kg.min ||
        c.weight_kg > BOUNDS.weight_kg.max
      ) {
        return {
          ok: false,
          error: `${atEx}.per_round[${i}].weight_kg must be a number in [${BOUNDS.weight_kg.min}, ${BOUNDS.weight_kg.max}], got ${String(c.weight_kg)}`,
        }
      }
      perRound.push({ amount: c.amount, weightKg: c.weight_kg })
    }
    return { ok: true, value: { mode: "per_round", exerciseId, perRound } }
  }

  if (
    !isFiniteNumber(obj.amount) ||
    !Number.isInteger(obj.amount) ||
    obj.amount < CIRCUIT_BOUNDS.amount_reps.min ||
    obj.amount > CIRCUIT_BOUNDS.amount_duration.max
  ) {
    return {
      ok: false,
      error: `${atEx}.amount must be an integer in [${CIRCUIT_BOUNDS.amount_reps.min}, ${CIRCUIT_BOUNDS.amount_duration.max}], got ${String(obj.amount)}`,
    }
  }
  if (
    !isFiniteNumber(obj.weight_kg) ||
    obj.weight_kg < BOUNDS.weight_kg.min ||
    obj.weight_kg > BOUNDS.weight_kg.max
  ) {
    return {
      ok: false,
      error: `${atEx}.weight_kg must be a number in [${BOUNDS.weight_kg.min}, ${BOUNDS.weight_kg.max}], got ${String(obj.weight_kg)}`,
    }
  }
  return {
    ok: true,
    value: { mode: "flat", exerciseId, amount: obj.amount, weightKg: obj.weight_kg },
  }
}

function parseCircuitTermination(
  obj: Record<string, unknown>,
  at: string,
): ParseResult<{ mode: "rounds" | "amrap"; capMinutes: number | null }> {
  const rawMode = obj.mode
  if (rawMode === undefined || rawMode === null) {
    return { ok: true, value: { mode: "rounds", capMinutes: null } }
  }
  if (rawMode !== "rounds" && rawMode !== "amrap") {
    return {
      ok: false,
      error: `${at}.mode must be "rounds" or "amrap", got ${String(rawMode)}`,
    }
  }
  if (rawMode === "rounds") {
    return { ok: true, value: { mode: "rounds", capMinutes: null } }
  }

  const cap = obj.cap_minutes
  if (cap === undefined || cap === null) {
    return {
      ok: true,
      value: { mode: "amrap", capMinutes: CIRCUIT_BOUNDS.cap_minutes.default },
    }
  }
  if (
    !isFiniteNumber(cap) ||
    !Number.isInteger(cap) ||
    cap < CIRCUIT_BOUNDS.cap_minutes.min ||
    cap > CIRCUIT_BOUNDS.cap_minutes.max
  ) {
    return {
      ok: false,
      error: `${at}.cap_minutes must be an integer in [${CIRCUIT_BOUNDS.cap_minutes.min}, ${CIRCUIT_BOUNDS.cap_minutes.max}], got ${String(cap)}`,
    }
  }
  return { ok: true, value: { mode: "amrap", capMinutes: cap } }
}

function parseCircuitInput(
  obj: Record<string, unknown>,
  at: string,
): ParseResult<ParsedExercise> {
  // Solo-shaped fields on the circuit root (except rest_seconds which is block-level).
  for (const field of ["sets", "reps", "exercise_id", "target_duration_seconds"] as const) {
    if (field in obj) {
      return {
        ok: false,
        error: `${at}: Circuit items must not include solo field "${field}" — use type:"circuit" with nested exercises[{amount,weight_kg}] or per_round`,
      }
    }
  }
  // weight_kg on the circuit root is also forbidden (lives on nested exercises).
  if ("weight_kg" in obj) {
    return {
      ok: false,
      error: `${at}: Circuit items must not include root "weight_kg" — set weight_kg on each nested exercise`,
    }
  }

  const termination = parseCircuitTermination(obj, at)
  if (!termination.ok) return termination

  const isAmrap = termination.value.mode === "amrap"
  if (isAmrap) {
    const forbidden = (["rounds", "rest_seconds", "transition_seconds"] as const).find(
      (field) => field in obj,
    )
    if (forbidden) {
      return {
        ok: false,
        error: `${at}: mode "amrap" cannot include "${forbidden}" — omit Tours fields (rounds, rest_seconds, transition_seconds, nested per_round)`,
      }
    }
  } else if ("cap_minutes" in obj) {
    return {
      ok: false,
      error: `${at}: cap_minutes is only valid with mode "amrap"`,
    }
  }
  const amrapTemplate = { ok: true, value: 0 } satisfies ParseResult<number>
  const roundsResult = isAmrap
    ? { ok: true, value: 1 } satisfies ParseResult<number>
    : parseOptionalIntBound(obj.rounds, "rounds", at, CIRCUIT_BOUNDS.rounds)
  if (!roundsResult.ok) return roundsResult
  const restResult = isAmrap
    ? amrapTemplate
    : parseOptionalIntBound(
        obj.rest_seconds,
        "rest_seconds",
        at,
        CIRCUIT_BOUNDS.rest_seconds,
      )
  if (!restResult.ok) return restResult
  const transitionResult = isAmrap
    ? amrapTemplate
    : parseOptionalIntBound(
        obj.transition_seconds,
        "transition_seconds",
        at,
        CIRCUIT_BOUNDS.transition_seconds,
      )
  if (!transitionResult.ok) return transitionResult

  let label: string | null = null
  if (obj.label !== undefined && obj.label !== null) {
    if (typeof obj.label !== "string") {
      return { ok: false, error: `${at}.label must be a string or null` }
    }
    label = obj.label
  }

  if (!Array.isArray(obj.exercises)) {
    return { ok: false, error: `${at}.exercises must be an array of 2–8 circuit exercises` }
  }
  if (
    obj.exercises.length < CIRCUIT_BOUNDS.exercises.min ||
    obj.exercises.length > CIRCUIT_BOUNDS.exercises.max
  ) {
    return {
      ok: false,
      error: `${at}.exercises must have between ${CIRCUIT_BOUNDS.exercises.min} and ${CIRCUIT_BOUNDS.exercises.max} items, got ${obj.exercises.length}`,
    }
  }

  if (isAmrap) {
    const perRoundIdx = obj.exercises.findIndex(
      (rawEx) =>
        rawEx !== null &&
        typeof rawEx === "object" &&
        !Array.isArray(rawEx) &&
        "per_round" in rawEx,
    )
    if (perRoundIdx >= 0) {
      return {
        ok: false,
        error: `${at}.exercises[${perRoundIdx}]: mode "amrap" cannot include nested per_round — use flat {amount, weight_kg}`,
      }
    }
  }

  const exercises: ParsedCircuitExercise[] = []
  for (const [i, rawEx] of obj.exercises.entries()) {
    const parsedEx = parseCircuitExercise(rawEx, `${at}.exercises[${i}]`, roundsResult.value)
    if (!parsedEx.ok) return parsedEx
    exercises.push(parsedEx.value)
  }

  return {
    ok: true,
    value: {
      kind: "circuit",
      label,
      rounds: roundsResult.value,
      restSeconds: restResult.value,
      transitionSeconds: transitionResult.value,
      exercises,
      mode: termination.value.mode,
      capMinutes: termination.value.capMinutes,
    },
  }
}

/**
 * Parse one entry of `exercises[]` into a ParsedExercise. Bare strings must be
 * UUIDs. Object form must have ALL of {exercise_id, sets, reps, weight_kg,
 * rest_seconds} (target_duration_seconds is optional). Circuit form uses
 * `type: "circuit"` (ADR 0011). Bounds are enforced here so the handler can
 * fail fast before fetching the catalog.
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
      error: `${at} must be a UUID string, a prescription object, or a Circuit (type:"circuit"), got ${typeof raw}`,
    }
  }

  const obj = raw as Record<string, unknown>

  if (obj.type === "circuit") {
    return parseCircuitInput(obj, at)
  }

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
 * Per-day validation: parses every raw exercise entry and runs cross-field
 * checks for object-form prescriptions against the pre-fetched catalog map.
 *
 * Returns the FIRST error encountered (parse OR cross-field) so the agent gets
 * one actionable error per call. Bare-string entries always skip the catalog
 * lookup — defaults are applied downstream.
 *
 * The handler is responsible for fetching the catalog (via
 * `lib/catalogLookup.ts#fetchExercisesByIds`) and passing the resulting
 * `Map<id, CatalogExerciseForProgram>` here. This module performs zero I/O.
 *
 * Defensive: if an object-form `exerciseId` is missing from the catalog map,
 * returns a structured error rather than throwing. Reaching this branch means
 * the handler skipped or partially performed the catalog fetch — surface
 * loudly instead of crashing.
 */
export function validateDayExercises(
  rawExercises: unknown[],
  dayLabel: string,
  catalogById: Map<string, CatalogExerciseForProgram>,
): { ok: true; parsed: ParsedExercise[] } | { ok: false; error: string } {
  const parsed: ParsedExercise[] = []
  for (const [j, raw] of rawExercises.entries()) {
    const parseResult = parseExerciseInput(raw, dayLabel, j)
    if (!parseResult.ok) {
      return { ok: false, error: parseResult.error }
    }
    parsed.push(parseResult.value)
  }

  for (const [j, p] of parsed.entries()) {
    if (p.kind === "object") {
      const ex = catalogById.get(p.exerciseId)
      if (!ex) {
        return {
          ok: false,
          error: `${locator(dayLabel, j)}.exercise_id "${p.exerciseId}" was not found in the fetched catalog (unknown or inaccessible).`,
        }
      }
      const cf = validateExerciseCrossFields(p, ex, dayLabel, j)
      if (!cf.ok) {
        return { ok: false, error: cf.error }
      }
      continue
    }
    if (p.kind === "circuit") {
      const circuitCf = validateCircuitCrossFields(p, catalogById, dayLabel, j)
      if (!circuitCf.ok) return circuitCf
    }
  }

  return { ok: true, parsed }
}

/**
 * Cross-field rules for nested Circuit exercises against the catalog
 * (bodyweight weight, duration amount bounds). ADR 0011 / T163.
 */
export function validateCircuitCrossFields(
  circuit: Extract<ParsedExercise, { kind: "circuit" }>,
  catalogById: Map<string, CatalogExerciseForProgram>,
  dayLabel: string,
  position: number,
): ParseResult<true> {
  const at = locator(dayLabel, position)
  for (const [i, nested] of circuit.exercises.entries()) {
    const ex = catalogById.get(nested.exerciseId)
    if (!ex) {
      return {
        ok: false,
        error: `${at}.exercises[${i}].exercise_id "${nested.exerciseId}" was not found in the fetched catalog (unknown or inaccessible).`,
      }
    }
    const cells =
      nested.mode === "flat"
        ? [{ amount: nested.amount, weightKg: nested.weightKg }]
        : nested.perRound
    const isDuration = ex.measurement_type === "duration"
    const isBodyweight = ex.equipment === "bodyweight"
    for (const [k, cell] of cells.entries()) {
      const cellAt =
        nested.mode === "flat" ? `${at}.exercises[${i}]` : `${at}.exercises[${i}].per_round[${k}]`
      if (isBodyweight && cell.weightKg > 0) {
        return {
          ok: false,
          error: `${cellAt}: bodyweight exercise "${ex.name}" cannot have weight_kg > 0 (got ${cell.weightKg}). Weighted bodyweight is tracked in #281.`,
        }
      }
      if (isDuration) {
        if (
          cell.amount < CIRCUIT_BOUNDS.amount_duration.min ||
          cell.amount > CIRCUIT_BOUNDS.amount_duration.max
        ) {
          return {
            ok: false,
            error: `${cellAt}.amount for duration exercise "${ex.name}" must be in [${CIRCUIT_BOUNDS.amount_duration.min}, ${CIRCUIT_BOUNDS.amount_duration.max}], got ${cell.amount}`,
          }
        }
        if (cell.weightKg > 0) {
          return {
            ok: false,
            error: `${cellAt}: duration exercise "${ex.name}" cannot have weight_kg > 0 (got ${cell.weightKg}).`,
          }
        }
      } else if (
        cell.amount < CIRCUIT_BOUNDS.amount_reps.min ||
        cell.amount > CIRCUIT_BOUNDS.amount_reps.max
      ) {
        return {
          ok: false,
          error: `${cellAt}.amount for reps exercise "${ex.name}" must be in [${CIRCUIT_BOUNDS.amount_reps.min}, ${CIRCUIT_BOUNDS.amount_reps.max}], got ${cell.amount}`,
        }
      }
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
