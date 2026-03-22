import { z } from "zod"
import { questionnaireSchema } from "@/components/onboarding/schema"

export const accountProfileSchema = questionnaireSchema.extend({
  display_name: z.string().max(80),
})

export type AccountProfileFormValues = z.infer<typeof accountProfileSchema>
