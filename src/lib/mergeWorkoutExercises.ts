import type { PreSessionExercisePatch } from "@/types/preSessionOverrides"
import type { WorkoutExerciseWithLabel } from "@/types/database"

export function mergeWorkoutExercises(
  base: WorkoutExerciseWithLabel[],
  patch: PreSessionExercisePatch,
): WorkoutExerciseWithLabel[] {
  return [
    ...base
      .filter((row) => !patch.deletedIds.has(row.id))
      .map((row) => patch.swappedRows.get(row.id) ?? row),
    ...patch.addedRows,
  ].sort((a, b) => a.sort_order - b.sort_order)
}
