import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export interface SessionBlockRun {
  finished_at: string | null
  /** Catalog id stamped at GO. Null = jetable, or a run from before the column. */
  benchmarkCircuitId: string | null
}

/**
 * This session's `block_runs` keyed by `block_id`. Tours sessions have none.
 */
export function useSessionBlockRuns(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["session-block-runs", sessionId],
    queryFn: async (): Promise<Map<string, SessionBlockRun>> => {
      if (sessionId == null) return new Map()
      const { data, error } = await supabase
        .from("block_runs")
        .select("block_id, finished_at, benchmark_circuit_id")
        .eq("session_id", sessionId)
      if (error) throw error
      return new Map(
        (data ?? []).map((row) => [
          row.block_id,
          {
            finished_at: row.finished_at,
            benchmarkCircuitId: row.benchmark_circuit_id ?? null,
          },
        ]),
      )
    },
    enabled: Boolean(sessionId),
  })
}
