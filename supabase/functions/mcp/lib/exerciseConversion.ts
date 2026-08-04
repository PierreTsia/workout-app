/**
 * Shared input-shaping helpers for the MCP tools that persist `workout_days`
 * + `workout_exercises` rows (`create_program`, `update_program`,
 * `create_workout_day`).
 *
 * Two phases of the agent-input → DB-row pipeline live here:
 *
 *   1. `collectCandidateExerciseIds` — pre-parse, pre-catalog: walk the raw
 *      `exercises[]` payload and pull every UUID it contains (bare strings or
 *      `{ exercise_id }` objects). Non-UUID entries are dropped silently so
 *      the catalog fetch can never leak Postgres "invalid input syntax for
 *      type uuid" errors to the agent — those are surfaced later by
 *      `validateDayExercises` with locator-aware messages.
 *
 *   2. `buildGeneratedExercise` — post-parse, post-catalog: combine a
 *      `ParsedExercise` with its `CatalogExerciseForProgram` row to produce
 *      the `GeneratedExerciseForProgram` shape consumed by
 *      `buildWorkoutExerciseInsertRowsForDay`. Bare-UUID entries get the
 *      legacy defaults (3 × 10, 0 kg, 90s rest); object-form entries freeze
 *      the agent-supplied prescription via explicit rep + set ranges.
 *
 * Side-effect-free, no Supabase access — kept testable from both Vitest
 * (via the web parity surface) and Deno (Edge runtime).
 */

import { isUuid } from "./uuid.ts"
import {
  parseRepsBounds,
  type CatalogExerciseForProgram,
  type GeneratedExerciseForProgram,
} from "./programPersistence.ts"
import type { ParsedExercise } from "./createProgramValidation.ts"

const DEFAULT_SETS = 3
const DEFAULT_REPS = "10"
const DEFAULT_REST_SECONDS = 90

export function collectCandidateExerciseIds(raw: unknown[]): string[] {
  return raw.flatMap((entry) => {
    if (typeof entry === "string") {
      return isUuid(entry) ? [entry] : []
    }
    if (entry !== null && typeof entry === "object" && !Array.isArray(entry)) {
      const obj = entry as Record<string, unknown>
      // MCP Circuit Item (ADR 0011): nested exercises[].exercise_id
      if (obj.type === "circuit" && Array.isArray(obj.exercises)) {
        return obj.exercises.flatMap((nested) => {
          if (nested === null || typeof nested !== "object" || Array.isArray(nested)) {
            return []
          }
          const id = (nested as Record<string, unknown>).exercise_id
          return typeof id === "string" && isUuid(id) ? [id] : []
        })
      }
      const id = obj.exercise_id
      return typeof id === "string" && isUuid(id) ? [id] : []
    }
    return []
  })
}

function defaultGeneratedExercise(ex: CatalogExerciseForProgram): GeneratedExerciseForProgram {
  const isDuration = ex.measurement_type === "duration"
  return {
    exercise: ex,
    sets: DEFAULT_SETS,
    reps: isDuration ? "0" : DEFAULT_REPS,
    restSeconds: DEFAULT_REST_SECONDS,
    isCompound: false,
  }
}

/**
 * Build the persistence input from an object-form parsed exercise. Freezes the
 * progression range bounds to the agent-provided sets and reps (T74 spec).
 * Bodyweight (T75) and duration (T75) branches inside `buildWorkoutExerciseInsertRow`
 * will override these range fields when relevant.
 */
function generatedFromObject(
  parsed: Extract<ParsedExercise, { kind: "object" }>,
  ex: CatalogExerciseForProgram,
): GeneratedExerciseForProgram {
  const bounds = parseRepsBounds(parsed.reps)
  return {
    exercise: ex,
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

export function buildGeneratedExercise(
  parsed: ParsedExercise,
  ex: CatalogExerciseForProgram,
): GeneratedExerciseForProgram {
  if (parsed.kind === "circuit") {
    throw new Error(
      "buildGeneratedExercise does not accept Circuit items — use daySequence / blockPersistence",
    )
  }
  return parsed.kind === "bare" ? defaultGeneratedExercise(ex) : generatedFromObject(parsed, ex)
}
