import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { Program } from "@/types/onboarding"

export function useUserPrograms() {
  const user = useAtomValue(authAtom)

  return useQuery<Program[]>({
    queryKey: ["user-programs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, user_id, name, template_id, is_active, archived_at, created_at")
        .eq("user_id", user!.id)
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: false })

      if (error) throw error
      return data as Program[]
    },
    enabled: !!user,
  })
}
