import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Exercise } from "@/types/database"

export function useExerciseLibrary() {
  return useQuery<Exercise[]>({
    queryKey: ["exercise-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .order("muscle_group")
        .order("name")
      if (error) throw error
      return data as Exercise[]
    },
  })
}
