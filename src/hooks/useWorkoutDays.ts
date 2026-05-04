import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { WorkoutDay } from "@/types/database"

export type WorkoutDayWithExerciseCount = WorkoutDay & {
  exerciseCount: number
}

type DayRow = WorkoutDay & { workout_exercises: { id: string }[] | null }

export function useWorkoutDays(programId: string | null) {
  const user = useAtomValue(authAtom)

  return useQuery<WorkoutDayWithExerciseCount[]>({
    queryKey: ["workout-days", user?.id, programId],
    queryFn: async () => {
      // Embed `workout_exercises(id)` so list views (e.g. DayList) can render an
      // exercise count without firing one `useWorkoutExercises(dayId)` per card.
      // Id-only embed keeps the payload tiny; the heavy `FULL_EXERCISE_SELECT`
      // is still loaded on-demand by `useWorkoutExercises` when DayEditor opens.
      const { data, error } = await supabase
        .from("workout_days")
        .select(
          "id, user_id, program_id, label, emoji, sort_order, created_at, workout_exercises(id)",
        )
        .eq("user_id", user!.id)
        .eq("program_id", programId!)
        .order("sort_order")

      if (error) throw error

      return (data as DayRow[]).map(({ workout_exercises, ...day }) => ({
        ...day,
        exerciseCount: workout_exercises?.length ?? 0,
      }))
    },
    enabled: !!user && !!programId,
  })
}
