import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { WorkoutDay } from "@/types/database"

export function useWorkoutDays() {
  const user = useAtomValue(authAtom)

  return useQuery<WorkoutDay[]>({
    queryKey: ["workout-days", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_days")
        .select("id, user_id, program_id, label, emoji, sort_order, created_at")
        .eq("user_id", user!.id)
        .order("sort_order")

      if (error) throw error
      return data as WorkoutDay[]
    },
    enabled: !!user,
  })
}
