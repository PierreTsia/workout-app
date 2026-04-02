import type { Exercise } from "./database"

export type UserGoal = "strength" | "hypertrophy" | "endurance" | "general_fitness"
export type UserExperience = "beginner" | "intermediate" | "advanced"
export type UserEquipment = "home" | "gym" | "minimal"
export type UserGender = "male" | "female" | "other" | "prefer_not_to_say"

export interface UserProfile {
  user_id: string
  /** When set, shown instead of OAuth `full_name` in the app shell. */
  display_name: string | null
  /** When set, shown instead of OAuth `avatar_url` (custom upload in `avatars` bucket). */
  avatar_url: string | null
  age: number
  weight_kg: number
  gender: UserGender
  goal: UserGoal
  experience: UserExperience
  equipment: UserEquipment
  training_days_per_week: number
  session_duration_minutes: number
  active_title_tier_id: string | null
  created_at: string
  updated_at: string
}

export interface ProgramTemplate {
  id: string
  name: string
  description: string | null
  min_days: number
  max_days: number
  primary_goal: UserGoal
  experience_tags: UserExperience[]
  template_days: TemplateDay[]
}

export interface TemplateDay {
  id: string
  template_id: string
  day_label: string
  day_number: number
  muscle_focus: string | null
  sort_order: number
  template_exercises: TemplateExercise[]
}

export interface TemplateExercise {
  id: string
  template_day_id: string
  exercise_id: string
  sets: number
  rep_range: string
  rest_seconds: number
  sort_order: number
  exercise?: Exercise
}

export interface Program {
  id: string
  user_id: string
  name: string
  template_id: string | null
  is_active: boolean
  archived_at: string | null
  created_at: string
}

export interface ExerciseAlternative {
  exercise_id: string
  alternative_exercise_id: string
  equipment_context: "home" | "minimal"
}
