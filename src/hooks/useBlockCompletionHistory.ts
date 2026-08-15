import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import {
  annotateAmrapRuns,
  type AmrapHistoryRun,
  type AmrapRunView,
  type AmrapScoreCell,
} from "@/lib/amrapScore"
import {
  annotateRuns,
  completionTrend,
  computeBlockRuns,
  type BlockRunCellRow,
  type BlockRunView,
  type CompletionTrend,
} from "@/lib/blockCompletionHistory"
import type { ExerciseBlockMode } from "@/types/database"

/** Cap on how many recent runs of a circuit we analyse (mirrors solo history depth). */
const RUN_LIMIT = 8

export interface BlockCompletionHistory {
  mode: ExerciseBlockMode
  /** Tours runs, newest-first, annotated with delta / PB / shape-change. */
  views: BlockRunView[]
  /** Trend points for the most-recent Tours prescription (empty if nothing to plot). */
  trend: CompletionTrend
  /** AMRAP runs, newest-first. Empty when `mode === "rounds"`. */
  amrapViews: AmrapRunView[]
}

const EMPTY: BlockCompletionHistory = {
  mode: "rounds",
  views: [],
  trend: { seconds: [], dates: [] },
  amrapViews: [],
}

function isAmrapMode(mode: string | null | undefined): mode is "amrap" {
  return mode === "amrap"
}

/**
 * Derive a circuit's history. Tours stays ADR 0008 (`annotateRuns` / CCT).
 * AMRAP uses `block_runs.finished_at` + leftover from `set_logs`, grouped by
 * the GO `template_fingerprint` — never mixed with Tours.
 */
export async function fetchBlockCompletionHistory(
  blockId: string,
): Promise<BlockCompletionHistory> {
  const { data: blockRow, error: blockErr } = await supabase
    .from("exercise_blocks")
    .select("mode")
    .eq("id", blockId)
    .maybeSingle()
  if (blockErr) throw blockErr

  const { data: beRows, error: beErr } = await supabase
    .from("block_exercises")
    .select("id")
    .eq("block_id", blockId)
  if (beErr) throw beErr

  const beIds = (beRows ?? []).map((r) => r.id)
  if (beIds.length === 0) {
    return { ...EMPTY, mode: isAmrapMode(blockRow?.mode) ? "amrap" : "rounds" }
  }

  if (isAmrapMode(blockRow?.mode)) {
    return fetchAmrapHistory(blockId, beIds)
  }

  const { data, error } = await supabase
    .from("set_logs")
    .select(
      "session_id, block_exercise_id, set_number, reps_logged, duration_seconds, weight_logged, logged_at",
    )
    .in("block_exercise_id", beIds)
    .order("logged_at", { ascending: true })
  if (error) throw error

  const rows: BlockRunCellRow[] = (data ?? [])
    .filter(
      (r): r is typeof r & { block_exercise_id: string } =>
        r.block_exercise_id != null,
    )
    .map((r) => ({
      session_id: r.session_id,
      block_exercise_id: r.block_exercise_id,
      set_number: r.set_number,
      reps_logged: r.reps_logged,
      duration_seconds: r.duration_seconds,
      weight_logged: Number(r.weight_logged),
      logged_at: r.logged_at,
    }))

  const views = annotateRuns(computeBlockRuns(rows).slice(0, RUN_LIMIT))
  return {
    mode: "rounds",
    views,
    trend: completionTrend(views),
    amrapViews: [],
  }
}

async function fetchAmrapHistory(
  blockId: string,
  beIds: string[],
): Promise<BlockCompletionHistory> {
  const [runsResult, logsResult] = await Promise.all([
    supabase
      .from("block_runs")
      .select("session_id, started_at, finished_at, template_fingerprint")
      .eq("block_id", blockId)
      .order("started_at", { ascending: false })
      .limit(RUN_LIMIT),
    supabase
      .from("set_logs")
      .select(
        "session_id, set_number, reps_logged, duration_seconds, logged_at, exercise_name_snapshot",
      )
      .in("block_exercise_id", beIds)
      .order("logged_at", { ascending: true }),
  ])
  if (runsResult.error) throw runsResult.error
  if (logsResult.error) throw logsResult.error

  const runs: AmrapHistoryRun[] = (runsResult.data ?? []).map((r) => ({
    session_id: r.session_id,
    started_at: r.started_at,
    finished_at: r.finished_at,
    template_fingerprint: r.template_fingerprint,
  }))
  const cells: AmrapScoreCell[] = (logsResult.data ?? []).map((r) => ({
    session_id: r.session_id,
    set_number: r.set_number,
    reps_logged: r.reps_logged,
    duration_seconds: r.duration_seconds,
    logged_at: r.logged_at,
    exercise_name: r.exercise_name_snapshot,
  }))

  return {
    mode: "amrap",
    views: [],
    trend: { seconds: [], dates: [] },
    amrapViews: annotateAmrapRuns(runs, cells),
  }
}

export function useBlockCompletionHistory(open: boolean, blockId: string | undefined) {
  const user = useAtomValue(authAtom)
  const isOnline = useOnlineStatus()

  return useQuery<BlockCompletionHistory>({
    queryKey: ["block-completion-history", blockId],
    queryFn: () =>
      blockId == null ? Promise.resolve(EMPTY) : fetchBlockCompletionHistory(blockId),
    enabled: Boolean(open && blockId && isOnline && user),
    staleTime: 15_000,
  })
}
