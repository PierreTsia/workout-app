import { useState, useCallback } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { supabase } from "@/lib/supabase"
import type { ExerciseContentFeedbackInsert } from "@/types/database"

export function useSubmitFeedback() {
  const { t } = useTranslation("feedback")
  const [isPending, setPending] = useState(false)

  const submit = useCallback(
    async (payload: ExerciseContentFeedbackInsert) => {
      setPending(true)
      try {
        const { error } = await supabase
          .from("exercise_content_feedback")
          .insert({
            exercise_id: payload.exercise_id,
            user_email: payload.user_email,
            user_id: payload.user_id,
            source_screen: payload.source_screen,
            fields_reported: payload.fields_reported,
            error_details: payload.error_details,
            other_illustration_text: payload.other_illustration_text,
            other_video_text: payload.other_video_text,
            other_description_text: payload.other_description_text,
            comment: payload.comment,
          })
        if (error) throw error
      } catch {
        toast.error(t("errorToast"))
        throw new Error("Feedback submit failed")
      } finally {
        setPending(false)
      }
    },
    [t],
  )

  return { submit, isPending }
}
