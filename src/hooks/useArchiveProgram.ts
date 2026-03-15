import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useTrackEvent } from "@/hooks/useTrackEvent"

export function useArchiveProgram() {
  const qc = useQueryClient()
  const trackEvent = useTrackEvent()

  return useMutation({
    mutationFn: async ({ programId, archive }: { programId: string; archive: boolean }) => {
      const { error } = await supabase
        .from("programs")
        .update({ archived_at: archive ? new Date().toISOString() : null })
        .eq("id", programId)

      if (error) throw error
      return { programId, archive }
    },

    onSuccess: ({ programId, archive }) => {
      qc.invalidateQueries({ queryKey: ["user-programs"] })

      trackEvent.mutate({
        eventType: archive ? "program_archived" : "program_unarchived",
        payload: { program_id: programId },
      })
    },
  })
}
