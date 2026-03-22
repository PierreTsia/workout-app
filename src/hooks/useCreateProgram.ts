import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { getDefaultStore } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom, hasProgramAtom, activeProgramIdAtom } from "@/store/atoms"

const store = getDefaultStore()

export function useCreateProgram() {
  const user = useAtomValue(authAtom)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      if (!user) throw new Error("Not authenticated")

      const { error: deactivateError } = await supabase
        .from("programs")
        .update({ is_active: false })
        .eq("user_id", user.id)
        .eq("is_active", true)

      if (deactivateError) throw deactivateError

      const { data, error } = await supabase
        .from("programs")
        .insert({
          user_id: user.id,
          name,
          is_active: true,
          template_id: null,
        })
        .select("id")
        .single()

      if (error) throw error
      return data.id as string
    },
    onSuccess: (programId) => {
      store.set(hasProgramAtom, true)
      store.set(activeProgramIdAtom, programId)
      qc.invalidateQueries({ queryKey: ["workout-days"] })
      qc.invalidateQueries({ queryKey: ["active-program"] })
      qc.invalidateQueries({ queryKey: ["user-programs"] })
    },
  })
}
