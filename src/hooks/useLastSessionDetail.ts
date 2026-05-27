import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { SetPerformance } from "@/lib/progression"

/**
 * The last session's per-set log payload + metadata the engine needs to
 * decide between the **Prescription Snapshot** and **Manual Override Window**
 * read paths. See ADR 0006.
 *
 * `lastSessionFinishedAt` is null when the last session is in flight (no
 * `finished_at` yet). The engine treats null as "no closed reference" and
 * falls through to the template path.
 */
export interface LastSessionDetail {
  sets: SetPerformance[]
  lastSessionFinishedAt: string | null
}

interface SetLogRow {
  set_number: number
  reps_logged: string | null
  weight_logged: number
  rir: number | null
  session_id: string
  duration_seconds: number | null
  prescribed_reps: number | null
  prescribed_weight: number | null
  prescribed_sets: number | null
  prescribed_duration_seconds: number | null
  sessions: { finished_at: string | null } | null
}

export function useLastSessionDetail(
  exerciseId: string | undefined,
  sessionStartedAt?: number | null,
  measurementType?: "reps" | "duration",
) {
  const user = useAtomValue(authAtom)

  return useQuery<LastSessionDetail | null>({
    queryKey: ["last-session-detail", exerciseId, sessionStartedAt ?? null, measurementType ?? "reps"],
    staleTime: 30_000,
    queryFn: async (): Promise<LastSessionDetail | null> => {
      let query = supabase
        .from("set_logs")
        .select(
          "set_number, reps_logged, weight_logged, rir, session_id, " +
            "duration_seconds, prescribed_reps, prescribed_weight, " +
            "prescribed_sets, prescribed_duration_seconds, " +
            "sessions(finished_at)",
        )
        .eq("exercise_id", exerciseId!)

      if (sessionStartedAt) {
        query = query.lt("logged_at", new Date(sessionStartedAt).toISOString())
      }

      const { data, error } = await query
        .order("logged_at", { ascending: false })
        .limit(20)

      if (error) throw error
      if (!data || data.length === 0) return null

      const rows = data as unknown as SetLogRow[]
      const latestSessionId = rows[0].session_id
      const sessionLogs = rows.filter((l) => l.session_id === latestSessionId)

      const isDuration = measurementType === "duration"

      const sets = sessionLogs
        .filter((l) => (isDuration ? l.duration_seconds != null : l.duration_seconds == null))
        .map((row): SetPerformance => {
          if (isDuration) {
            return {
              reps: 0,
              weight: Number(row.weight_logged) || 0,
              completed: true,
              rir: row.rir,
              durationSeconds: row.duration_seconds ?? 0,
              prescribedReps: row.prescribed_reps,
              prescribedWeight: row.prescribed_weight,
              prescribedSets: row.prescribed_sets,
              prescribedDurationSeconds: row.prescribed_duration_seconds,
            }
          }

          const reps = parseInt(String(row.reps_logged), 10)
          return {
            reps: isNaN(reps) ? 0 : reps,
            weight: Number(row.weight_logged) || 0,
            completed: true,
            rir: row.rir,
            prescribedReps: row.prescribed_reps,
            prescribedWeight: row.prescribed_weight,
            prescribedSets: row.prescribed_sets,
            prescribedDurationSeconds: row.prescribed_duration_seconds,
          }
        })

      // Embedded resource — Postgres returns sessions.finished_at as nullable;
      // a session in flight (not yet finished) wouldn't have one. Returning
      // null lets the engine gate snapshot usage on `lastSessionFinishedAt !=
      // null` instead of leaning on Invalid Date semantics.
      const lastSessionFinishedAt = rows[0].sessions?.finished_at ?? null

      return { sets, lastSessionFinishedAt }
    },
    enabled: !!exerciseId && !!user,
  })
}
