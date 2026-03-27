import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { SetPerformance } from "@/lib/progression"

export function useLastSessionDetail(
  exerciseId: string | undefined,
  sessionStartedAt?: number | null,
  measurementType?: "reps" | "duration",
) {
  const user = useAtomValue(authAtom)

  return useQuery<SetPerformance[] | null>({
    queryKey: ["last-session-detail", exerciseId, sessionStartedAt ?? null, measurementType ?? "reps"],
    staleTime: 30_000,
    queryFn: async (): Promise<SetPerformance[] | null> => {
      let query = supabase
        .from("set_logs")
        .select("set_number, reps_logged, weight_logged, rir, session_id, duration_seconds")
        .eq("exercise_id", exerciseId!)

      if (sessionStartedAt) {
        query = query.lt("logged_at", new Date(sessionStartedAt).toISOString())
      }

      const { data, error } = await query
        .order("logged_at", { ascending: false })
        .limit(20)

      if (error) throw error
      if (!data || data.length === 0) return null

      const latestSessionId = (data[0] as { session_id: string }).session_id
      const sessionLogs = data.filter(
        (l) => (l as { session_id: string }).session_id === latestSessionId,
      )

      const isDuration = measurementType === "duration"

      return sessionLogs
        .filter((l) => {
          const dur = (l as { duration_seconds: number | null }).duration_seconds
          return isDuration ? dur != null : dur == null
        })
        .map((l) => {
          const row = l as {
            reps_logged: string | null
            weight_logged: number
            rir: number | null
            duration_seconds: number | null
          }

          if (isDuration) {
            return {
              reps: 0,
              weight: Number(row.weight_logged) || 0,
              completed: true,
              rir: row.rir,
              durationSeconds: row.duration_seconds ?? 0,
            } satisfies SetPerformance
          }

          const reps = parseInt(String(row.reps_logged), 10)
          return {
            reps: isNaN(reps) ? 0 : reps,
            weight: Number(row.weight_logged) || 0,
            completed: true,
            rir: row.rir,
          } satisfies SetPerformance
        })
    },
    enabled: !!exerciseId && !!user,
  })
}
