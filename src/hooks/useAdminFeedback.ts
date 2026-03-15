import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { ExerciseContentFeedback } from "@/types/database"

export function useAdminFeedback() {
  return useQuery({
    queryKey: ["admin-feedback"],
    queryFn: async (): Promise<ExerciseContentFeedback[]> => {
      const { data, error } = await supabase
        .from("exercise_content_feedback")
        .select("*, exercises(name, emoji)")
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as ExerciseContentFeedback[]
    },
  })
}
