import { useCallback, useEffect, useRef, useState } from "react"
import { useAtom, useSetAtom } from "jotai"
import { useTranslation } from "react-i18next"
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
import { formatCompactNumber } from "@/lib/formatters"
import { pickHero, supportingMedals, supportingOverflow } from "@/lib/achievementUtils"
import { BadgeIcon } from "@/components/achievements/BadgeIcon"
import { Badge } from "@/components/ui/badge"
import type { AchievementRank, UnlockedAchievement } from "@/types/achievements"

let audioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

function playAchievementChime() {
  try {
    const ctx = getAudioCtx()
    if (ctx.state === "suspended") ctx.resume()

    const play = (freq: number, delay: number, dur: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = "sine"
      gain.gain.setValueAtTime(0.35, ctx.currentTime + delay)
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + delay + dur,
      )
      osc.start(ctx.currentTime + delay)
      osc.stop(ctx.currentTime + delay + dur)
    }

    play(523, 0, 0.25)
    play(784, 0.15, 0.35)
  } catch {
    // Web Audio unavailable — silent fallback
  }
}

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

export function AchievementUnlockOverlay() {
  const { t, i18n } = useTranslation("achievements")
  const [queue, setQueue] = useAtom(achievementUnlockQueueAtom)
  const setShownIds = useSetAtom(achievementShownIdsAtom)
  const [batch, setBatch] = useState<UnlockedAchievement[] | null>(null)
  const hasPlayedRef = useRef(false)

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
    if (navigator.vibrate) navigator.vibrate([100, 50, 200])
    playAchievementChime()
  }, [batch])

  if (!batch) return null

  const hero = pickHero(batch)
  const supporting = supportingMedals(batch, hero)
  const title = localizedTitle(hero, i18n.language)
  const rank = hero.rank
  const chipHex = rankChipHex[rank]
  const thresholdTarget = Number.isFinite(hero.threshold_value)
    ? formatCompactNumber(hero.threshold_value, i18n.language)
    : null
  const eyebrow =
    batch.length === 1
      ? t("ceremonyEyebrow")
      : t("ceremonyEyebrowCount", { count: batch.length })
  const overlapping = supporting.length === 1 ? supporting[0] : null
  const { visible, overflowCount } = supportingOverflow(supporting)
  const overflowLabel = t("ceremonyOverflow", { count: overflowCount })
  const showSupportingRow = supporting.length >= 2

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) dismiss()
      }}
    >
      <DialogPortal>
        <DialogOverlay
          className="bg-[#0f0f13]/70 backdrop-blur-sm"
          onClick={dismiss}
        />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 outline-hidden"
          onClick={dismiss}
          aria-label={title}
        >
          <div className="relative">
            <div
              className={cn(
                "absolute -inset-10 opacity-0 achievement-rank-glow",
                rankGlowClass[rank],
              )}
            />

            <div className="relative achievement-badge-reveal">
              <div
                className={cn(
                  "absolute inset-0 achievement-particle-burst",
                  rankGlowClass[rank],
                )}
              />
              <BadgeIcon
                rank={rank}
                iconUrl={hero.icon_asset_url}
                size="lg"
                className={overlapping ? "h-[120px] w-[120px]" : undefined}
                alt={title}
                eager
              />
              {overlapping && (
                <div
                  className="absolute -bottom-1 -right-3"
                  aria-label={localizedTitle(overlapping, i18n.language)}
                >
                  <BadgeIcon
                    rank={overlapping.rank}
                    iconUrl={overlapping.icon_asset_url}
                    className="h-[72px] w-[72px]"
                    alt={localizedTitle(overlapping, i18n.language)}
                    eager
                  />
                </div>
              )}
            </div>
          </div>

          {showSupportingRow && (
            <ul className="flex items-end justify-center gap-3">
              {visible.map((item) => {
                const caption = `${t(`ranks.${item.rank}`)} ${localizedTitle(item, i18n.language)}`
                return (
                  <li
                    key={item.tier_id}
                    aria-label={caption}
                    className="flex max-w-20 flex-col items-center gap-1"
                  >
                    <BadgeIcon
                      rank={item.rank}
                      iconUrl={item.icon_asset_url}
                      className="h-14 w-14"
                      alt=""
                      eager
                    />
                    <p className="text-center text-xs text-muted-foreground">
                      {caption}
                    </p>
                  </li>
                )
              })}
              {overflowCount > 0 && (
                <li
                  aria-label={overflowLabel}
                  className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-sm font-semibold text-muted-foreground"
                >
                  {overflowLabel}
                </li>
              )}
            </ul>
          )}

          <div className="flex flex-col items-center gap-2 achievement-text-entrance">
            <p className="text-sm font-medium tracking-wide text-muted-foreground">
              {eyebrow}
            </p>
            <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
              {title}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="bg-card/60"
                style={{ color: chipHex, borderColor: chipHex }}
              >
                {t(`ranks.${rank}`)}
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                {t(`groups.${hero.group_slug}`)}
              </Badge>
            </div>
            {thresholdTarget !== null && (
              <p className="text-sm text-muted-foreground">
                {t(`thresholdHint.${hero.group_slug}`, {
                  target: thresholdTarget,
                })}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
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
