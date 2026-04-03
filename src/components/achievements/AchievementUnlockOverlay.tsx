import { useEffect, useRef, useCallback } from "react"
import { useAtom, useSetAtom } from "jotai"
import { useTranslation } from "react-i18next"
import * as Dialog from "@radix-ui/react-dialog"
import {
  achievementUnlockQueueAtom,
  achievementShownIdsAtom,
} from "@/store/atoms"
import { cn } from "@/lib/utils"
import { BadgeIcon } from "@/components/achievements/BadgeIcon"
import type { AchievementRank } from "@/types/achievements"

const AUTO_DISMISS_MS = 4_000

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

const rankColorClass: Record<AchievementRank, string> = {
  bronze: "text-amber-600",
  silver: "text-slate-300",
  gold: "text-yellow-400",
  platinum: "text-blue-300",
  diamond: "text-purple-400",
}

const rankGlowClass: Record<AchievementRank, string> = {
  bronze: "achievement-glow-bronze",
  silver: "achievement-glow-silver",
  gold: "achievement-glow-gold",
  platinum: "achievement-glow-platinum",
  diamond: "achievement-glow-diamond",
}

export function AchievementUnlockOverlay() {
  const { t, i18n } = useTranslation("achievements")
  const [queue, setQueue] = useAtom(achievementUnlockQueueAtom)
  const setShownIds = useSetAtom(achievementShownIdsAtom)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasPlayedRef = useRef(false)

  const current = queue[0] ?? null
  const isOpen = current !== null

  const dismiss = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
    hasPlayedRef.current = false

    setQueue((prev) => {
      const dismissed = prev[0]
      if (dismissed) {
        setShownIds((ids: Set<string>) => new Set([...ids, dismissed.tier_id]))
      }
      return prev.slice(1)
    })
  }, [setQueue, setShownIds])

  useEffect(() => {
    if (!current) return
    if (hasPlayedRef.current) return
    hasPlayedRef.current = true

    if (navigator.vibrate) navigator.vibrate([100, 50, 200])
    playAchievementChime()

    dismissTimerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS)
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    }
  }, [current, dismiss])

  if (!current) return null

  const title =
    i18n.language === "fr" ? current.title_fr : current.title_en
  const rank = current.rank

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) dismiss() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/70 animate-in fade-in duration-300"
          onClick={dismiss}
        />
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 outline-none"
          onClick={dismiss}
          aria-label={title}
          onEscapeKeyDown={dismiss}
        >
          {/* Rank glow */}
          <div
            className={cn(
              "absolute inset-0 opacity-0 achievement-rank-glow",
              rankGlowClass[rank],
            )}
          />

          {/* Badge reveal */}
          <div className="relative achievement-badge-reveal">
            {/* Particle burst */}
            <div className={cn("absolute inset-0 achievement-particle-burst", rankGlowClass[rank])} />

            <div
              className={cn(
                "flex h-28 w-28 items-center justify-center rounded-full border-2 bg-card/80 backdrop-blur",
                rank === "bronze" && "border-amber-600",
                rank === "silver" && "border-slate-300",
                rank === "gold" && "border-yellow-400",
                rank === "platinum" && "border-blue-300",
                rank === "diamond" && "border-purple-400",
              )}
            >
              <BadgeIcon
                rank={rank}
                iconUrl={current.icon_asset_url}
                size="lg"
                alt={title}
                eager
              />
            </div>
          </div>

          {/* Text entrance */}
          <div className="flex flex-col items-center gap-2 achievement-text-entrance">
            <h2 className="text-2xl font-bold text-foreground">{title}</h2>
            <span
              className={cn(
                "rounded-full px-3 py-0.5 text-sm font-semibold capitalize",
                rankColorClass[rank],
                "bg-card/60",
              )}
            >
              {rank}
            </span>
            <p className="text-sm text-muted-foreground">
              {t(`groupDescriptions.${current.group_slug}`)}
            </p>
          </div>

          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">
            {rank} achievement unlocked
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
