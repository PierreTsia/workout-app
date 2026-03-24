import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { formatSecondsMMSS } from "@/lib/formatters"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const VIBRATE_PATTERN = [200, 100, 200] as const

interface DurationSetTimerProps {
  targetSeconds: number
  timerStartedAt: number | null
  disabled: boolean
  isWorkoutPaused: boolean
  isDone: boolean
  onStart: () => void
  onLog: (durationSeconds: number) => void
  onBlockedByPause?: () => void
}

export function DurationSetTimer({
  targetSeconds,
  timerStartedAt,
  disabled,
  isWorkoutPaused,
  isDone,
  onStart,
  onLog,
  onBlockedByPause,
}: DurationSetTimerProps) {
  const { t } = useTranslation("workout")
  const [nowTick, setNowTick] = useState(() => Date.now())
  const alarmFiredRef = useRef(false)

  useEffect(() => {
    if (timerStartedAt == null || isDone) return
    const id = window.setInterval(() => setNowTick(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [timerStartedAt, isDone])

  useEffect(() => {
    alarmFiredRef.current = false
  }, [timerStartedAt, targetSeconds])

  const elapsedSec =
    timerStartedAt != null
      ? Math.floor((nowTick - timerStartedAt) / 1000)
      : 0
  const remaining = Math.max(0, targetSeconds - elapsedSec)

  useEffect(() => {
    if (
      timerStartedAt == null ||
      isDone ||
      remaining > 0 ||
      isWorkoutPaused
    ) {
      return
    }
    if (alarmFiredRef.current) return
    alarmFiredRef.current = true
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([...VIBRATE_PATTERN])
    }
    try {
      const ctx = new AudioContext()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g)
      g.connect(ctx.destination)
      g.gain.value = 0.08
      o.frequency.value = 880
      o.start()
      o.stop(ctx.currentTime + 0.15)
    } catch {
      /* ignore */
    }
  }, [remaining, timerStartedAt, isDone, isWorkoutPaused])

  if (isDone) {
    return (
      <span className="text-center text-sm text-muted-foreground">
        {t("durationDone")}
      </span>
    )
  }

  const canInteract = !disabled && !isWorkoutPaused

  return (
    <div className="flex flex-col gap-2">
      <div className="text-center font-mono text-lg tabular-nums">
        {timerStartedAt == null
          ? formatSecondsMMSS(targetSeconds)
          : remaining > 0
            ? formatSecondsMMSS(remaining)
            : formatSecondsMMSS(0)}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {timerStartedAt == null ? (
          <Button
            type="button"
            size="sm"
            className="min-h-11 min-w-[7rem]"
            disabled={!canInteract}
            onClick={() => {
              if (isWorkoutPaused) {
                onBlockedByPause?.()
                return
              }
              onStart()
            }}
          >
            {t("durationStart")}
          </Button>
        ) : remaining > 0 ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11 min-w-[7rem]"
            disabled={!canInteract}
            onClick={() => {
              if (isWorkoutPaused) {
                onBlockedByPause?.()
                return
              }
              onLog(Math.max(1, Math.min(elapsedSec, targetSeconds)))
            }}
          >
            {t("durationStopEarly")}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className={cn("min-h-12 min-w-[8rem] animate-pulse")}
            disabled={!canInteract}
            onClick={() => {
              if (isWorkoutPaused) {
                onBlockedByPause?.()
                return
              }
              onLog(targetSeconds)
            }}
          >
            {t("durationLog")}
          </Button>
        )}
      </div>
    </div>
  )
}
