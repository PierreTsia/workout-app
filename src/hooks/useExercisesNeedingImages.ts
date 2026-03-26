import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Exercise } from "@/types/database"

export function useExercisesNeedingImages() {
  return useQuery({
    queryKey: ["exercises-needing-images"],
    queryFn: async (): Promise<Exercise[]> => {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .is("image_url", null)
        .order("muscle_group")
        .order("name")
      if (error) throw error
      return (data ?? []) as Exercise[]
    },
  })
}

export function useExerciseTotalCount() {
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
