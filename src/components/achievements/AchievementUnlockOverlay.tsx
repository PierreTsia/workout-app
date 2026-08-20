import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import { Link } from "react-router-dom"
import { useAtom, useSetAtom } from "jotai"
import { useTranslation } from "react-i18next"
import { ChevronRight } from "lucide-react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  achievementUnlockQueueAtom,
  achievementShownIdsAtom,
} from "@/store/atoms"
import { cn } from "@/lib/utils"
import { formatCompactNumber, formatDate } from "@/lib/formatters"
import { coerceNumeric, pickHero, supportingMedals, supportingOverflow } from "@/lib/achievementUtils"
import { CeremonyMedal } from "@/components/achievements/CeremonyMedal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useEquipTitle } from "@/hooks/useEquipTitle"
import { useUserProfile } from "@/hooks/useUserProfile"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { playAchievementFanfare } from "@/lib/audio"
import type { AchievementRank, UnlockedAchievement } from "@/types/achievements"

const rankGlowClass: Record<AchievementRank, string> = {
  bronze: "achievement-glow-bronze",
  silver: "achievement-glow-silver",
  gold: "achievement-glow-gold",
  platinum: "achievement-glow-platinum",
  diamond: "achievement-glow-diamond",
}

const rankChipHex: Record<AchievementRank, string> = {
  bronze: "#C26A16",
  silver: "#c8c8dc",
  gold: "#F0C014",
  platinum: "#93c5fd",
  diamond: "#a855f7",
}

function localizedTitle(
  item: UnlockedAchievement,
  language: string,
): string {
  return language === "fr" ? item.title_fr : item.title_en
}

const UNLOCK_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
}

function unlockDateLabel(grantedAt: string | undefined, locale: string): string {
  return formatDate(grantedAt ?? new Date(), locale, UNLOCK_DATE_OPTIONS)
}

function CeremonyGrantMeta({
  item,
  locale,
  t,
}: {
  item: UnlockedAchievement
  locale: string
  t: (key: string, options?: { target?: string; date?: string }) => string
}) {
  const threshold = coerceNumeric(item.threshold_value)
  const thresholdTarget = Number.isFinite(threshold)
    ? formatCompactNumber(threshold, locale)
    : null
  return (
    <div className="flex flex-col items-center">
      {thresholdTarget !== null && (
        <p
          className="mt-3 text-center text-base font-semibold"
          style={{ color: rankChipHex[item.rank] }}
        >
          {t(`thresholdHint.${item.group_slug}`, { target: thresholdTarget })}
        </p>
      )}
      <div
        className={cn(
          "flex items-center gap-2",
          thresholdTarget !== null ? "mt-2" : "mt-3",
        )}
      >
        <Badge
          variant="outline"
          className="rounded-md border-transparent bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: rankChipHex[item.rank] }}
        >
          {t(`ranks.${item.rank}`)}
        </Badge>
        <span className="text-sm text-white/70">
          {t(`groups.${item.group_slug}`)}
        </span>
      </div>
      <p className="mt-1.5 text-center text-xs text-white/40">
        {t("unlockedOn", {
          date: unlockDateLabel(item.granted_at, locale),
        })}
      </p>
    </div>
  )
}

function CeremonySeeAllLink({
  onNavigate,
  compact = false,
}: {
  onNavigate: () => void
  compact?: boolean
}) {
  const { t } = useTranslation("achievements")
  return (
    <Link
      to="/achievements"
      onClick={(event) => {
        event.stopPropagation()
        onNavigate()
      }}
      className={cn(
        "inline-flex items-center font-medium text-white/70 underline-offset-4 hover:text-white hover:underline",
        compact ? "mt-1 gap-0.5 text-[10px]" : "mt-3 gap-0.5 text-xs",
      )}
    >
      {t("showcaseSeeAll")}
      <ChevronRight
        aria-hidden
        className={compact ? "size-3" : "size-3.5"}
      />
    </Link>
  )
}

const SPARKLE_COLORS: Record<AchievementRank, readonly [string, string]> = {
  bronze: ["#C26A16", "#E8A04A"],
  silver: ["#c8c8dc", "#e8e8f4"],
  gold: ["#F0C014", "#FFE27A"],
  platinum: ["#93c5fd", "#dbeafe"],
  diamond: ["#a855f7", "#67e8f9"],
}

