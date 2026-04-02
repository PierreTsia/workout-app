import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { BadgeStatusRow } from "@/types/achievements"

export function useBadgeStatus() {
  const user = useAtomValue(authAtom)
  return useQuery<BadgeStatusRow[]>({
    queryKey: ["badge-status", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_badge_status", {
        p_user_id: user!.id,
      })
      if (error) throw error
      return (data ?? []) as BadgeStatusRow[]
    },
    enabled: !!user,
  })
}
