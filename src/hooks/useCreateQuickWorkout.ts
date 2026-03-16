import { useMutation } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { GeneratedWorkout } from "@/types/generator"

export function useCreateQuickWorkout() {
  const user = useAtomValue(authAtom)

  return useMutation({
    mutationFn: async (workout: GeneratedWorkout) => {
      if (!user) throw new Error("Not authenticated")

      const { data: day, error: dayError } = await supabase
        .from("workout_days")
        .insert({
          user_id: user.id,
          program_id: null,
          label: workout.name,
          emoji: "⚡",
          sort_order: 0,
        })
        .select("id")
        .single()
      if (dayError) throw dayError

      const exerciseRows = workout.exercises.map((ge, i) => ({
        workout_day_id: day.id,
        exercise_id: ge.exercise.id,
        name_snapshot: ge.exercise.name,
        muscle_snapshot: ge.exercise.muscle_group,
        emoji_snapshot: ge.exercise.emoji,
        sets: ge.sets,
        reps: ge.reps,
        weight: "0",
        rest_seconds: ge.restSeconds,
        sort_order: i,
      }))

      const { error: exError } = await supabase
        .from("workout_exercises")
        .insert(exerciseRows)
      if (exError) throw exError

      return { dayId: day.id }
    },
  })
}
