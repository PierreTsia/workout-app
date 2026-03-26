import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { SetPerformance } from "@/lib/progression"

export function useLastSessionDetail(exerciseId: string | undefined) {
  const user = useAtomValue(authAtom)

  return useQuery<SetPerformance[] | null>({
    queryKey: ["last-session-detail", exerciseId],
    staleTime: 30_000,
    queryFn: async (): Promise<SetPerformance[] | null> => {
      const { data, error } = await supabase
        .from("set_logs")
        .select("set_number, reps_logged, weight_logged, rir, session_id, duration_seconds")
        .eq("exercise_id", exerciseId!)
        .order("logged_at", { ascending: false })
        .limit(20)

      if (error) throw error
      if (!data || data.length === 0) return null

      const latestSessionId = (data[0] as { session_id: string }).session_id
      const sessionLogs = data.filter(
        (l) => (l as { session_id: string }).session_id === latestSessionId,
      )

      return sessionLogs
        .filter((l) => (l as { duration_seconds: number | null }).duration_seconds == null)
        .map((l) => {
          const row = l as {
            reps_logged: string | null
            weight_logged: number
            rir: number | null
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