const SPARKLE_COUNT: Record<AchievementRank, number> = {
  bronze: 16,
  silver: 20,
  gold: 22,
  platinum: 22,
  diamond: 28,
}

type SparkleStyle = CSSProperties & {
  "--dx": string
  "--dy": string
}

function sparkleStyle(
  rank: AchievementRank,
  index: number,
  count: number,
): SparkleStyle {
  const colors = SPARKLE_COLORS[rank]
  const color = colors[index % 2]
  const angle = (index / count) * Math.PI * 2
  const radius = 52 + (index % 5) * 18
  const size = 4 + (index % 3)
  return {
    "--dx": `${Math.cos(angle) * radius}px`,
    "--dy": `${Math.sin(angle) * radius}px`,
    width: size,
    height: size,
    backgroundColor: color,
    color,
    animationDelay: `${(index % 6) * 40}ms`,
    left: "50%",
    top: "42%",
  }
}

function RankSparkles({ rank }: { rank: AchievementRank }) {
  const count = SPARKLE_COUNT[rank]
  const particles = Array.from({ length: count }, (_, index) =>
    sparkleStyle(rank, index, count),
  )
  return (
    <div
      className="achievement-rank-sparkles pointer-events-none absolute inset-0 z-0"
      aria-hidden="true"
    >
      {particles.map((style, index) => (
        <span key={index} className="achievement-sparkle" style={style} />
      ))}
    </div>
  )
}

