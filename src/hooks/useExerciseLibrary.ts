import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { ExerciseListItem } from "@/types/database"

const STALE_MS = 1000 * 60 * 30

/**
 * Slim catalog fetch for lookup/map use cases (e.g. hydrating session-side
 * `exerciseById` or the AI-generation pool is NOT a caller — see T69).
 *
 * Enumerated columns instead of `*` to avoid shipping rich fields (JSONB
 * `instructions`, `youtube_url`, `source`, `reviewed_*`) in the hot path.
 * Rich fields are fetched per-id via `useExerciseById` as needed.
 *
 * `measurement_type` + `default_duration_seconds` are kept because the
 * active-session pool uses them for duration-vs-reps branching.
 */
const SLIM_SELECT =
  "id, name, name_en, emoji, muscle_group, equipment, image_url, difficulty_level, is_system, measurement_type, default_duration_seconds, secondary_muscles"

export function useExerciseLibrary() {
  const user = useAtomValue(authAtom)

  return useQuery({
    queryKey: ["exercise-library"],
    queryFn: async (): Promise<ExerciseListItem[]> => {
      const { data, error } = await supabase
        .from("exercises")
        .select(SLIM_SELECT)
        .order("muscle_group")
        .order("name")

      if (error) throw error
      return (data ?? []) as unknown as ExerciseListItem[]
    },
    enabled: !!user,
    staleTime: STALE_MS,
  })
}
