import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export interface ExerciseFilterOptions {
  muscle_groups: string[]
  equipment: string[]
  difficulty_levels: string[]
}

export function useExerciseFilterOptions() {
  return useQuery({
    queryKey: ["exercise-filter-options"],
    queryFn: async (): Promise<ExerciseFilterOptions> => {
      const { data, error } = await supabase.rpc("get_exercise_filter_options")
      if (error) throw error
      const raw = data as {
        muscle_groups: string[]
        equipment: string[]
        difficulty_levels: string[]
      }
      return {
        muscle_groups: raw?.muscle_groups ?? [],
        equipment: raw?.equipment ?? [],
        difficulty_levels: raw?.difficulty_levels ?? [],
      }
    },
  })
}
