import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { SetLog } from "@/types/database"

export function useSessionSetLogs(sessionId: string | null) {
  return useQuery<SetLog[]>({
    queryKey: ["session-set-logs", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("set_logs")
        .select("*")
        .eq("session_id", sessionId!)
        .order("exercise_name_snapshot")
        .order("set_number")

      if (error) throw error
      return (data as SetLog[]) ?? []
    },
    enabled: !!sessionId,
  })
}
