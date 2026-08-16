import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import {
  catalogLabelFromEmbed,
  catalogSlugFromEmbed,
} from "@/lib/sessionHistoryGrouping"

export interface SessionBlockRun {
  finished_at: string | null
  /** Catalog id stamped at GO. Null = jetable, or a run from before the column. */
  benchmarkCircuitId: string | null
  /** Seed slug at GO. Null on a Circuit Fork (slug-less) or a jetable. */
  catalogSlug: string | null
  /** Display label joined through the GO-stamped catalog identity. */
  catalogLabel: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function parseSessionBlockRun(
  row: unknown,
): { blockId: string; run: SessionBlockRun } | null {
  if (!isRecord(row) || typeof row.block_id !== "string") return null
  const finished = row.finished_at
  const catalogId = row.benchmark_circuit_id
  return {
    blockId: row.block_id,
    run: {
      finished_at: typeof finished === "string" ? finished : null,
      benchmarkCircuitId: typeof catalogId === "string" ? catalogId : null,
      catalogSlug: catalogSlugFromEmbed(row.benchmark_circuits),
      catalogLabel: catalogLabelFromEmbed(row.benchmark_circuits),
    },
  }
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
        .select(
          "block_id, finished_at, benchmark_circuit_id, benchmark_circuits(slug, label)",
        )
        .eq("session_id", sessionId)
      if (error) throw error
      return new Map(
        (data ?? []).flatMap((row) => {
          const parsed = parseSessionBlockRun(row)
          return parsed ? [[parsed.blockId, parsed.run] as const] : []
        }),
      )
    },
    enabled: Boolean(sessionId),
  })
}
