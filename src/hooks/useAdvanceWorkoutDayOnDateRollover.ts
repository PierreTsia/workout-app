import { useCallback, useEffect, useRef } from "react"
import type { QueryClient } from "@tanstack/react-query"
import type { SetStateAction } from "react"
import { format } from "date-fns"
import type { SessionState } from "@/store/atoms"

const DASHBOARD_EVAL_DATE_KEY = "workout-app-dashboard-eval-date"

/**
 * When the local calendar day changes, if the user is still parked on a workout day
 * already completed in the current cycle, advance selection to the next incomplete day.
 * Fixes stale dashboard state after midnight (persisted `currentDayId` in localStorage).
 */
export function useAdvanceWorkoutDayOnDateRollover({
  isSessionActive,
  currentDayId,
  completedDayIds,
  nextDayId,
  setSession,
  queryClient,
}: {
  isSessionActive: boolean
  currentDayId: string | null
  completedDayIds: string[]
  nextDayId: string | null
  setSession: (value: SetStateAction<SessionState>) => void
  queryClient: QueryClient
}) {
  const tryAdvance = useCallback(() => {
    if (isSessionActive) return

    const today = format(new Date(), "yyyy-MM-dd")
    const lastEval = sessionStorage.getItem(DASHBOARD_EVAL_DATE_KEY)
    if (lastEval === today) return
    sessionStorage.setItem(DASHBOARD_EVAL_DATE_KEY, today)

    if (!currentDayId || !nextDayId) return
    if (!completedDayIds.includes(currentDayId)) return
    if (currentDayId === nextDayId) return

    setSession((prev: SessionState) => ({
      ...prev,
      currentDayId: nextDayId,
      exerciseIndex: 0,
      totalSetsDone: 0,
    }))
    queryClient.invalidateQueries({ queryKey: ["last-session-for-day"] })
  }, [
    completedDayIds,
    currentDayId,
    isSessionActive,
    nextDayId,
    queryClient,
    setSession,
  ])

  useEffect(() => {
    tryAdvance()
  }, [tryAdvance])

  const calendarDayRef = useRef(format(new Date(), "yyyy-MM-dd"))
  useEffect(() => {
    const tick = () => {
      const d = format(new Date(), "yyyy-MM-dd")
      if (d !== calendarDayRef.current) {
        calendarDayRef.current = d
        sessionStorage.removeItem(DASHBOARD_EVAL_DATE_KEY)
        tryAdvance()
      }
    }
    const id = setInterval(tick, 60_000)
    const onVisible = () => {
      if (document.visibilityState === "visible") tick()
    }
    window.addEventListener("focus", tick)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(id)
      window.removeEventListener("focus", tick)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [tryAdvance])
}
