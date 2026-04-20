import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { SLIM_EXERCISE_SELECT } from "@/lib/exerciseSelects"
import { authAtom } from "@/store/atoms"
import type { ExerciseListItem } from "@/types/database"

const STALE_MS = 1000 * 60 * 30

/**
 * Slim catalog fetch for lookup/map use cases. Uses the shared
 * `SLIM_EXERCISE_SELECT` — rich fields like `instructions`/`youtube_url`
 * are fetched on demand via `useExerciseById`.
 */
export function useExerciseLibrary() {
  const user = useAtomValue(authAtom)

  return useQuery({
    queryKey: ["exercise-library"],
    queryFn: async (): Promise<ExerciseListItem[]> => {
      const { data, error } = await supabase
        .from("exercises")
        .select(SLIM_EXERCISE_SELECT)
        .order("muscle_group")
        .order("name")

      if (error) throw error
      return (data ?? []) as unknown as ExerciseListItem[]
    },
    enabled: !!user,
    staleTime: STALE_MS,
  })
}
