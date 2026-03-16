import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export function useProgram(programId: string | null) {
  return useQuery({
    queryKey: ["program", programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, name, is_active, archived_at, template_id, created_at")
        .eq("id", programId!)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!programId,
  })
}
