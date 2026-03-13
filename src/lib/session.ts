import type { SessionState } from "@/store/atoms"

/**
 * Computes effective training time in ms, excluding any paused durations.
 */
export function getEffectiveElapsed(
  session: Pick<SessionState, "startedAt" | "pausedAt" | "accumulatedPause">,
  now = Date.now(),
): number {
  if (!session.startedAt) return 0
  const accumulated = session.accumulatedPause ?? 0
  const currentPause = session.pausedAt ? now - session.pausedAt : 0
  return now - session.startedAt - accumulated - currentPause
}
