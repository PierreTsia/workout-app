import type { GeneratedExercise } from "./generator"

export interface GenerateProgramConstraints {
  daysPerWeek: number
  duration: number
  equipmentCategory: string
  goal: string
  experience: string
  focusAreas?: string
  splitPreference?: string
  locale?: string
}

export interface AIGeneratedDay {
  label: string
  muscleFocus: string
  exercises: GeneratedExercise[]
}

export interface AIGeneratedProgram {
  rationale: string
  days: AIGeneratedDay[]
}
