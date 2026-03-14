import { z } from "zod"

export const goalOptions = ["strength", "hypertrophy", "endurance", "general_fitness"] as const
export const experienceOptions = ["beginner", "intermediate", "advanced"] as const
export const equipmentOptions = ["gym", "minimal", "home"] as const
export const genderOptions = ["male", "female", "other", "prefer_not_to_say"] as const
export const durationOptions = [30, 45, 60, 90] as const

export const questionnaireSchema = z.object({
  gender: z.enum(genderOptions).optional().transform((v) => v ?? null),
  goal: z.enum(goalOptions),
  experience: z.enum(experienceOptions),
  equipment: z.enum(equipmentOptions),
  training_days_per_week: z.number().int().min(2).max(6),
  session_duration_minutes: z.enum(["30", "45", "60", "90"]).transform(Number),
  age: z
    .union([z.literal(""), z.string()])
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int().positive().nullable()),
  weight: z
    .union([z.literal(""), z.string()])
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().positive().nullable()),
})

export type QuestionnaireValues = z.input<typeof questionnaireSchema>
export type QuestionnaireOutput = z.output<typeof questionnaireSchema>
