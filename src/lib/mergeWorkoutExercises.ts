import type { PreSessionExercisePatch } from "@/types/preSessionOverrides"
import type { WorkoutExercise } from "@/types/database"

export function mergeWorkoutExercises(
  base: WorkoutExercise[],
  patch: PreSessionExercisePatch,
): WorkoutExercise[] {
  return [
    ...base
      .filter((row) => !patch.deletedIds.has(row.id))
      .map((row) => patch.swappedRows.get(row.id) ?? row),
    ...patch.addedRows,
  ].sort((a, b) => a.sort_order - b.sort_order)
}
