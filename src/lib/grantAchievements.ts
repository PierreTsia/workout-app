import { supabase } from "@/lib/supabase"
import { coerceNumeric } from "@/lib/achievementUtils"
import type { UnlockedAchievement } from "@/types/achievements"

/**
 * Runs the achievement grant RPC for a user and returns the newly unlocked
 * tiers (#660). Idempotent — the RPC guards on `(user, tier)` — so it is safe
 * to call after any close, including the orphan self-heal (ADR 0024).
 *
 * Never throws: on failure it warns and returns `[]`, so a badge check can
 * never break the session close it follows.
 */
export async function grantAchievementsForUser(
  userId: string,
): Promise<UnlockedAchievement[]> {
  try {
    const { data, error } = await supabase
      .rpc("check_and_grant_achievements", { p_user_id: userId })
      .returns<UnlockedAchievement[]>()
    if (error) throw error

    const grantedAt = new Date().toISOString()
    return (Array.isArray(data) ? data : []).map((row) => ({
      ...row,
      threshold_value: coerceNumeric(row.threshold_value),
      granted_at: row.granted_at ?? grantedAt,
    }))
  } catch (e) {
    console.warn("[grantAchievements] badge check failed (non-critical)", e)
    return []
  }
}
