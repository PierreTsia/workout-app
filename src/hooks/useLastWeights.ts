import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"

export function useLastWeights(exerciseIds: string[]) {
  const user = useAtomValue(authAtom)
  const sortedIds = [...exerciseIds].sort()

  return useQuery<Record<string, number>>({
    queryKey: ["last-weights", sortedIds],
    queryFn: async () => {
      if (sortedIds.length === 0) return {}

      const { data, error } = await supabase
        .from("set_logs")
        .select("exercise_id, weight_logged, logged_at")
        .in("exercise_id", sortedIds)
        .order("logged_at", { ascending: false })

      if (error) throw error
      if (!data || data.length === 0) return {}

      const result: Record<string, number> = {}
      for (const row of data) {
        if (!(row.exercise_id in result)) {
          result[row.exercise_id] = Number(row.weight_logged)
        }
      }
      return result
    },
    enabled: sortedIds.length > 0 && !!user,
  })
}
