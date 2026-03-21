import type { WorkoutExercise } from "@/types/database"

export function canStartPreSession(exercises: WorkoutExercise[]): boolean {
  if (exercises.length === 0) return false
  return exercises.every((ex) => ex.sets >= 1)
}
