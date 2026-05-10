import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import { buildWorkoutExerciseInsertRowsForDay } from "@/lib/programPersistence"
import type { GeneratedWorkout } from "@/types/generator"

interface CreateQuickWorkoutInput {
  workout: GeneratedWorkout
  saveAsDraft?: boolean
}

export function useCreateQuickWorkout() {
  const user = useAtomValue(authAtom)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ workout, saveAsDraft }: CreateQuickWorkoutInput) => {
      if (!user) throw new Error("Not authenticated")

      const { data: day, error: dayError } = await supabase
        .from("workout_days")
        .insert({
          user_id: user.id,
          program_id: null,
          label: workout.name,
          emoji: "⚡",
          sort_order: 0,
          ...(saveAsDraft ? { saved_at: new Date().toISOString() } : {}),
        })
        .select("id")
        .single()
      if (dayError) throw dayError

      // Single source of truth for the workout_exercises shape, shared with
      // `create_workout_day` (MCP tool). T125 collapsed the previous inline
      // construction into this helper call so AI / deterministic / draft
      // paths converge by construction.
      const exerciseRows = buildWorkoutExerciseInsertRowsForDay(
        day.id,
        workout.exercises,
      )

      const { error: exError } = await supabase
        .from("workout_exercises")
        .insert(exerciseRows)
      if (exError) throw exError

      return { dayId: day.id, wasDraft: !!saveAsDraft }
    },
    onSuccess: ({ wasDraft }) => {
      if (wasDraft) {
        queryClient.invalidateQueries({ queryKey: ["saved-workouts"] })
      }
    },
  })
}
