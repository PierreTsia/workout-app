import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"

export interface ExerciseOption {
  id: string
  name: string
}

export function useExerciseHistory() {
  const user = useAtomValue(authAtom)

  return useQuery<ExerciseOption[]>({
    queryKey: ["exercise-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("set_logs")
        .select("exercise_id, exercise_name_snapshot")

      if (error) throw error
      if (!data) return []

      const seen = new Map<string, string>()
      for (const row of data) {
        if (!seen.has(row.exercise_id)) {
          seen.set(row.exercise_id, row.exercise_name_snapshot)
        }
      }

      return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) =>
        a.name.localeCompare(b.name),
      )
    },
    enabled: !!user,
  })
}
