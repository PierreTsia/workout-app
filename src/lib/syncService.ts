export interface SetLogPayload {
  sessionId: string
  exerciseId: string
  exerciseNameSnapshot: string
  setNumber: number
  repsLogged: string
  weightLogged: number
  loggedAt: number
}

export interface SessionFinishPayload {
  sessionId: string
  workoutDayId: string
  workoutLabelSnapshot: string
  startedAt: number
  finishedAt: number
  totalSetsDone: number
  hasSkippedSets: boolean
}

/** Stub -- real implementation in T4 */
export function enqueueSetLog(payload: SetLogPayload): void {
  console.debug("[SyncService] enqueueSetLog", payload)
}

/** Stub -- real implementation in T4 */
export function enqueueSessionFinish(payload: SessionFinishPayload): void {
  console.debug("[SyncService] enqueueSessionFinish", payload)
}
