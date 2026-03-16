import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"

export function useCreateProgram() {
  const user = useAtomValue(authAtom)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("programs")
        .insert({
          user_id: user.id,
          name,
          is_active: false,
          template_id: null,
        })
        .select("id")
        .single()

      if (error) throw error
      return data.id as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-programs"] })
    },
  })
}
