import { useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ChevronRight } from "lucide-react"
import { useBadgeStatus } from "@/hooks/useBadgeStatus"
import { BadgeIcon } from "./BadgeIcon"
import { BadgeDetailDrawer } from "./BadgeDetailDrawer"
import type { BadgeStatusRow } from "@/types/achievements"

const SHOWCASE_COUNT = 3

export function BadgeShowcase() {
  const { t, i18n } = useTranslation("achievements")
  const { data: rows = [], isLoading } = useBadgeStatus()
  const [selected, setSelected] = useState<BadgeStatusRow | null>(null)

  const unlocked = rows.filter((r) => r.is_unlocked)
  const unlockedCount = unlocked.length
  const totalCount = rows.length

  const topBadges = [...unlocked]
    .sort((a, b) => b.tier_level - a.tier_level || a.group_slug.localeCompare(b.group_slug))
    .slice(0, SHOWCASE_COUNT)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 py-4">
        {Array.from({ length: SHOWCASE_COUNT }).map((_, i) => (
          <div key={i} className="h-10 w-10 animate-pulse rounded-full bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <>
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{t("showcase")}</h3>
          <Link
            to="/achievements"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {t("showcaseSeeAll")}
            {totalCount > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {unlockedCount}/{totalCount}
              </span>
            )}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {topBadges.length > 0 ? (
          <div className="flex justify-center gap-4">
            {topBadges.map((tier) => (
              <button
                key={tier.tier_id}
                type="button"
                className="flex flex-col items-center gap-1 transition-transform active:scale-95"
                onClick={() => setSelected(tier)}
              >
                <BadgeIcon
                  rank={tier.rank}
                  iconUrl={tier.icon_asset_url}
                  size="sm"
                  locked={false}
                  alt={i18n.language === "fr" ? tier.title_fr : tier.title_en}
                />
                <span className="max-w-16 truncate text-[10px] text-muted-foreground">
                  {i18n.language === "fr" ? tier.title_fr : tier.title_en}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4">
            <div className="relative flex items-center justify-center">
              <span className="text-3xl grayscale opacity-30">🏆</span>
              <span className="absolute -right-2 -top-1 text-sm animate-pulse">✨</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("showcaseEmpty")}
            </p>
          </div>
        )}
      </section>

      <BadgeDetailDrawer badge={selected} onClose={() => setSelected(null)} />
    </>
  )
}
