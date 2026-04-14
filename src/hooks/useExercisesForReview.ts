import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Exercise } from "@/types/database"

export interface ExerciseWithUsage extends Exercise {
  usage_count: number
}

export const REVIEW_QUEUE_KEY = "exercises-for-review"

export function useExercisesForReview() {
  return useQuery({
    queryKey: [REVIEW_QUEUE_KEY],
    queryFn: async (): Promise<ExerciseWithUsage[]> => {
      const { data, error } = await supabase.rpc(
        "get_unreviewed_exercises_by_usage",
      )
      if (error) throw error
      return (data ?? []) as ExerciseWithUsage[]
    },
  })
}

export function useReviewTotalCount() {
  return useQuery({
    queryKey: ["exercises-total-count"],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("exercises")
        .select("*", { count: "exact", head: true })
      if (error) throw error
      return count ?? 0
    },
    staleTime: Infinity,
  })
}
