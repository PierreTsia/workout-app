import { z } from "zod"
import type { UserGender } from "@/types/onboarding"

export const goalOptions = ["strength", "hypertrophy", "endurance", "general_fitness"] as const
export const experienceOptions = ["beginner", "intermediate", "advanced"] as const
export const equipmentOptions = ["gym", "minimal", "home"] as const
export const genderOptions = ["male", "female", "other", "prefer_not_to_say"] as const
export const durationOptions = ["30", "45", "60", "90"] as const

export const questionnaireSchema = z.object({
  gender: z.enum(genderOptions, { message: "Required" }),
  goal: z.enum(goalOptions, { message: "Required" }),
  experience: z.enum(experienceOptions, { message: "Required" }),
  equipment: z.enum(equipmentOptions, { message: "Required" }),
  training_days_per_week: z.number().int().min(2).max(6),
  session_duration_minutes: z.enum(durationOptions),
  age: z.string().min(1, "Required").regex(/^\d+$/, "Must be a number"),
  weight: z.string().min(1, "Required").regex(/^\d+(\.\d+)?$/, "Must be a number"),
})

export type QuestionnaireValues = z.infer<typeof questionnaireSchema>

export interface QuestionnaireOutput {
  gender: UserGender
  goal: QuestionnaireValues["goal"]
  experience: QuestionnaireValues["experience"]
  equipment: QuestionnaireValues["equipment"]
  training_days_per_week: number
  session_duration_minutes: number
  age: number
  weight: number
}

export function toQuestionnaireOutput(data: QuestionnaireValues): QuestionnaireOutput {
  return {
    gender: data.gender,
    goal: data.goal,
    experience: data.experience,
    equipment: data.equipment,
    training_days_per_week: data.training_days_per_week,
    session_duration_minutes: Number(data.session_duration_minutes),
    age: Number(data.age),
    weight: Number(data.weight),
  }
}
