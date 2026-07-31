import type { WorkoutExerciseWithLabel } from "@/types/database"

/**
 * Ephemeral list edits (session-only swaps/adds/deletes). Cleared on day change (when not
 * active), after permanent writes, or new session. While `session.isActive`, the patch is also
 * persisted to localStorage so a full page reload does not drop in-session edits.
 */
export interface PreSessionExercisePatch {
  deletedIds: Set<string>
  swappedRows: Map<string, WorkoutExerciseWithLabel>
  addedRows: WorkoutExerciseWithLabel[]
}

export function emptyPreSessionPatch(): PreSessionExercisePatch {
  return {
    deletedIds: new Set(),
    swappedRows: new Map(),
    addedRows: [],
  }
}

export function clonePreSessionPatch(
  p: PreSessionExercisePatch,
): PreSessionExercisePatch {
  return {
    deletedIds: new Set(p.deletedIds),
    swappedRows: new Map(p.swappedRows),
    addedRows: [...p.addedRows],
  }
}

/** JSON-safe shape for persisting a patch (e.g. localStorage). */
export interface SerializedPreSessionExercisePatch {
  deletedIds: string[]
  swappedRows: [string, WorkoutExerciseWithLabel][]
  addedRows: WorkoutExerciseWithLabel[]
}

/**
 * A patch persisted before rows carried their catalog embed has no `exercise`
 * key. Normalise on read so the runtime shape matches the type instead of
 * leaving an `undefined` to be absorbed downstream.
 */
const withEmbed = (
  row: WorkoutExerciseWithLabel,
): WorkoutExerciseWithLabel => ({ ...row, exercise: row.exercise ?? null })

export function serializePreSessionPatch(
  p: PreSessionExercisePatch,
): SerializedPreSessionExercisePatch {
  return {
    deletedIds: [...p.deletedIds],
    swappedRows: [...p.swappedRows.entries()],
    addedRows: [...p.addedRows],
  }
}

export function deserializePreSessionPatch(
  s: SerializedPreSessionExercisePatch,
): PreSessionExercisePatch {
  return {
    deletedIds: new Set(s.deletedIds),
    swappedRows: new Map(
      s.swappedRows.map(([id, row]) => [id, withEmbed(row)] as const),
    ),
    addedRows: s.addedRows.map(withEmbed),
  }
}
