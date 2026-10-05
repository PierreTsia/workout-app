/**
 * Whether a finish attempt with zero logged sets may abandon (delete) the
 * session (#654). Only allowed when the server state is known: no real session
 * exists yet, or its set_logs loaded successfully. A failed or in-flight fetch
 * must fall back to the confirm dialog — deleting on unknown state loses real
 * training data. Note `isFetched` is true after an error too, so callers must
 * pass the *success* signal.
 */
export function canAbandonEmptySession(
  activeRealId: string | null,
  logsLoadSucceeded: boolean,
): boolean {
  return activeRealId == null || logsLoadSucceeded
}
