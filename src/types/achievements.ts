export type AchievementRank = "bronze" | "silver" | "gold" | "platinum" | "diamond"

export interface AchievementGroup {
  id: string
  slug: string
  name_fr: string
  name_en: string
  description_fr: string | null
  description_en: string | null
  metric_type: string
  sort_order: number
}

export interface AchievementTier {
  id: string
  group_id: string
  tier_level: number
  rank: AchievementRank
  title_fr: string
  title_en: string
  threshold_value: number
  icon_asset_url: string | null
}

export interface UserAchievement {
  id: string
  user_id: string
  tier_id: string
  granted_at: string
}

/** Matches the return shape of `get_badge_status` RPC. */
export interface BadgeStatusRow {
  group_id: string
  group_slug: string
  group_name_en: string
  group_name_fr: string
  tier_id: string
  tier_level: number
  rank: AchievementRank
  title_en: string
  title_fr: string
  threshold_value: number
  icon_asset_url: string | null
  is_unlocked: boolean
  granted_at: string | null
  current_value: number
  progress_pct: number
}

/** Matches the return shape of `check_and_grant_achievements` RPC. */
export interface UnlockedAchievement {
  tier_id: string
  group_slug: string
  rank: AchievementRank
  title_en: string
  title_fr: string
  icon_asset_url: string | null
}
