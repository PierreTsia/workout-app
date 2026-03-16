import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export function useUpdateProgramName() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      programId,
      name,
    }: {
      programId: string
      name: string
    }) => {
      const { error } = await supabase
        .from("programs")
        .update({ name })
        .eq("id", programId)

      if (error) throw error
    },
    onSuccess: (_data, { programId }) => {
      qc.invalidateQueries({ queryKey: ["program", programId] })
      qc.invalidateQueries({ queryKey: ["user-programs"] })
    },
  })
}
