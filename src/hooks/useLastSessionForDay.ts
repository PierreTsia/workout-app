import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

interface LastSessionInfo {
  id: string
  started_at: string
  finished_at: string
  total_sets_done: number
  has_skipped_sets: boolean
}

export function useLastSessionForDay(dayId: string | null) {
  return useQuery<LastSessionInfo | null>({
    queryKey: ["last-session-for-day", dayId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, started_at, finished_at, total_sets_done, has_skipped_sets")
        .eq("workout_day_id", dayId!)
        .not("finished_at", "is", null)
        .order("finished_at", { ascending: false })
        .limit(1)
        .single()

      if (error?.code === "PGRST116") return null
      if (error) throw error
      return data
    },
    enabled: !!dayId,
    staleTime: 5 * 60 * 1000,
  })
}
