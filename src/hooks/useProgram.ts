import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"

export function useProgram(programId: string | null) {
  const user = useAtomValue(authAtom)

  return useQuery({
    queryKey: ["program", user?.id ?? "", programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, name, is_active, archived_at, template_id, created_at")
        .eq("id", programId!)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!programId && !!user,
    refetchOnMount: "always",
  })
}
