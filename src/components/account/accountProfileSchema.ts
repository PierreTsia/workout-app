import { z } from "zod"
import { questionnaireSchema } from "@/components/onboarding/schema"

export const accountProfileSchema = questionnaireSchema.extend({
  display_name: z
    .string()
    .min(5, { message: "DISPLAY_NAME_MIN_LEN" })
    .max(80, { message: "DISPLAY_NAME_MAX_LEN" }),
})

export type AccountProfileFormValues = z.infer<typeof accountProfileSchema>
