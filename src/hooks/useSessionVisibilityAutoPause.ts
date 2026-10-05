import { useEffect } from "react"
import { useSetAtom } from "jotai"
import { sessionAtom } from "@/store/atoms"
import {
  pauseSessionForVisibility,
  resumeSessionFromPause,
} from "@/lib/session"

/**
 * Auto-pauses a live session while the app is hidden and resumes it on return
 * (#655), so time with the app closed/backgrounded never counts toward
 * `active_duration_ms`. Event-driven rather than a grace timer: a timer set
 * while backgrounded is frozen by mobile OSes, which is exactly the case being
 * fixed. Mounted in `AppShell` so it survives `WorkoutPage` unmounts.
 */
export function useSessionVisibilityAutoPause(): void {
  const setSession = useSetAtom(sessionAtom)

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        setSession((prev) => pauseSessionForVisibility(prev, Date.now()))
        return
      }
      setSession((prev) =>
        prev.pausedByVisibility ? resumeSessionFromPause(prev) : prev,
      )
    }

    handleVisibility()
    document.addEventListener("visibilitychange", handleVisibility)
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility)
  }, [setSession])
}
