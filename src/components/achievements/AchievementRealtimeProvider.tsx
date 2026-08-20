import { useEffect } from "react"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import { useBadgeStatus } from "@/hooks/useBadgeStatus"
import { pushAchievementsToQueue } from "@/lib/syncService"
import type { UnlockedAchievement } from "@/types/achievements"

/**
 * Global Realtime subscription for `user_achievements` INSERT events.
 * Enriches the raw event with cached tier/group data and pushes into
 * the overlay queue (with dedup handled by `pushAchievementsToQueue`).
 *
 * Mount once inside `AppShell` — auth-gated, cleans up on unmount/logout.
 */
export function AchievementRealtimeProvider({ children }: { children: React.ReactNode }) {
  const user = useAtomValue(authAtom)
  const { data: badgeRows } = useBadgeStatus()

  useEffect(() => {
    if (!user || !badgeRows) return

    const subscriptionStartedAt = Date.now()

    const channel = supabase
      .channel("achievements")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_achievements",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const grantedAt = payload.new.granted_at
          if (typeof grantedAt !== "string") return
          if (new Date(grantedAt).getTime() < subscriptionStartedAt) return

          const tierId = payload.new.tier_id
          if (typeof tierId !== "string") return
          const match = badgeRows.find((r) => r.tier_id === tierId)
          if (!match) return

          const unlocked: UnlockedAchievement = {
            tier_id: match.tier_id,
            group_slug: match.group_slug,
            rank: match.rank,
            title_en: match.title_en,
            title_fr: match.title_fr,
            icon_asset_url: match.icon_asset_url,
            threshold_value: match.threshold_value,
            granted_at: grantedAt,
          }
          pushAchievementsToQueue([unlocked])
        },
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [user, badgeRows])

  return <>{children}</>
}
