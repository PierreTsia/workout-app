import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { getDefaultStore } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom, hasProgramAtom, activeProgramIdAtom } from "@/store/atoms"
import { useTrackEvent } from "@/hooks/useTrackEvent"

const store = getDefaultStore()

export function useActivateProgram() {
  const user = useAtomValue(authAtom)
  const qc = useQueryClient()
  const trackEvent = useTrackEvent()

  return useMutation({
    mutationFn: async ({ programId }: { programId: string }) => {
      if (!user) throw new Error("Not authenticated")

      const { data: current } = await supabase
        .from("programs")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle()

      const currentId = current?.id ?? null

      if (currentId) {
        const { error: deactivateError } = await supabase
          .from("programs")
          .update({ is_active: false })
          .eq("id", currentId)

        if (deactivateError) throw deactivateError
      }

      const { error: activateError } = await supabase
        .from("programs")
        .update({ is_active: true })
        .eq("id", programId)

      if (activateError) {
        if (currentId) {
          const { error: rollbackError } = await supabase
            .from("programs")
            .update({ is_active: true })
            .eq("id", currentId)

          if (rollbackError) {
            throw new Error(
              `Activation failed and rollback also failed: ${activateError.message} | Rollback: ${rollbackError.message}`,
            )
          }
        }
        throw activateError
      }

      return { oldProgramId: currentId, newProgramId: programId }
    },

    onSuccess: ({ oldProgramId, newProgramId }) => {
      store.set(hasProgramAtom, true)
      store.set(activeProgramIdAtom, newProgramId)
      qc.invalidateQueries({ queryKey: ["active-program"] })
      qc.invalidateQueries({ queryKey: ["workout-days"] })
      qc.invalidateQueries({ queryKey: ["user-programs"] })

      trackEvent.mutate({
        eventType: "program_activated",
        payload: { old_program_id: oldProgramId, new_program_id: newProgramId },
      })
    },
  })
}
