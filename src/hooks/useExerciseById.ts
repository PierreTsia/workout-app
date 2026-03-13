import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Exercise } from "@/types/database"

export function useExerciseById(id: string | null) {
  return useQuery({
    queryKey: ["exercise", id],
    queryFn: async (): Promise<Exercise | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .eq("id", id)
        .single()
      if (error) {
        if (error.code === "PGRST116") return null
        throw error
      }
      return data as Exercise
    },
    enabled: !!id,
  })
}
