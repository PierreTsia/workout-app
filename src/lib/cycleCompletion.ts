interface CycleCompletionInput {
  cycleId?: string | null
  totalDays: number
  completedDayIds: string[]
  activeSessionDayId: string | null
  cycleSessionsFromCache?: { workout_day_id: string | null }[]
}

export function shouldCloseCycleOnSessionFinish({
  cycleId,
  totalDays,
  completedDayIds,
  activeSessionDayId,
  cycleSessionsFromCache,
}: CycleCompletionInput): boolean {
  if (!cycleId || totalDays <= 0) return false

  const completed = new Set(completedDayIds)
  for (const session of cycleSessionsFromCache ?? []) {
    if (session.workout_day_id) {
      completed.add(session.workout_day_id)
    }
  }
  if (activeSessionDayId) {
    completed.add(activeSessionDayId)
  }

  return completed.size >= totalDays
}
