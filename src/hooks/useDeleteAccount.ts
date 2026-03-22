import { useMutation } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("delete-account", {
        method: "POST",
      })
      if (error) throw error
    },
  })
}
