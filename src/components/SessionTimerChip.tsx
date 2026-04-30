import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { useAtom } from "jotai"
import { Timer, Pause, Play, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { sessionAtom } from "@/store/atoms"
import { getEffectiveElapsed, resumeSessionFromPause } from "@/lib/session"
import { cancelActiveSession } from "@/lib/cancelSession"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0")
  const s = String(totalSeconds % 60).padStart(2, "0")
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}

export function SessionTimerChip() {
  const { t } = useTranslation("workout")
  const [session, setSession] = useAtom(sessionAtom)
  const [now, setNow] = useState(Date.now)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isPaused = session.pausedAt != null

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (!session.startedAt || !session.isActive || isPaused) return

    const tick = () => setNow(Date.now())
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [session.startedAt, session.isActive, isPaused])

  const display = useMemo(() => {
    if (!session.startedAt || !session.isActive) return ""
    const accPause = session.accumulatedPause ?? 0
    const elapsed = getEffectiveElapsed(
      { startedAt: session.startedAt, pausedAt: session.pausedAt, accumulatedPause: accPause },
      isPaused ? (session.pausedAt ?? now) : now,
    )
    return formatElapsed(elapsed)
  }, [session.startedAt, session.isActive, session.pausedAt, session.accumulatedPause, isPaused, now])

  const togglePause = useCallback(() => {
    setSession((prev) => {
      if (prev.pausedAt != null) return resumeSessionFromPause(prev)
      return { ...prev, pausedAt: Date.now() }
    })
  }, [setSession])

  const confirmCancel = useCallback(() => {
    setCancelDialogOpen(false)
    void cancelActiveSession()
  }, [])

  if (!session.startedAt || !session.isActive || !display) return null

  return (
    <div className="flex items-center gap-1" data-testid="session-timer-chip">
      <div
        className={`flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 ${isPaused ? "animate-pulse" : ""}`}
      >
        <Timer className="h-3.5 w-3.5 text-primary" />
        <span className="font-mono text-sm font-semibold tabular-nums text-primary">
          {display}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePause}
        className={`h-7 w-7 rounded-full ${isPaused ? "text-primary hover:bg-primary/20 hover:text-primary" : "text-destructive hover:bg-destructive/20 hover:text-destructive"}`}
        aria-label={isPaused ? "Resume workout" : "Pause workout"}
      >
        {isPaused ? (
          <Play className="h-3.5 w-3.5" />
        ) : (
          <Pause className="h-3.5 w-3.5" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCancelDialogOpen(true)}
        className="h-7 w-7 rounded-full text-destructive hover:bg-destructive/20 hover:text-destructive"
        aria-label={t("cancelWorkout")}
        data-testid="session-cancel-button"
      >
        <X className="h-3.5 w-3.5" />
      </Button>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent data-testid="session-cancel-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancelWorkoutTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cancelWorkoutDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancelWorkoutKeep")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="session-cancel-confirm"
            >
              {t("cancelWorkoutDiscard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
