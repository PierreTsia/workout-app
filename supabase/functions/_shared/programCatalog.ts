/**
 * Shared catalog / profile / history readers used by every Edge function
 * that builds a generation prompt from the user's training context. Extracted
 * from `embedded-agent/index.ts` (T126, #342) to deduplicate with the
 * upcoming `generate-quick-workout` (T127).
 *
 * The interface shapes mirror the (untouched) ones in
 * `generate-program/prompt.ts` — duplicated intentionally so this module
 * doesn't grow a dependency on a feature module that #343 will retire. When
 * `generate-program` dies, these stay; when something else reads catalog
 * data, it imports from here.
 */

import type { createServiceClient } from "./supabase.ts"

type ServiceClient = ReturnType<typeof createServiceClient>

export interface CatalogExercise {
  id: string
  name_en: string | null
  muscle_group: string
  equipment: string
  secondary_muscles: string[] | null
  difficulty_level: string | null
}

export interface UserProfile {
  experience: string
  goal: string
  equipment: string
  training_days_per_week: number
  age: number | null
  gender: string | null
}

export interface RecentExercise {
  exercise_id: string
  exercise_name_snapshot: string
}

export async function fetchCatalog(
  supabase: ServiceClient,
  equipmentValues: string[],
  muscleGroupFilter?: string[],
): Promise<CatalogExercise[]> {
  // The query builder is mutable; chain conditionally so embedded-agent's
  // unfiltered catalog and Quick Workout's muscle-scoped catalog share the
  // same SELECT shape without duplicating the helper.
  let query = supabase
    .from("exercises")
    .select("id, name_en, muscle_group, equipment, secondary_muscles, difficulty_level")
    .in("equipment", equipmentValues)

  if (muscleGroupFilter && muscleGroupFilter.length > 0) {
    query = query.in("muscle_group", muscleGroupFilter)
  }

  const { data, error } = await query.order("muscle_group").order("name")
  if (error) throw error
  return (data ?? []) as CatalogExercise[]
}

export async function fetchProfile(
  supabase: ServiceClient,
  userId: string,
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("experience, goal, equipment, training_days_per_week, age, gender")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  return data as UserProfile | null
}

export async function fetchRecentHistory(
  supabase: ServiceClient,
  userId: string,
): Promise<{ exercises: RecentExercise[]; lastSessionAt: string | null }> {
  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select("id, finished_at")
    .eq("user_id", userId)
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(5)
  if (sessionsError) throw sessionsError
  if (!sessions || sessions.length === 0) {
    return { exercises: [], lastSessionAt: null }
  }

  const lastSessionAt = (sessions[0] as { finished_at: string }).finished_at
  const sessionIds = (sessions as Array<{ id: string }>).map((s) => s.id)

  const { data: logs, error: logsError } = await supabase
    .from("set_logs")
    .select("exercise_id, exercise_name_snapshot")
    .in("session_id", sessionIds)
  if (logsError) throw logsError
  if (!logs) return { exercises: [], lastSessionAt }

  // Dedupe by `exercise_id` while preserving first-seen order. Set + array
  // would be the more idiomatic functional pipe, but the reduce keeps
  // ordering deterministic without a second pass.
  const { exercises } = (logs as RecentExercise[]).reduce(
    (acc, log) => {
      if (acc.seen.has(log.exercise_id)) return acc
      acc.seen.add(log.exercise_id)
      acc.exercises.push(log)
      return acc
    },
    { seen: new Set<string>(), exercises: [] as RecentExercise[] },
  )

  return { exercises, lastSessionAt }
}