export function AchievementUnlockOverlay() {
  const { t, i18n } = useTranslation("achievements")
  const [queue, setQueue] = useAtom(achievementUnlockQueueAtom)
  const setShownIds = useSetAtom(achievementShownIdsAtom)
  const [batch, setBatch] = useState<UnlockedAchievement[] | null>(null)
  const hasPlayedRef = useRef(false)
  const equipTitle = useEquipTitle()
  const { data: profile } = useUserProfile()
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const allowMotion = !reduceMotion

  if (batch === null && queue.length > 0) {
    setBatch(queue)
  }

  const dismiss = useCallback(() => {
    if (!batch) return
    const batchIds = new Set(batch.map((item) => item.tier_id))
    setShownIds((ids) => new Set([...ids, ...batchIds]))
    setQueue((prev) => prev.filter((item) => !batchIds.has(item.tier_id)))
    setBatch(null)
  }, [batch, setQueue, setShownIds])

  useEffect(() => {
    if (!batch) {
      hasPlayedRef.current = false
      return
    }
    if (hasPlayedRef.current) return
    hasPlayedRef.current = true
    if (navigator.vibrate) navigator.vibrate([40, 30, 40, 30, 140])
    playAchievementFanfare(pickHero(batch).rank)
  }, [batch])

  if (!batch) return null

  const hero = pickHero(batch)
  const supporting = supportingMedals(batch, hero)
  const title = localizedTitle(hero, i18n.language)
  const rank = hero.rank
  const eyebrow =
    batch.length === 1
      ? t("ceremonyEyebrow")
      : t("ceremonyEyebrowCount", { count: batch.length })
  const overlapping = supporting.length === 1 ? supporting[0] : null
  const { visible, overflowCount } = supportingOverflow(supporting)
  const overflowLabel = t("ceremonyOverflow", { count: overflowCount })
  const showSupportingRow = supporting.length >= 2
  const heroAlreadyEquipped = profile?.active_title_tier_id === hero.tier_id
  const heroSize = overlapping ? 120 : 112
  const eyebrowNode = (
    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/55">
      {eyebrow}
    </p>
  )

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) dismiss()
      }}
    >
      <DialogPortal>
        <DialogOverlay
          className="bg-[#0f0f13]/90 backdrop-blur-[2px]"
          onClick={dismiss}
        />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col items-center justify-center outline-hidden"
          onClick={dismiss}
          aria-label={title}
        >
          <div
            className={cn(
              "relative z-10 flex w-full max-w-[320px] flex-col items-center px-6",
              allowMotion && "achievement-text-entrance",
            )}
          >
            {batch.length > 1 && <div className="mb-5">{eyebrowNode}</div>}

            <div className="relative">
              <div
                className={cn(
                  "absolute -inset-12",
                  rankGlowClass[rank],
                  allowMotion
                    ? "opacity-0 achievement-rank-glow"
                    : "opacity-35",
                )}
              />
              <div
                className={cn(
                  "relative",
                  allowMotion && "achievement-badge-reveal",
                )}
              >
                {allowMotion && <RankSparkles rank={rank} />}
                {allowMotion && (
                  <div
                    className={cn(
                      "absolute inset-0 achievement-particle-burst",
                      rankGlowClass[rank],
                    )}
                  />
                )}
                <CeremonyMedal
                  rank={rank}
                  iconUrl={hero.icon_asset_url}
                  alt={title}
                  size={heroSize}
                />
                {overlapping && (
                  <div
                    className={cn(
                      "absolute -bottom-1 -right-3",
                      allowMotion && "achievement-supporting-entrance",
                    )}
                  >
                    <CeremonyMedal
                      rank={overlapping.rank}
                      iconUrl={overlapping.icon_asset_url}
                      alt={localizedTitle(overlapping, i18n.language)}
                      size={72}
                    />
                  </div>
                )}
              </div>
            </div>

            {batch.length === 1 && <div className="mt-5">{eyebrowNode}</div>}

            <DialogTitle className="mt-3 text-center text-[28px] font-semibold leading-tight tracking-tight text-white">
              {title}
            </DialogTitle>
            <CeremonyGrantMeta item={hero} locale={i18n.language} t={t} />
            <CeremonySeeAllLink onNavigate={dismiss} />

            {overlapping && (
              <div
                className={cn(
                  "mt-6 flex flex-col items-center",
                  allowMotion && "achievement-supporting-entrance",
                )}
              >
                <p className="text-center text-lg font-semibold text-white">
                  {localizedTitle(overlapping, i18n.language)}
                </p>
                <CeremonyGrantMeta
                  item={overlapping}
                  locale={i18n.language}
                  t={t}
                />
                <CeremonySeeAllLink onNavigate={dismiss} />
              </div>
            )}

            {showSupportingRow && (
              <ul
                className={cn(
                  "mt-8 flex items-start justify-center gap-5",
                  allowMotion && "achievement-supporting-entrance",
                )}
              >
                {visible.map((item) => {
                  const itemTitle = localizedTitle(item, i18n.language)
                  const caption = `${t(`ranks.${item.rank}`)} ${itemTitle}`
                  return (
                    <li
                      key={item.tier_id}
                      aria-label={caption}
                      className="flex w-[72px] flex-col items-center gap-1.5"
                    >
                      <CeremonyMedal
                        rank={item.rank}
                        iconUrl={item.icon_asset_url}
                        alt=""
                        size={56}
                      />
                      <p
                        className="text-[10px] font-semibold uppercase tracking-wide"
                        style={{ color: rankChipHex[item.rank] }}
                      >
                        {t(`ranks.${item.rank}`)}
                      </p>
                      <p className="text-center text-[11px] leading-tight text-white/50">
                        {itemTitle}
                      </p>
                      <p className="text-center text-[10px] text-white/35">
                        {t("unlockedOn", {
                          date: unlockDateLabel(item.granted_at, i18n.language),
                        })}
                      </p>
                      <CeremonySeeAllLink compact onNavigate={dismiss} />
                    </li>
                  )
                })}
                {overflowCount > 0 && (
                  <li
                    aria-label={overflowLabel}
                    className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-white/25 text-sm font-semibold text-white/50"
                  >
                    {overflowLabel}
                  </li>
                )}
              </ul>
            )}

            {!heroAlreadyEquipped && (
              <Button
                variant="default"
                size="lg"
                className="mt-10 h-12 w-full rounded-lg text-base font-semibold"
                disabled={equipTitle.isPending}
                onClick={(event) => {
                  event.stopPropagation()
                  equipTitle.mutate(hero.tier_id)
                }}
              >
                {t("equipTitle")}
              </Button>
            )}
            <p
              className={cn(
                "mt-4 text-sm font-medium uppercase tracking-[0.18em] text-white/50",
                allowMotion && "achievement-tap-continue-pulse",
              )}
            >
              {t("ceremonyTapToContinue")}
            </p>
          </div>

          <DialogDescription className="sr-only">
            {t(`ranks.${rank}`)} {title}
          </DialogDescription>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
