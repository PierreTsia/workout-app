import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { Exercise } from "@/types/database"

type ExerciseUpdate = Partial<
  Omit<Exercise, "id" | "created_at" | "is_system" | "reviewed_at" | "reviewed_by">
> & {
  instructions?: Exercise["instructions"]
}

export function useAdminUpdateExercise(exerciseId: string) {
  const queryClient = useQueryClient()
  const user = useAtomValue(authAtom)

  return useMutation({
    mutationFn: async (updates: ExerciseUpdate) => {
      const payload = {
        ...updates,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.email ?? "unknown",
      }
      const { data, error } = await supabase
        .from("exercises")
        .update(payload)
        .eq("id", exerciseId)
        .select()
        .single()
      if (error) throw error
      return data as Exercise
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercise", exerciseId] })
      queryClient.invalidateQueries({ queryKey: ["admin-exercises"] })
      queryClient.invalidateQueries({ queryKey: ["exercise-library-paginated"] })
    },
  })
}
