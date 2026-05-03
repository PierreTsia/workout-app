/**
 * Pure validation gate for the `update_program` MCP tool (T79).
 *
 * Three side-effect-free validators consumed by the handler in
 * `tools/updateProgram.ts` (T81), in this order:
 *
 *   1. `parsePatchShape(args)` — top-level patch shape, `is_active` rejection,
 *      defaults resolution. Per-exercise validation is delegated to T77's
 *      `validateDayExercises` (called by the handler after catalog fetch).
 *   2. `validateDayIdentities(patchDays, currentDayIds)` — no duplicate ids,
 *      every provided id exists in the current program.
 *   3. `requireConfirmForDestructive(diff, confirm)` — destructive-guard,
 *      run AFTER the diff is computed by T78's `computeProgramDiff`.
 *
 * All three return `{ ok: true, ... } | { ok: false, error: string }`.
 * Error strings are purpose-crafted fixtures — see the test file for the
 * exact wording the agent will receive on each failure mode.
 */

import type { ParsedPatch, ParsedPatchDay, ProgramDiff } from "./updateProgramTypes.ts"
import { isUuid } from "./uuid.ts"

const MAX_DAYS = 14
const MAX_EXERCISES_PER_DAY = 40

export function parsePatchShape(
  args: Record<string, unknown>,
): { ok: true; value: ParsedPatch } | { ok: false; error: string } {
  // is_active rejection MUST come before any "unknown field" check so the
  // agent gets a pointer to the dedicated tool instead of a generic "stop
  // sending unknown fields" hint.
  if (args.is_active !== undefined) {
    return {
      ok: false,
      error:
        "`is_active` is not editable via update_program. Use the dedicated `set_active_program` tool (coming soon).",
    }
  }

  const programId = args.program_id
  if (typeof programId !== "string" || !isUuid(programId)) {
    return { ok: false, error: "Invalid program_id format (expected UUID)." }
  }

  let name: string | undefined
  if (args.name !== undefined) {
    if (typeof args.name !== "string" || args.name.trim().length === 0) {
      return { ok: false, error: "`name` must be a non-empty string when provided." }
    }
    name = args.name.trim()
  }

  let days: ParsedPatchDay[] | undefined
  if (args.days !== undefined) {
    if (!Array.isArray(args.days)) {
      return {
        ok: false,
        error:
          "`days` must be a non-empty array when provided. Omit the field entirely to leave days unchanged, or pass at least one day.",
      }
    }
    if (args.days.length === 0) {
      return {
        ok: false,
        error:
          "`days` must be a non-empty array when provided. Omit the field entirely to leave days unchanged, or pass at least one day.",
      }
    }
    if (args.days.length > MAX_DAYS) {
      return { ok: false, error: `days: too many entries (max ${MAX_DAYS}).` }
    }

    const parsedDaysResult = args.days.map((rawDay, i) => parseDayShape(rawDay, i))
    const firstError = parsedDaysResult.find((r) => !r.ok)
    if (firstError && !firstError.ok) {
      return { ok: false, error: firstError.error }
    }
    days = parsedDaysResult.map((r) => (r as { ok: true; value: ParsedPatchDay }).value)
  }

  let dryRun = true
  if (args.dry_run !== undefined) {
    if (typeof args.dry_run !== "boolean") {
      return { ok: false, error: "`dry_run` must be a boolean." }
    }
    dryRun = args.dry_run
  }

  let confirm = false
  if (args.confirm !== undefined) {
    if (typeof args.confirm !== "boolean") {
      return { ok: false, error: "`confirm` must be a boolean." }
    }
    confirm = args.confirm
  }

  return {
    ok: true,
    value: {
      program_id: programId,
      ...(name !== undefined ? { name } : {}),
      ...(days !== undefined ? { days } : {}),
      dry_run: dryRun,
      confirm,
    },
  }
}

function parseDayShape(
  rawDay: unknown,
  i: number,
): { ok: true; value: ParsedPatchDay } | { ok: false; error: string } {
  if (rawDay === null || typeof rawDay !== "object" || Array.isArray(rawDay)) {
    return { ok: false, error: `days[${i}] must be an object.` }
  }
  const day = rawDay as Record<string, unknown>

  if (typeof day.label !== "string" || day.label.trim().length === 0) {
    return { ok: false, error: `days[${i}].label must be a non-empty string.` }
  }
  const label = day.label.trim()

  let emoji: string | undefined
  if (day.emoji !== undefined) {
    if (typeof day.emoji !== "string") {
      return { ok: false, error: `days[${i}].emoji must be a string when provided.` }
    }
    emoji = day.emoji
  }

  let id: string | undefined
  if (day.id !== undefined) {
    if (typeof day.id !== "string" || !isUuid(day.id)) {
      return { ok: false, error: `days[${i}].id must be a UUID when provided.` }
    }
    id = day.id
  }

  if (!Array.isArray(day.exercises)) {
    return {
      ok: false,
      error: `days[${i}].exercises must be a non-empty array (≥1 exercise per day).`,
    }
  }
  if (day.exercises.length === 0) {
    return {
      ok: false,
      error: `days[${i}].exercises must be a non-empty array (≥1 exercise per day).`,
    }
  }
  if (day.exercises.length > MAX_EXERCISES_PER_DAY) {
    return {
      ok: false,
      error: `days[${i}].exercises: too many entries (max ${MAX_EXERCISES_PER_DAY}).`,
    }
  }

  // Per-exercise validation is delegated to T77's `validateDayExercises`,
  // called by the T81 handler AFTER the catalog fetch. We only check the
  // array shape here; the handler fills `parsed_exercises` with the result.
  return {
    ok: true,
    value: {
      ...(id !== undefined ? { id } : {}),
      label,
      ...(emoji !== undefined ? { emoji } : {}),
      parsed_exercises: [],
    },
  }
}

export function validateDayIdentities(
  patchDays: ParsedPatchDay[],
  currentDayIds: Set<string>,
): { ok: true } | { ok: false; error: string } {
  const idsWithIndex = patchDays
    .map((d, i) => ({ id: d.id, i }))
    .filter((entry): entry is { id: string; i: number } => entry.id !== undefined)

  // Duplicate-id check first (cheaper than the existence lookup below) so
  // the error always names BOTH offending positions deterministically.
  const firstSeenAt = new Map<string, number>()
  const collision = idsWithIndex.find(({ id, i }) => {
    if (firstSeenAt.has(id)) return true
    firstSeenAt.set(id, i)
    return false
  })
  if (collision) {
    const firstIdx = firstSeenAt.get(collision.id)
    return {
      ok: false,
      error: `days[${firstIdx}] and days[${collision.i}] both reference id '${collision.id}'. Each day id may appear at most once in the patch.`,
    }
  }

  const unknown = idsWithIndex.find(({ id }) => !currentDayIds.has(id))
  if (unknown) {
    return {
      ok: false,
      error: `days[${unknown.i}].id '${unknown.id}' is not a day of the current program. Omit the id to create a new day, or check the id.`,
    }
  }

  return { ok: true }
}

export function requireConfirmForDestructive(
  diff: ProgramDiff,
  confirm: boolean,
): { ok: true } | { ok: false; error: string } {
  if (diff.days_to_delete.length === 0 || confirm === true) {
    return { ok: true }
  }
  const labels = diff.days_to_delete.map((d) => d.label).join(", ")
  return {
    ok: false,
    error: `Patch removes ${diff.days_to_delete.length} day(s): ${labels}. Pass \`confirm: true\` along with \`dry_run: false\` to apply, or revise the payload to keep these days.`,
  }
}
