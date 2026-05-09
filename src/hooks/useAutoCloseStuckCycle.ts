import { useEffect, useRef } from "react"
import { useFinishCycle } from "./useFinishCycle"
import type { Cycle } from "@/types/database"

interface AutoCloseStuckCycleArgs {
  activeCycle: Cycle | null | undefined
  isComplete: boolean
  isLoading: boolean
  /**
   * Set to `false` to skip the self-heal during flows that already drive a
   * close through another path — e.g. the post-session-finish navigation
   * where `closeCycleOnComplete` is enqueued in the sync queue. Without this
   * gate, the hook would double-fire on the very same render that flips
   * `isComplete` to `true` after an optimistic cache update.
   */
  enabled?: boolean
}

/**
 * Repairs the legacy "stuck cycle" state: an active cycle (`finished_at IS
 * NULL`) whose sessions already cover every workout day.
 *
 * Users who finished their last session on a build that lacked
 * `closeCycleOnComplete` (i.e. before this PR) ended up with all days marked
 * complete but the cycle still flagged as active, with no UI affordance to
 * close it. This hook detects that state on app open and triggers a close
 * via `useFinishCycle` — which is itself idempotent thanks to
 * `.is("finished_at", null)` on the UPDATE.
 *
 * Fires at most once per mount (guarded by a ref). On error the ref stays
 * set, so retries happen on the next mount instead of looping. On success
 * the cache invalidations flip `activeCycle` to `null`, so the trigger
 * condition naturally goes away.
 */
export function useAutoCloseStuckCycle({
  activeCycle,
  isComplete,
  isLoading,
  enabled = true,
}: AutoCloseStuckCycleArgs): void {
  const finishCycle = useFinishCycle()
  const triggeredRef = useRef(false)

  useEffect(() => {
    if (triggeredRef.current) return
    if (!enabled) return
    if (isLoading) return
    if (!activeCycle) return
    if (!isComplete) return

    triggeredRef.current = true
    finishCycle.mutate(activeCycle.id)
  }, [activeCycle, isComplete, isLoading, enabled, finishCycle])
}
