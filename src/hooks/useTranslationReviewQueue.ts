import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { ExerciseInstructions, TranslationAudit } from "@/types/database"

/**
 * One row of `get_translations_for_review` — eight columns, not the whole
 * exercise. The queue renders a comparison, not an exercise card, so it has no
 * use for emoji, difficulty or any column added to `exercises` later.
 */
export interface TranslationReviewRow {
  id: string
  name: string
  name_en: string | null
  instructions: ExerciseInstructions | null
  instructions_en: ExerciseInstructions | null
  instructions_en_status: string | null
  instructions_en_audit: TranslationAudit | null
  logged_sets: number
}

export const TRANSLATION_REVIEW_QUEUE_KEY = "translations-for-review"

/**
 * The order is the RPC's — flagged first, then reading exposure, then name.
 * Nothing here re-sorts: a second opinion on the order in the client would be
 * one more place for it to drift away from the one the queue is specified in.
 */
export function useTranslationReviewQueue() {
  return useQuery({
    queryKey: [TRANSLATION_REVIEW_QUEUE_KEY],
    queryFn: async (): Promise<TranslationReviewRow[]> => {
      const { data, error } = await supabase.rpc("get_translations_for_review")
      if (error) throw error
      return (data ?? []) as TranslationReviewRow[]
    },
  })
}
