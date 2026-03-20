import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { CycleStats } from "@/types/database"

export function useCycleStats(
  cycleId: string | null,
  previousCycleId?: string | null,
) {
  return useQuery<CycleStats | null>({
    queryKey: ["cycle-stats", cycleId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cycle_stats", {
        p_cycle_id: cycleId!,
        p_previous_cycle_id: previousCycleId ?? null,
      })
      if (error) throw error

      const raw = data as Record<string, unknown> | null
      if (!raw || raw.error) return null

      return raw as unknown as CycleStats
    },
    enabled: !!cycleId,
  })
}
