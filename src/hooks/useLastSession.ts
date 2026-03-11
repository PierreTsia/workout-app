import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { SetLog } from "@/types/database"

export interface LastSessionSummary {
  sets: number
  reps: string
  weight: number
}

export function useLastSession(exerciseId: string | undefined) {
  const user = useAtomValue(authAtom)

  return useQuery<LastSessionSummary | null>({
    queryKey: ["last-session", exerciseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("set_logs")
        .select("set_number, reps_logged, weight_logged, session_id")
        .eq("exercise_id", exerciseId!)
        .order("logged_at", { ascending: false })
        .limit(20)

      if (error) throw error
      if (!data || data.length === 0) return null

      const logs = data as Pick<
        SetLog,
        "set_number" | "reps_logged" | "weight_logged"
      > &
        { session_id: string }[]

      const latestSessionId = logs[0].session_id
      const sessionLogs = logs.filter((l) => l.session_id === latestSessionId)

      const repsValues = sessionLogs.map((l) => l.reps_logged)
      const allSameReps = repsValues.every((r) => r === repsValues[0])

      return {
        sets: sessionLogs.length,
        reps: allSameReps ? repsValues[0] : repsValues.join("/"),
        weight: Number(sessionLogs[0].weight_logged),
      }
    },
    enabled: !!exerciseId && !!user,
  })
}
