import type { Exercise } from "./database"

export type Duration = 15 | 30 | 45 | 60 | 90

export type EquipmentCategory = "bodyweight" | "dumbbells" | "full-gym"

export interface GeneratorConstraints {
  duration: Duration
  equipmentCategory: EquipmentCategory
  muscleGroup: string | "full-body"
}

export interface GeneratedExercise {
  exercise: Exercise
  sets: number
  reps: string
  restSeconds: number
  isCompound: boolean
}

export interface GeneratedWorkout {
  exercises: GeneratedExercise[]
  name: string
  fallbackNotice: string | null
}
