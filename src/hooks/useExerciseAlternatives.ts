import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { ExerciseAlternative } from "@/types/onboarding"

export function useExerciseAlternatives() {
  return useQuery<ExerciseAlternative[]>({
    queryKey: ["exercise-alternatives"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_alternatives")
        .select("exercise_id, alternative_exercise_id, equipment_context")

      if (error) throw error
      return data as ExerciseAlternative[]
    },
  })
}
