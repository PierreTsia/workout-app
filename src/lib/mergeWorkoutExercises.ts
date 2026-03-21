import type { PreSessionExercisePatch } from "@/types/preSessionOverrides"
import type { WorkoutExercise } from "@/types/database"

export function mergeWorkoutExercises(
  base: WorkoutExercise[],
  patch: PreSessionExercisePatch,
): WorkoutExercise[] {
  const out: WorkoutExercise[] = []
  for (const row of base) {
    if (patch.deletedIds.has(row.id)) continue
    out.push(patch.swappedRows.get(row.id) ?? row)
  }
  out.push(...patch.addedRows)
  out.sort((a, b) => a.sort_order - b.sort_order)
  return out
}
