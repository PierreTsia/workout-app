import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { SetLog } from "@/types/database"

export function useExerciseTrend(exerciseId: string | null) {
  return useQuery<SetLog[]>({
    queryKey: ["exercise-trend", exerciseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("set_logs")
        .select("*")
        .eq("exercise_id", exerciseId!)
        .order("logged_at", { ascending: true })

      if (error) throw error
      return (data as SetLog[]) ?? []
    },
    enabled: !!exerciseId,
  })
}
