import { useMutation, useQueryClient } from "@tanstack/react-query"
import { EXERCISES_BATCH_QUERY_KEY } from "@/hooks/useExerciseBatch"
import { TRANSLATION_REVIEW_QUEUE_KEY } from "@/hooks/useTranslationReviewQueue"
import { supabase } from "@/lib/supabase"
import type { ExerciseInstructions } from "@/types/database"

/**
 * The write reached the database and changed nothing.
 *
 * RLS refusing an UPDATE is not an error over PostgREST: the request succeeds
 * and matches zero rows. Without this the mutation resolves, the card shows the
 * green toast, and the row sits in the queue with the reviewer unable to tell a
 * refused write from a slow one. Typed rather than a bare `Error` so the card
 * can say the database refused it instead of blaming the network — the same
 * reason `useCreatePAT` names its failures.
 */
export class TranslationWriteRefusedError extends Error {
  constructor() {
    super("translation write refused: the update matched no row")
    this.name = "TranslationWriteRefusedError"
  }
}

/**
 * The two verdicts a reviewer can hand down. `clean` is absent on purpose: it is
 * the pipeline's opinion, and this hook only records a human's.
 */
export type TranslationVerdict = "approved" | "flagged"

export interface TranslationDecision {
  exerciseId: string
  status: TranslationVerdict
  /** Corrected English, when the reviewer fixed a typo before approving. */
  instructionsEn?: ExerciseInstructions
}

/**
 * Records a translation review decision.
 *
 * Deliberately not `useAdminUpdateExercise`: that hook stamps `reviewed_at` and
 * `reviewed_by` on every call, and those two belong to content review and image
 * enrichment. Writing them from here would empty /admin/review's queue without
 * anyone having read the exercise. Hence its own, short column list.
 *
 * `instructions_en_audit` is not in that list either, and the ticket does not
 * say what should happen to it on a manual edit. It is left alone: the audit
 * records which model produced the draft and what the cross-checker objected
 * to, and a human correcting a sentence afterwards does not change either of
 * those facts. The stale objection is invisible in practice — the row leaves
 * the queue the moment it is decided — and erasing the provenance would make a
 * future re-run undiffable, which story 12 of the epic exists to prevent.
 *
 * There is no optimistic concurrency control. The epic assumes a single
 * reviewer, so the losing write of a genuine race would be a second decision by
 * the same person; last one wins.
 */
export function useApproveTranslation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      exerciseId,
      status,
      instructionsEn,
    }: TranslationDecision) => {
      const payload = {
        instructions_en_status: status,
        instructions_en_reviewed_at: new Date().toISOString(),
        ...(instructionsEn ? { instructions_en: instructionsEn } : {}),
      }

      // `select("id")` and not `select()`: the response is only ever counted,
      // and the full row carries both instruction blobs. The precedent is
      // `scripts/translate-instructions.ts`, which asks for the same one column.
      const { data, error } = await supabase
        .from("exercises")
        .update(payload)
        .eq("id", exerciseId)
        .select("id")
      if (error) throw error
      if (data?.length !== 1) throw new TranslationWriteRefusedError()
    },
    // The queue key plus the four caches useAdminUpdateExercise invalidates: the
    // same catalog row is cached by id, by batch, by admin list and by library
    // page, and an approved translation changes what all four render.
    //
    // The id comes from the variables rather than from a hook argument because
    // the caller is a queue walking one row after another — binding the hook to
    // an id would mean re-creating the mutation on every decision.
    onSuccess: (_data, { exerciseId }) => {
      queryClient.invalidateQueries({ queryKey: [TRANSLATION_REVIEW_QUEUE_KEY] })
      queryClient.invalidateQueries({ queryKey: ["exercise", exerciseId] })
      queryClient.invalidateQueries({ queryKey: [EXERCISES_BATCH_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: ["admin-exercises"] })
      queryClient.invalidateQueries({ queryKey: ["exercise-library-paginated"] })
    },
  })
}
