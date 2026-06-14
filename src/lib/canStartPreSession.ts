import type {
  ExerciseBlockWithExercises,
  WorkoutExercise,
} from "@/types/database"

/**
 * A day is startable when it has something valid to do. Solo exercises must each
 * carry ≥1 set (else SetsTable/volume break); a day made purely of blocks is
 * still startable since blocks don't depend on `sets` (#351).
 */
export function canStartPreSession(
  exercises: WorkoutExercise[],
  blocks: ExerciseBlockWithExercises[] = [],
): boolean {
  if (exercises.length > 0) return exercises.every((ex) => ex.sets >= 1)
  return blocks.length > 0
}
