import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Exercise } from "@/types/database"

export function useAdminExercises() {
  return useQuery({
    queryKey: ["admin-exercises"],
    queryFn: async (): Promise<Exercise[]> => {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .order("muscle_group")
        .order("name")
      if (error) throw error
      return (data ?? []) as Exercise[]
    },
  })
}
