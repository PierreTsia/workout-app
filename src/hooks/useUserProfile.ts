import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { UserProfile } from "@/types/onboarding"

export function useUserProfile() {
  const user = useAtomValue(authAtom)

  return useQuery<UserProfile | null>({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle()

      if (error) throw error
      return data as UserProfile | null
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  })
}
