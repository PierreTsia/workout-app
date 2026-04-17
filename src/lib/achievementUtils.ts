import type { AchievementRank, BadgeStatusRow } from "@/types/achievements"
import type { UserProfile } from "@/types/onboarding"

export const rankColorText: Record<AchievementRank, string> = {
  bronze: "text-amber-600",
  silver: "text-slate-300",
  gold: "text-yellow-400",
  platinum: "text-blue-300",
  diamond: "text-purple-400",
}

export function resolveActiveTitle(
  profile: UserProfile | null | undefined,
  rows: BadgeStatusRow[],
): BadgeStatusRow | null {
  if (!profile?.active_title_tier_id) return null
  return rows.find((r) => r.tier_id === profile.active_title_tier_id) ?? null
}
