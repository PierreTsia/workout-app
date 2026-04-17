import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"
import { lastSessionBadgesAtom } from "@/store/atoms"
import { BadgeIcon } from "./BadgeIcon"
import type { AchievementRank } from "@/types/achievements"

const rankColorText: Record<AchievementRank, string> = {
  bronze: "text-amber-600",
  silver: "text-slate-300",
  gold: "text-yellow-400",
  platinum: "text-blue-300",
  diamond: "text-purple-400",
}

export function SessionBadges() {
  const { t, i18n } = useTranslation("achievements")
  const badges = useAtomValue(lastSessionBadgesAtom)

  if (badges.length === 0) return null

  return (
    <div className="w-full max-w-xs rounded-xl bg-card p-4 achievement-text-entrance">
      <p className="mb-3 text-center text-sm font-semibold">
        {t("newAchievement")}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {badges.map((badge) => {
          const title =
            i18n.language === "fr" ? badge.title_fr : badge.title_en
          return (
            <div key={badge.tier_id} className="flex flex-col items-center gap-1">
              <BadgeIcon
                rank={badge.rank}
                iconUrl={badge.icon_asset_url}
                size="sm"
                alt={title}
              />
              <span className="max-w-20 truncate text-[10px] font-medium text-foreground">
                {title}
              </span>
              <span
                className={`text-[10px] capitalize ${rankColorText[badge.rank]}`}
              >
                {t(`ranks.${badge.rank}`)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
