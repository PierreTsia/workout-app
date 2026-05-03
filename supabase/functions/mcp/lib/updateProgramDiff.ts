import type {
  CurrentProgramSnapshot,
  CurrentProgramSnapshotDay,
  DiffDayInsert,
  DiffDayUpdate,
  ParsedPatch,
  ParsedPatchDay,
  ProgramDiff,
} from "./updateProgramTypes.ts"

/**
 * Pure structural diff between the current program state and a parsed patch.
 * Decides which days are inserted, updated, deleted, or unchanged, and sets
 * the apply_order flag for the smart-reorder escape hatch.
 *
 * Pre-condition: parsedPatch.days has already passed validateDayIdentities
 * (i.e. all provided ids exist in current.days; no duplicate ids).
 */
export function computeProgramDiff(
  current: CurrentProgramSnapshot,
  patch: ParsedPatch,
): ProgramDiff {
  const name_change =
    patch.name !== undefined && patch.name !== current.name
      ? { from: current.name, to: patch.name }
      : null

  if (patch.days === undefined) {
    return {
      program_id: patch.program_id,
      name_change,
      days_to_insert: [],
      days_to_update: [],
      days_to_delete: [],
      days_unchanged: current.days.map((d) => ({ id: d.id, label: d.label })),
      apply_order: "default",
    }
  }

  const currentById = new Map<string, CurrentProgramSnapshotDay>(
    current.days.map((d) => [d.id, d]),
  )

  const positioned = patch.days.map((day, position) => ({ day, position }))

  const days_to_insert: DiffDayInsert[] = positioned
    .filter(({ day }) => day.id === undefined)
    .map(({ day, position }) => buildInsert(day, position))

  const days_to_update: DiffDayUpdate[] = positioned
    .filter(({ day }) => day.id !== undefined)
    .map(({ day, position }) => buildUpdate(day, position, currentById))

  const updateIds = new Set(days_to_update.map((u) => u.id))
  const days_to_delete = current.days
    .filter((d) => !updateIds.has(d.id))
    .map((d) => ({
      id: d.id,
      label: d.label,
      session_count: 0,
      blocking: false,
    }))

  const transitsThroughZero =
    current.days.length - days_to_delete.length === 0 &&
    days_to_insert.length > 0

  return {
    program_id: patch.program_id,
    name_change,
    days_to_insert,
    days_to_update,
    days_to_delete,
    days_unchanged: [],
    apply_order: transitsThroughZero ? "insert_first" : "default",
  }
}

function buildInsert(day: ParsedPatchDay, position: number): DiffDayInsert {
  const base: DiffDayInsert = {
    label: day.label,
    sort_order: position,
    parsed_exercises: day.parsed_exercises,
  }
  return day.emoji !== undefined ? { ...base, emoji: day.emoji } : base
}

function buildUpdate(
  day: ParsedPatchDay,
  position: number,
  currentById: Map<string, CurrentProgramSnapshotDay>,
): DiffDayUpdate {
  // Pre-validated by validateDayIdentities: id exists in current.days.
  const cur = currentById.get(day.id!)!
  return {
    id: day.id!,
    current: {
      label: cur.label,
      emoji: cur.emoji,
      sort_order: cur.sort_order,
    },
    label: day.label,
    emoji: day.emoji ?? cur.emoji,
    sort_order: position,
    parsed_exercises: day.parsed_exercises,
  }
}
