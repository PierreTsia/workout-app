import { z } from "zod"
import type { ExerciseContentFeedbackInsert, FeedbackSourceScreen as DBFeedbackSourceScreen } from "@/types/database"

const illustrationOptions = ["wrong_exercise", "misleading_angle", "other"] as const
const videoOptions = ["different_exercise", "poor_quality", "other"] as const
const descriptionOptions = ["unrelated", "wrong_muscle", "missing_steps", "other"] as const

export const feedbackFormSchema = z
  .object({
    whatIllustration: z.boolean(),
    whatVideo: z.boolean(),
    whatDescription: z.boolean(),
    illustration: z.array(z.enum(illustrationOptions)),
    video: z.array(z.enum(videoOptions)),
    description: z.array(z.enum(descriptionOptions)),
    other_illustration_text: z.string(),
    other_video_text: z.string(),
    other_description_text: z.string(),
    comment: z.string(),
  })
  .superRefine((data, ctx) => {
    const atLeastOne =
      data.whatIllustration || data.whatVideo || data.whatDescription
    if (!atLeastOne) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "atLeastOneRequired",
        path: ["whatIllustration"],
      })
    }
    if (data.whatIllustration && data.illustration.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "atLeastOneRequired",
        path: ["illustration"],
      })
    }
    if (data.whatVideo && data.video.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "atLeastOneRequired",
        path: ["video"],
      })
    }
    if (data.whatDescription && data.description.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "atLeastOneRequired",
        path: ["description"],
      })
    }
    if (data.whatIllustration && data.illustration.includes("other") && !data.other_illustration_text.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "otherRequired",
        path: ["other_illustration_text"],
      })
    }
    if (data.whatVideo && data.video.includes("other") && !data.other_video_text.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "otherRequired",
        path: ["other_video_text"],
      })
    }
    if (data.whatDescription && data.description.includes("other") && !data.other_description_text.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "otherRequired",
        path: ["other_description_text"],
      })
    }
  })

export type FeedbackFormValues = z.infer<typeof feedbackFormSchema>

export type FeedbackSourceScreen = DBFeedbackSourceScreen

export function formValuesToPayload(
  values: FeedbackFormValues,
  exerciseId: string,
  userEmail: string,
  userId: string,
  sourceScreen: FeedbackSourceScreen,
): ExerciseContentFeedbackInsert {
  const fields_reported: string[] = []
  const error_details: Record<string, string[]> = {}

  if (values.whatIllustration && values.illustration.length > 0) {
    fields_reported.push("illustration")
    error_details.illustration = [...values.illustration]
  }
  if (values.whatVideo && values.video.length > 0) {
    fields_reported.push("video")
    error_details.video = [...values.video]
  }
  if (values.whatDescription && values.description.length > 0) {
    fields_reported.push("description")
    error_details.description = [...values.description]
  }

  return {
    exercise_id: exerciseId,
    user_email: userEmail,
    user_id: userId,
    source_screen: sourceScreen,
    fields_reported,
    error_details,
    other_illustration_text: values.other_illustration_text?.trim() || null,
    other_video_text: values.other_video_text?.trim() || null,
    other_description_text: values.other_description_text?.trim() || null,
    comment: values.comment?.trim() || null,
  }
}
