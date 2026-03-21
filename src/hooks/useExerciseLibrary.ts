import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { Exercise } from "@/types/database"

const STALE_MS = 1000 * 60 * 30

export function useExerciseLibrary() {
  const user = useAtomValue(authAtom)

  return useQuery({
    queryKey: ["exercise-library"],
    queryFn: async (): Promise<Exercise[]> => {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .order("muscle_group")
        .order("name")

      if (error) throw error
      return (data ?? []) as Exercise[]
    },
    enabled: !!user,
    staleTime: STALE_MS,
  })
}
