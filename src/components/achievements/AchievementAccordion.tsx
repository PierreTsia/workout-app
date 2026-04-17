import { useTranslation } from "react-i18next"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { BadgeIcon } from "./BadgeIcon"
import { cn } from "@/lib/utils"
import { rankColorText } from "@/lib/achievementUtils"
import type { BadgeStatusRow } from "@/types/achievements"

interface AchievementAccordionProps {
  rows: BadgeStatusRow[]
  onSelect: (row: BadgeStatusRow) => void
}

export function AchievementAccordion({ rows, onSelect }: AchievementAccordionProps) {
  const { t, i18n } = useTranslation("achievements")

  const groups = rows.reduce<Record<string, BadgeStatusRow[]>>((acc, row) => {
    ;(acc[row.group_slug] ??= []).push(row)
    return acc
  }, {})

  const groupSlugs = [...new Set(rows.map((r) => r.group_slug))]

  const defaultOpenSlugs = groupSlugs.filter((slug) => {
    const tiers = groups[slug] ?? []
    const unlockedCount = tiers.filter((t) => t.is_unlocked).length
    return unlockedCount > 0 && unlockedCount < tiers.length
  })

  return (
    <Accordion type="multiple" defaultValue={defaultOpenSlugs} className="space-y-2">
      {groupSlugs.map((slug) => {
        const tiers = groups[slug] ?? []
        const groupName =
          i18n.language === "fr" ? tiers[0]?.group_name_fr : tiers[0]?.group_name_en
        const highestUnlocked = [...tiers].reverse().find((t) => t.is_unlocked)
        const nextTier = tiers.find((t) => !t.is_unlocked)

        return (
          <AccordionItem
            key={slug}
            value={slug}
            className="rounded-xl border border-border bg-card px-4"
          >
            <AccordionTrigger className="gap-3 py-3 hover:no-underline">
              <div className="flex flex-1 items-center gap-3">
                {highestUnlocked ? (
                  <BadgeIcon
                    rank={highestUnlocked.rank}
                    iconUrl={highestUnlocked.icon_asset_url}
                    size="sm"
                    locked={false}
                    alt={
                      i18n.language === "fr"
                        ? highestUnlocked.title_fr
                        : highestUnlocked.title_en
                    }
                  />
                ) : (
                  <BadgeIcon
                    rank={tiers[0]?.rank ?? "bronze"}
                    iconUrl={tiers[0]?.icon_asset_url ?? null}
                    size="sm"
                    locked
                    alt={groupName ?? slug}
                  />
                )}

                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-semibold leading-tight">{groupName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t(`groupDescriptions.${slug}`)}
                  </p>
                </div>

                {highestUnlocked && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
                      rankColorText[highestUnlocked.rank],
                      "bg-muted",
                    )}
                  >
                    {t(`ranks.${highestUnlocked.rank}`)}
                  </span>
                )}
              </div>
            </AccordionTrigger>

            <AccordionContent>
              <div className="flex justify-center gap-3 pt-1">
                {tiers.map((tier) => {
                  const isUnlocked = tier.is_unlocked
                  const isNext = !isUnlocked && tier.tier_id === nextTier?.tier_id

                  return (
                    <button
                      key={tier.tier_id}
                      type="button"
                      className="flex flex-col items-center gap-1 transition-transform active:scale-95"
                      onClick={() => onSelect(tier)}
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
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
