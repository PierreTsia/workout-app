import type { ExerciseListItem } from "./database"

export type Duration = 15 | 30 | 45 | 60 | 90

export type EquipmentCategory = "bodyweight" | "dumbbells" | "full-gym"

export interface GeneratorConstraints {
  duration: Duration
  /** At least one. If `"full-gym"` is present, it must be the only entry. */
  equipmentCategories: EquipmentCategory[]
  muscleGroups: string[]
  /** Optional AI hint (Quick Generate ignores). Max length enforced in UI and edge. */
  focusAreas?: string
}

export interface GeneratedExercise {
  // Narrowed to the slim catalog shape (T69). The only rich field the
  // generator consumes is `secondary_muscles` (isCompound), which is now
  // in ExerciseListItem.
  exercise: ExerciseListItem
  sets: number
  reps: string
  restSeconds: number
  isCompound: boolean
}

export interface GeneratedWorkout {
  exercises: GeneratedExercise[]
  name: string
  hasFallback: boolean
  /** Present when built via AI Generate; cleared after shuffle / Quick Generate. */
  rationale?: string
}
