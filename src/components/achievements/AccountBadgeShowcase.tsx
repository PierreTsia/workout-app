import { useTranslation } from "react-i18next"
import { useBadgeStatus } from "@/hooks/useBadgeStatus"
import { useUserProfile } from "@/hooks/useUserProfile"
import { BadgeIcon } from "./BadgeIcon"
import { cn } from "@/lib/utils"
import type { AchievementRank, BadgeStatusRow } from "@/types/achievements"

const rankColorText: Record<AchievementRank, string> = {
  bronze: "text-amber-600",
  silver: "text-slate-300",
  gold: "text-yellow-400",
  platinum: "text-blue-300",
  diamond: "text-purple-400",
}

export function AccountBadgeShowcase() {
  const { t, i18n } = useTranslation("achievements")
  const { data: rows = [] } = useBadgeStatus()
  const { data: profile } = useUserProfile()

  const unlockedCount = rows.filter((r) => r.is_unlocked).length
  const totalCount = rows.length

  const activeTitle = profile?.active_title_tier_id
    ? rows.find((r) => r.tier_id === profile.active_title_tier_id)
    : null

  const groups = [...new Set(rows.map((r) => r.group_slug))]
  const topPerGroup = groups.map((slug) => {
    const tiers = rows.filter((r) => r.group_slug === slug)
    return (
      [...tiers].reverse().find((t) => t.is_unlocked) ??
      tiers[0]
    )
  }).filter(Boolean) as BadgeStatusRow[]

  if (totalCount === 0) return null

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("showcase")}</h2>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {t("unlockedCount", { count: unlockedCount, total: totalCount })}
        </span>
      </div>

      {activeTitle && (
        <p
          className={cn(
            "mb-3 text-center text-sm font-semibold italic",
            rankColorText[activeTitle.rank],
          )}
        >
          {i18n.language === "fr" ? activeTitle.title_fr : activeTitle.title_en}
        </p>
      )}

      <div className="flex justify-center gap-3">
        {topPerGroup.map((tier) => (
          <BadgeIcon
            key={tier.group_slug}
            rank={tier.rank}
            iconUrl={tier.icon_asset_url}
            size="sm"
            locked={!tier.is_unlocked}
            alt={i18n.language === "fr" ? tier.title_fr : tier.title_en}
          />
        ))}
      </div>
    </section>
  )
}
