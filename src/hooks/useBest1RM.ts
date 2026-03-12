import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import { computeEpley1RM } from "@/lib/epley"

export function useBest1RM(exerciseId: string | undefined) {
  const user = useAtomValue(authAtom)

  return useQuery<number>({
    queryKey: ["best-1rm", exerciseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("set_logs")
        .select("reps_logged, weight_logged, estimated_1rm")
        .eq("exercise_id", exerciseId!)

      if (error) throw error
      if (!data || data.length === 0) return 0

      let best = 0
      for (const row of data) {
        const rm =
          row.estimated_1rm != null
            ? Number(row.estimated_1rm)
            : computeEpley1RM(
                Number(row.weight_logged) || 0,
                parseInt(String(row.reps_logged), 10),
              )
        if (rm > best) best = rm
      }
      return best
    },
    enabled: !!exerciseId && !!user,
  })
}
