import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Play, StopCircle } from "lucide-react"
import { formatSecondsMMSS } from "@/lib/formatters"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const VIBRATE_PATTERN = [200, 100, 200] as const

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
  const alarmFiredRef = useRef(false)
  // Local edit state for the target input (seconds as string)
  const [editValue, setEditValue] = useState(String(targetSeconds))

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
    alarmFiredRef.current = false
  }, [timerStartedAt, targetSeconds])

  const elapsedSec =
    timerStartedAt != null
      ? Math.floor((Math.max(nowTick, timerStartedAt) - timerStartedAt) / 1000)
      : 0
  const remaining = Math.max(0, targetSeconds - elapsedSec)
  const isRunning = timerStartedAt != null

  useEffect(() => {
    if (!isRunning || remaining > 0 || isWorkoutPaused) return
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
      o.onended = () => {
        void ctx.close().catch(() => {
          /* ignore */
        })
      }
      o.start()
      o.stop(ctx.currentTime + 0.15)
    } catch {
      /* ignore */
    }
    // Timer expired → auto-complete, no extra tap required
    onLog(targetSeconds)
  }, [remaining, isRunning, isWorkoutPaused, onLog, targetSeconds])

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
