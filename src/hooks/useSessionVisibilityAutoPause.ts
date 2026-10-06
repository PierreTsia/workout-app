import { useEffect } from "react"
import { useStore } from "jotai"
import { sessionAtom, visibilityGuardAtom } from "@/store/atoms"
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
 *
 * This hook is the single `visibilitychange` owner: it resolves the guard once
 * and publishes the decision on `visibilityGuardAtom`, which `useRestTimer`
 * consumes so the two timers cannot disagree at the boundary.
 */
export function useSessionVisibilityAutoPause(): void {
  const store = useStore()

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        store.set(sessionAtom, (prev) =>
          pauseSessionForVisibility(prev, Date.now()),
        )
        return
      }
      const { session, resolution } = resumeSessionFromVisibilityPause(
        store.get(sessionAtom),
        Date.now(),
      )
      store.set(sessionAtom, session)
      if (resolution) store.set(visibilityGuardAtom, resolution)
    }

    handleVisibility()
    document.addEventListener("visibilitychange", handleVisibility)
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility)
  }, [store])
}
