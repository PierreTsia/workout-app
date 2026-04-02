import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useBadgeStatus } from "@/hooks/useBadgeStatus"
import { BadgeIcon } from "./BadgeIcon"
import { BadgeDetailDrawer } from "./BadgeDetailDrawer"
import { cn } from "@/lib/utils"
import type { BadgeStatusRow, AchievementRank } from "@/types/achievements"

const rankColorText: Record<AchievementRank, string> = {
  bronze: "text-amber-600",
  silver: "text-slate-300",
  gold: "text-yellow-400",
  platinum: "text-blue-300",
  diamond: "text-purple-400",
}

export function BadgeGrid() {
  const { t, i18n } = useTranslation("achievements")
  const { data: rows = [], isLoading } = useBadgeStatus()
  const [selected, setSelected] = useState<BadgeStatusRow | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  const groups = rows.reduce<Record<string, BadgeStatusRow[]>>((acc, row) => {
    const key = row.group_slug
    ;(acc[key] ??= []).push(row)
    return acc
  }, {})

  const groupSlugs = [...new Set(rows.map((r) => r.group_slug))]

  return (
    <>
      <div className="space-y-6">
        {groupSlugs.map((slug) => {
          const tiers = groups[slug] ?? []
          const groupName =
            i18n.language === "fr"
              ? tiers[0]?.group_name_fr
              : tiers[0]?.group_name_en
          const highestUnlocked = [...tiers]
            .reverse()
            .find((t) => t.is_unlocked)
          const nextTier = tiers.find((t) => !t.is_unlocked)

          return (
            <div key={slug} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{groupName}</h3>
                {highestUnlocked && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                      rankColorText[highestUnlocked.rank],
                      "bg-card",
                    )}
                  >
                    {t(`ranks.${highestUnlocked.rank}`)}
                  </span>
                )}
              </div>

              <div className="flex justify-center gap-3">
                {tiers.map((tier) => {
                  const isUnlocked = tier.is_unlocked
                  const isNext = !isUnlocked && tier.tier_id === nextTier?.tier_id

                  return (
                    <button
                      key={tier.tier_id}
                      type="button"
                      className="flex flex-col items-center gap-1"
                      onClick={() => setSelected(tier)}
                    >
                      <BadgeIcon
                        rank={tier.rank}
                        iconUrl={tier.icon_asset_url}
                        size="sm"
                        locked={!isUnlocked}
                        alt={i18n.language === "fr" ? tier.title_fr : tier.title_en}
                      />
                      {isNext && (
                        <span className="text-[10px] text-muted-foreground">
                          {t("progress", {
                            current: Math.floor(tier.current_value),
                            target: Math.floor(tier.threshold_value),
                          })}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {nextTier && (
                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, nextTier.progress_pct)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <BadgeDetailDrawer badge={selected} onClose={() => setSelected(null)} />
    </>
  )
}
