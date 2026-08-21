import type {
  AchievementRank,
  BadgeStatusRow,
  UnlockedAchievement,
} from "@/types/achievements"
import type { UserProfile } from "@/types/onboarding"

export const rankColorText: Record<AchievementRank, string> = {
  bronze: "text-amber-600",
  silver: "text-slate-300",
  gold: "text-yellow-400",
  platinum: "text-blue-300",
  diamond: "text-purple-400",
}

export const rankColorRing: Record<AchievementRank, string> = {
  bronze: "ring-amber-600",
  silver: "ring-slate-300",
  gold: "ring-yellow-400",
  platinum: "ring-blue-300",
  diamond: "ring-purple-400",
}

const RANK_ORDER: Record<AchievementRank, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
  platinum: 3,
  diamond: 4,
}

export function pickHero(batch: UnlockedAchievement[]): UnlockedAchievement {
  return batch.reduce((hero, item) =>
    RANK_ORDER[item.rank] > RANK_ORDER[hero.rank] ? item : hero,
  )
}

export function supportingMedals(
  batch: UnlockedAchievement[],
  hero: UnlockedAchievement,
): UnlockedAchievement[] {
  return batch.filter((item) => item.tier_id !== hero.tier_id)
}

export function supportingOverflow(supporting: UnlockedAchievement[]): {
  visible: UnlockedAchievement[]
  overflowCount: number
} {
  const visible = supporting.slice(0, 3)
  const overflowCount = Math.max(0, supporting.length - 3)
  return { visible, overflowCount }
}

/** PostgREST NUMERIC often arrives as a string. Domain values stay `number`. */
export function coerceNumeric(value: unknown): number {
  if (typeof value === "number" || typeof value === "string") {
    return Number(value)
  }
  return Number.NaN
}

export function resolveActiveTitle(
  profile: UserProfile | null | undefined,
  rows: BadgeStatusRow[],
): BadgeStatusRow | null {
  if (!profile?.active_title_tier_id) return null
  return rows.find((r) => r.tier_id === profile.active_title_tier_id) ?? null
}
