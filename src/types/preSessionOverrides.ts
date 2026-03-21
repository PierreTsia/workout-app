import type { WorkoutExercise } from "@/types/database"

/** Ephemeral edits before Start; cleared on day change, after permanent writes, or new session. */
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
