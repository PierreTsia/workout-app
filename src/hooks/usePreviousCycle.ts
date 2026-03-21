import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Cycle } from "@/types/database"

export function usePreviousCycle(
  programId: string | null,
  currentCycleId: string | null,
) {
  return useQuery<Cycle | null>({
    queryKey: ["previous-cycle", programId, currentCycleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cycles")
        .select("*")
        .eq("program_id", programId!)
        .not("finished_at", "is", null)
        .neq("id", currentCycleId!)
        .order("finished_at", { ascending: false })
        .limit(1)
        .single()

      if (error?.code === "PGRST116") return null
      if (error) throw error
      return data
    },
    enabled: !!programId && !!currentCycleId,
  })
}
