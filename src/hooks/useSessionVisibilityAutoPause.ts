import { useEffect } from "react"
import { useSetAtom } from "jotai"
import { sessionAtom } from "@/store/atoms"
import {
  pauseSessionForVisibility,
  resumeSessionFromVisibilityPause,
} from "@/lib/session"

/**
 * Guards a live session against long hidden spans (#664). The app is paused on
 * `hidden`; on return the guard resolves the pause — a span of 15 min or less
 * counts toward `active_duration_ms`, a longer one is excluded whole. A manual
 * pause is never touched. Event-driven rather than a grace timer: a timer set
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
      setSession((prev) => resumeSessionFromVisibilityPause(prev, Date.now()))
    }

    handleVisibility()
    document.addEventListener("visibilitychange", handleVisibility)
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility)
  }, [setSession])
}
