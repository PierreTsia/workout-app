import { z } from "zod"
import { questionnaireSchema } from "@/components/onboarding/schema"

export const accountProfileSchema = questionnaireSchema.extend({
  /** Empty allowed (falls back to email); non-empty max 80 for DB / UX. */
  display_name: z.string().max(80, { message: "DISPLAY_NAME_MAX_LEN" }),
})

export type AccountProfileFormValues = z.infer<typeof accountProfileSchema>
