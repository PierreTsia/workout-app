import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { Program } from "@/types/onboarding"

export function useActiveProgram() {
  const user = useAtomValue(authAtom)

  return useQuery<Program | null>({
    queryKey: ["active-program", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, user_id, name, template_id, is_active, created_at")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .single()

      if (error && error.code === "PGRST116") return null
      if (error) throw error
      return data as Program
    },
    enabled: !!user,
  })
}
