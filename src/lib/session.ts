import type { SessionState } from "@/store/atoms"

/**
 * Hidden-time guard (#664): a background/locked span longer than this is
 * excluded from `active_duration_ms`; at or below it, the span counts.
 */
export const VISIBILITY_GUARD_MS = 15 * 60 * 1000

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

/** Clears session pause and folds elapsed pause into `accumulatedPause`. */
export function resumeSessionFromPause(prev: SessionState): SessionState {
  if (prev.pausedAt == null) return prev
  const pauseDuration = Date.now() - prev.pausedAt
  return {
    ...prev,
    pausedAt: null,
    pausedByVisibility: undefined,
    accumulatedPause: (prev.accumulatedPause ?? 0) + pauseDuration,
  }
}

/**
 * Auto-pauses an active session when the app goes hidden (#655). Never clobbers
 * a pause the user set, so a manual pause survives an app background/foreground.
 */
export function pauseSessionForVisibility(
  prev: SessionState,
  now = Date.now(),
): SessionState {
  if (!prev.isActive || prev.pausedAt != null) return prev
  return { ...prev, pausedAt: now, pausedByVisibility: true }
}

/**
 * Resolves a guard-placed pause on return (#664). The hidden span counts when
 * it is at or below `thresholdMs`; above it, the whole span is folded into
 * `accumulatedPause` so it never reaches `active_duration_ms`. A manual pause
 * (no `pausedByVisibility`) is never touched.
 */
export function resumeSessionFromVisibilityPause(
  prev: SessionState,
  now = Date.now(),
  thresholdMs = VISIBILITY_GUARD_MS,
): SessionState {
  if (!prev.pausedByVisibility || prev.pausedAt == null) return prev
  const hiddenDuration = now - prev.pausedAt
  const excluded = hiddenDuration > thresholdMs ? hiddenDuration : 0
  return {
    ...prev,
    pausedAt: null,
    pausedByVisibility: undefined,
    accumulatedPause: (prev.accumulatedPause ?? 0) + excluded,
  }
}
