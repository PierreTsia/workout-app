import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { WorkoutDay, WorkoutExercise } from "@/types/database"

export interface SavedWorkout extends WorkoutDay {
  workout_exercises: Pick<
    WorkoutExercise,
    "id" | "name_snapshot" | "emoji_snapshot" | "sets" | "reps" | "muscle_snapshot"
  >[]
}

export function useSavedWorkouts() {
  const user = useAtomValue(authAtom)

  return useQuery<SavedWorkout[]>({
    queryKey: ["saved-workouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_days")
        .select(
          "*, workout_exercises(id, name_snapshot, emoji_snapshot, sets, reps, muscle_snapshot)",
        )
        .not("saved_at", "is", null)
        .is("program_id", null)
        .order("saved_at", { ascending: false })

      if (error) throw error
      return (data as SavedWorkout[]) ?? []
    },
    enabled: !!user,
  })
}
