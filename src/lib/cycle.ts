/**
 * Derives the cycle ID to attach to a new session.
 * Quick workouts (skipCycle) must never be linked to an active cycle.
 */
export function deriveCycleIdForSession(
  skipCycle: boolean,
  activeCycleId: string | null,
): string | null {
  return skipCycle ? null : (activeCycleId ?? null)
}
