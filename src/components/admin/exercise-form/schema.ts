import { z } from "zod"

const instructionStepSchema = z.object({ value: z.string() })

export const exerciseFormSchema = z.object({
  name: z.string().min(1, "Required"),
  name_en: z.string().nullable(),
  muscle_group: z.string().min(1, "Required"),
  equipment: z.string(),
  emoji: z.string().min(1, "Required"),
  secondary_muscles: z.string(),
  youtube_url: z.string().nullable(),
  image_url: z.string().nullable(),
  source: z.string().nullable(),
  difficulty_level: z
    .enum(["beginner", "intermediate", "advanced", ""])
    .nullable(),
  measurement_type: z.enum(["reps", "duration"]),
  default_duration_seconds: z.number().positive().nullable(),
  instructions: z.object({
    setup: z.array(instructionStepSchema),
    movement: z.array(instructionStepSchema),
    breathing: z.array(instructionStepSchema),
    common_mistakes: z.array(instructionStepSchema),
  }),
})

export type ExerciseFormValues = z.infer<typeof exerciseFormSchema>
