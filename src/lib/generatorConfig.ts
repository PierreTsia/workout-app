import type { Duration, EquipmentCategory } from "@/types/generator"

export interface VolumeConfig {
  exerciseCount: number
  setsPerExercise: number
}

export const VOLUME_MAP: Record<Duration, VolumeConfig> = {
  15: { exerciseCount: 4, setsPerExercise: 3 },
  30: { exerciseCount: 5, setsPerExercise: 3 },
  45: { exerciseCount: 7, setsPerExercise: 4 },
  60: { exerciseCount: 9, setsPerExercise: 4 },
  90: { exerciseCount: 13, setsPerExercise: 4 },
} as const

export const EQUIPMENT_CATEGORY_MAP: Record<EquipmentCategory, string[]> = {
  bodyweight: ["bodyweight"],
  dumbbells: ["dumbbell"],
  "full-gym": [
    "barbell",
    "dumbbell",
    "ez_bar",
    "machine",
    "cable",
    "bench",
    "kettlebell",
    "band",
  ],
} as const

// These values must match the `muscle_group` column in the `exercises` table.
// Source of truth: Supabase `exercises.muscle_group` (French labels used as DB identifiers).
export const MAJOR_MUSCLE_GROUPS = [
  "Pectoraux",
  "Dos",
  "Quadriceps",
  "Épaules",
  "Biceps",
  "Triceps",
  "Ischios",
  "Abdos",
] as const

export const COMPOUND_REPS = "10"
export const COMPOUND_REST_SECONDS = 90
export const ISOLATION_REPS = "12"
export const ISOLATION_REST_SECONDS = 60
