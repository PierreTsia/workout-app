import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { useAtom } from "jotai"
import { Timer, Pause, Play } from "lucide-react"
import { sessionAtom } from "@/store/atoms"
import { getEffectiveElapsed } from "@/lib/session"

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0")
  const s = String(totalSeconds % 60).padStart(2, "0")
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}

export function SessionTimerChip() {
  const [session, setSession] = useAtom(sessionAtom)
  const { startedAt, isActive, pausedAt, accumulatedPause = 0 } = session
  const [now, setNow] = useState(Date.now)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isPaused = pausedAt != null

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (!startedAt || !isActive || isPaused) return

    const tick = () => setNow(Date.now())
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [startedAt, isActive, isPaused])

  const display = useMemo(() => {
    if (!startedAt || !isActive) return ""
    const elapsed = getEffectiveElapsed(
      { startedAt, pausedAt, accumulatedPause },
      isPaused ? (pausedAt ?? now) : now,
    )
    return formatElapsed(elapsed)
  }, [startedAt, isActive, pausedAt, accumulatedPause, isPaused, now])

  const togglePause = useCallback(() => {
    setSession((prev) => {
      if (prev.pausedAt != null) {
        const pauseDuration = Date.now() - prev.pausedAt
        return {
          ...prev,
          pausedAt: null,
          accumulatedPause: (prev.accumulatedPause ?? 0) + pauseDuration,
        }
      }
      return { ...prev, pausedAt: Date.now() }
    })
  }, [setSession])

  if (!startedAt || !isActive || !display) return null

  return (
    <button
      onClick={togglePause}
      className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 transition-opacity hover:bg-primary/20"
    >
      {isPaused ? (
        <Play className="h-3.5 w-3.5 text-primary" />
      ) : (
        <Timer className="h-3.5 w-3.5 text-primary" />
      )}
      <span
        className={`font-mono text-sm font-semibold tabular-nums text-primary ${isPaused ? "animate-pulse" : ""}`}
      >
        {display}
      </span>
      {isPaused && (
        <Pause className="h-3 w-3 text-primary/60" />
      )}
    </button>
  )
}
