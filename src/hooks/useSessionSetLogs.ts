import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { LABEL_EXERCISE_SELECT } from "@/lib/exerciseSelects"
import type { SetLogWithExercise } from "@/types/database"

export function useSessionSetLogs(sessionId: string | null) {
  return useQuery<SetLogWithExercise[]>({
    queryKey: ["session-set-logs", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("set_logs")
        .select(`*, exercise:exercises(${LABEL_EXERCISE_SELECT})`)
        .eq("session_id", sessionId!)
        // Chronological, not alphabetical: the snapshot is a frozen French name,
        // so ordering on it made the session read differently per locale — and
        // it can't order a list whose labels are resolved at render (T150).
        .order("logged_at")
        .order("set_number")

      if (error) throw error
      return (data as SetLogWithExercise[]) ?? []
    },
    enabled: !!sessionId,
  })
}
