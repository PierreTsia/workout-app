// Concrete Supabase queries that feed `buildAdditionalProgramBundle`
// (T133, #343). Split from `bundle.ts` so the pure projection logic stays
// testable without a DB and the queries can be exercised via the
// embedded-agent edge function E2E (T136).
//
// Schema references:
//   - `user_profiles` — onboarding writes one row per user (one-to-one).
//   - `programs` (id, user_id, name, is_active) — partial unique index on
//     (user_id) WHERE is_active = true. Lookup is O(1).
//   - `workout_days` (id, program_id, label, sort_order) — N rows per program.
//   - `workout_exercises` (workout_day_id, muscle_snapshot, …) — uses the
//     snapshotted muscle group so a later catalog rename never silently
//     mutates an old bundle.
//   - `sessions` (id, user_id, started_at, finished_at) — completed when
//     `finished_at is not null`.
//   - `set_logs` (session_id, exercise_id, ...) — joined to `exercises`
//     for muscle_group counts.

import type { createServiceClient } from "../../_shared/supabase.ts"
import type {
  ActiveProgramDayRow,
  ActiveProgramRow,
  ProfileRow,
  RecentStatsRow,
} from "./bundle.ts"

type ServiceClient = ReturnType<typeof createServiceClient>

const MS_PER_DAY = 24 * 60 * 60 * 1000

export async function fetchProfileForBundle(
  supabase: ServiceClient,
  userId: string,
): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "goal, experience, equipment, training_days_per_week, session_duration_minutes, age, weight_kg, gender",
    )
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return data as ProfileRow
}

export async function fetchActiveProgramForBundle(
  supabase: ServiceClient,
  userId: string,
): Promise<ActiveProgramRow | null> {
  const { data: program, error: programError } = await supabase
    .from("programs")
    .select("id, name")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle()
  if (programError) throw programError
  if (!program) return null

  const programRow = program as { id: string; name: string }

  const { data: days, error: daysError } = await supabase
    .from("workout_days")
    .select("id, label, sort_order")
    .eq("program_id", programRow.id)
    .order("sort_order", { ascending: true })
  if (daysError) throw daysError

  const dayRows = (days ?? []) as Array<{
    id: string
    label: string
    sort_order: number
  }>

  if (dayRows.length === 0) {
    return { id: programRow.id, name: programRow.name, days: [] }
  }

  const dayIds = dayRows.map((d) => d.id)
  const { data: exercises, error: exercisesError } = await supabase
    .from("workout_exercises")
    .select("workout_day_id, muscle_snapshot")
    .in("workout_day_id", dayIds)
  if (exercisesError) throw exercisesError

  const exerciseRows = (exercises ?? []) as Array<{
    workout_day_id: string
    muscle_snapshot: string
  }>

  // Group exercises by day in a single pass — O(n) instead of nested filters.
  const exercisesByDay = exerciseRows.reduce((acc, row) => {
    const bucket = acc.get(row.workout_day_id) ?? []
    bucket.push({ muscle_group: row.muscle_snapshot })
    acc.set(row.workout_day_id, bucket)
    return acc
  }, new Map<string, Array<{ muscle_group: string }>>())

  const projectedDays: ActiveProgramDayRow[] = dayRows.map((d) => ({
    label: d.label,
    exercises: exercisesByDay.get(d.id) ?? [],
  }))

  return { id: programRow.id, name: programRow.name, days: projectedDays }
}

export async function fetchRecentStatsForBundle(
  supabase: ServiceClient,
  userId: string,
  windowDays: number,
): Promise<RecentStatsRow> {
  const since = new Date(Date.now() - windowDays * MS_PER_DAY).toISOString()

  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select("id, started_at, finished_at")
    .eq("user_id", userId)
    .not("finished_at", "is", null)
    .gte("finished_at", since)
  if (sessionsError) throw sessionsError

  const sessionRows = (sessions ?? []) as Array<{
    id: string
    started_at: string
    finished_at: string
  }>

  if (sessionRows.length === 0) {
    return {
      total_sessions: 0,
      muscle_group_counts: [],
      avg_session_duration_minutes: null,
    }
  }

  const totalSessions = sessionRows.length
  const avgDuration = computeAverageDurationMinutes(sessionRows)

  const sessionIds = sessionRows.map((s) => s.id)
  const { data: setLogs, error: setLogsError } = await supabase
    .from("set_logs")
    .select("exercise_id, exercises(muscle_group)")
    .in("session_id", sessionIds)
  if (setLogsError) throw setLogsError

  type SetLogJoined = {
    exercise_id: string
    // PostgREST returns the related row either as an array or a single
    // object depending on the join cardinality. We accept both.
    exercises: { muscle_group: string } | Array<{ muscle_group: string }> | null
  }
  const setLogRows = (setLogs ?? []) as SetLogJoined[]

  const counts = setLogRows.reduce((acc, log) => {
    const muscle = extractMuscleGroup(log.exercises)
    if (!muscle) return acc
    acc.set(muscle, (acc.get(muscle) ?? 0) + 1)
    return acc
  }, new Map<string, number>())

  const muscleGroupCounts = Array.from(counts.entries()).map(
    ([muscle_group, count]) => ({ muscle_group, count }),
  )

  return {
    total_sessions: totalSessions,
    muscle_group_counts: muscleGroupCounts,
    avg_session_duration_minutes: avgDuration,
  }
}

function computeAverageDurationMinutes(
  sessions: Array<{ started_at: string; finished_at: string }>,
): number | null {
  // Negative / NaN deltas are silently dropped — corrupt rows shouldn't
  // poison the avg. If everything is dropped we return null (rather than
  // 0) so the prompt can distinguish "no signal" from "0 minute sessions".
  const durations = sessions
    .map((s) => {
      const start = Date.parse(s.started_at)
      const end = Date.parse(s.finished_at)
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null
      const minutes = (end - start) / 60000
      return minutes > 0 ? minutes : null
    })
    .filter((m): m is number => m !== null)

  if (durations.length === 0) return null
  const sum = durations.reduce((a, b) => a + b, 0)
  return Math.round(sum / durations.length)
}

function extractMuscleGroup(
  related: { muscle_group: string } | Array<{ muscle_group: string }> | null,
): string | null {
  if (!related) return null
  if (Array.isArray(related)) {
    return related[0]?.muscle_group ?? null
  }
  return related.muscle_group ?? null
}
