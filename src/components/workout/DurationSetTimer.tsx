import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Play, StopCircle } from "lucide-react"
import { formatSecondsMMSS } from "@/lib/formatters"
import { primeAudio, playWarningBeep, playFinishBeeps } from "@/lib/audio"
import { buildBeepSchedule, type BeepFireSpec } from "@/lib/buildBeepSchedule"
import { useKeepScreenAwake } from "@/hooks/useKeepScreenAwake"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const VIBRATE_PATTERN = [200, 100, 200] as const

/** Suppress a warning beep if its tick fires this many ms late (pause/throttle). */
const STALE_WARNING_WINDOW_MS = 1500

interface DurationSetTimerProps {
  targetSeconds: number
  timerStartedAt: number | null
  /** Disable interactions (another timer running, read-only, session inactive) */
  disabled: boolean
  isWorkoutPaused: boolean
  onStart: () => void
  onLog: (durationSeconds: number) => void
  /** Called when the user edits the target duration (seconds). Only fired when timer is idle. */
  onUpdateTarget?: (seconds: number) => void
  onBlockedByPause?: () => void
}

/**
 * Renders with `display: contents` so its two children (time cell + button cell)
 * participate directly in the parent's CSS grid.
 */
export function DurationSetTimer({
  targetSeconds,
  timerStartedAt,
  disabled,
  isWorkoutPaused,
  onStart,
  onLog,
  onUpdateTarget,
  onBlockedByPause,
}: DurationSetTimerProps) {
  const { t } = useTranslation("workout")
  const [nowTick, setNowTick] = useState(() => Date.now())
  const firedBeepIndicesRef = useRef<Set<number>>(new Set())
  // Local edit state for the target input (seconds as string)
  const [editValue, setEditValue] = useState(String(targetSeconds))

  const schedule = useMemo(
    () => buildBeepSchedule(targetSeconds),
    [targetSeconds],
  )

  // Keep editValue in sync when targetSeconds changes externally
  useEffect(() => {
    setEditValue(String(targetSeconds))
  }, [targetSeconds])

  useEffect(() => {
    if (timerStartedAt == null || isWorkoutPaused) return
    const id = window.setInterval(() => setNowTick(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [timerStartedAt, isWorkoutPaused])

  useEffect(() => {
    firedBeepIndicesRef.current = new Set()
  }, [timerStartedAt, targetSeconds])

  const elapsedSec =
    timerStartedAt != null
      ? Math.floor((Math.max(nowTick, timerStartedAt) - timerStartedAt) / 1000)
      : 0
  const remaining = Math.max(0, targetSeconds - elapsedSec)
  const isRunning = timerStartedAt != null

  useKeepScreenAwake(isRunning && !isWorkoutPaused)

  useEffect(() => {
    if (!isRunning || isWorkoutPaused || timerStartedAt == null) return
    const elapsedMs = nowTick - timerStartedAt

    function handleWarning(spec: BeepFireSpec) {
      const isStale =
        elapsedMs - spec.atMsFromStart >= STALE_WARNING_WINDOW_MS
      if (!isStale) playWarningBeep()
    }

    function handleFinish() {
      playFinishBeeps()
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([...VIBRATE_PATTERN])
      }
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          navigator.serviceWorker?.ready
            .then((reg) =>
              reg.showNotification(t("holdOverNotif"), {
                body: t("holdOverBody"),
              }),
            )
            .catch(() => {})
        } catch {
          // Notification API unavailable or restricted — silent fallback
        }
      }
      onLog(targetSeconds)
    }

    schedule.forEach((spec, idx) => {
      if (firedBeepIndicesRef.current.has(idx)) return
      if (elapsedMs < spec.atMsFromStart) return
      firedBeepIndicesRef.current.add(idx)
      if (spec.kind === "warning") handleWarning(spec)
      else handleFinish()
    })
  }, [
    nowTick,
    isRunning,
    isWorkoutPaused,
    timerStartedAt,
    schedule,
    onLog,
    targetSeconds,
    t,
  ])

  const timeDisplay = isRunning
    ? formatSecondsMMSS(remaining)
    : formatSecondsMMSS(targetSeconds)

  const canInteract = !disabled && !isWorkoutPaused

  return (
    <div className="contents">
      {/* cell 1 — editable target when idle, live countdown when running */}
      {isRunning ? (
        <span className="text-center font-mono text-sm tabular-nums">
          {timeDisplay}
        </span>
      ) : (
        <Input
          type="text"
          inputMode="numeric"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => {
            const n = parseInt(editValue, 10)
            if (!isNaN(n) && n > 0) {
              onUpdateTarget?.(n)
            } else {
              setEditValue(String(targetSeconds))
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur()
          }}
          className="h-8 text-center font-mono tabular-nums"
          disabled={disabled}
          aria-label={t("durationTargetLabel")}
        />
      )}

      {/* cell 2 — action icon button */}
      <div className="flex justify-center">
        {!isRunning ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-primary"
            disabled={!canInteract}
            aria-label={t("durationStart")}
            onClick={() => {
              if (isWorkoutPaused) {
                onBlockedByPause?.()
                return
              }
              primeAudio()
              onStart()
            }}
          >
            <Play className="h-5 w-5 fill-current" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-destructive"
            disabled={!canInteract || remaining === 0}
            aria-label={t("durationStopEarly")}
            onClick={() => {
              if (isWorkoutPaused) {
                onBlockedByPause?.()
                return
              }
              // Target reached: auto-log effect handles completion; avoid racing a second log.
              if (elapsedSec >= targetSeconds) return
              onLog(Math.max(1, Math.min(elapsedSec, targetSeconds)))
            }}
          >
            <StopCircle className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  )
}
