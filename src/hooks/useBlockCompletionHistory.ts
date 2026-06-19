import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import {
  annotateRuns,
  completionTrend,
  computeBlockRuns,
  type BlockRunCellRow,
  type BlockRunView,
  type CompletionTrend,
} from "@/lib/blockCompletionHistory"

/** Cap on how many recent runs of a circuit we analyse (mirrors solo history depth). */
const RUN_LIMIT = 8

export interface BlockCompletionHistory {
  /** Recent runs, newest-first, annotated with delta / PB / shape-change. */
  views: BlockRunView[]
  /** Trend points for the most-recent prescription (empty if nothing to plot). */
  trend: CompletionTrend
}

const EMPTY: BlockCompletionHistory = { views: [], trend: { seconds: [], dates: [] } }

/**
 * Derive a circuit's completion-time history from its `set_logs` across all
 * sessions (#396, ADR 0008). A block lives on a workout day (not snapshotted per
 * session), so every run references the same `block_exercises` — we resolve them
 * by `block_id`, pull their logs, and let the pure lib do the rest. No writes.
 */
export async function fetchBlockCompletionHistory(
  blockId: string,
): Promise<BlockCompletionHistory> {
  const { data: beRows, error: beErr } = await supabase
    .from("block_exercises")
    .select("id")
    .eq("block_id", blockId)
  if (beErr) throw beErr

  const beIds = (beRows ?? []).map((r) => r.id)
  if (beIds.length === 0) return EMPTY

  const { data, error } = await supabase
    .from("set_logs")
    .select(
      "session_id, block_exercise_id, set_number, reps_logged, duration_seconds, weight_logged, logged_at",
    )
    .in("block_exercise_id", beIds)
    .order("logged_at", { ascending: true })
  if (error) throw error

  const rows: BlockRunCellRow[] = (data ?? []).map((r) => ({
    session_id: r.session_id,
    block_exercise_id: r.block_exercise_id as string,
    set_number: r.set_number,
    reps_logged: r.reps_logged,
    duration_seconds: r.duration_seconds,
    weight_logged: Number(r.weight_logged),
    logged_at: r.logged_at,
  }))

  const views = annotateRuns(computeBlockRuns(rows).slice(0, RUN_LIMIT))
  return { views, trend: completionTrend(views) }
}

export function useBlockCompletionHistory(open: boolean, blockId: string | undefined) {
  const user = useAtomValue(authAtom)
  const isOnline = useOnlineStatus()

  return useQuery<BlockCompletionHistory>({
    queryKey: ["block-completion-history", blockId],
    queryFn: () => fetchBlockCompletionHistory(blockId!),
    enabled: Boolean(open && blockId && isOnline && user),
    staleTime: 15_000,
  })
}
