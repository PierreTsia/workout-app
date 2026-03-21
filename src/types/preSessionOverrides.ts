import type { WorkoutExercise } from "@/types/database"

/**
 * Ephemeral list edits (session-only swaps/adds/deletes). Cleared on day change (when not
 * active), after permanent writes, or new session. While `session.isActive`, the patch is also
 * persisted to localStorage so a full page reload does not drop in-session edits.
 */
export interface PreSessionExercisePatch {
  deletedIds: Set<string>
  swappedRows: Map<string, WorkoutExercise>
  addedRows: WorkoutExercise[]
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
  swappedRows: [string, WorkoutExercise][]
  addedRows: WorkoutExercise[]
}

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
    swappedRows: new Map(s.swappedRows),
    addedRows: [...s.addedRows],
  }
}
