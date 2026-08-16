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
import type { BenchmarkCircuitReference } from "@/types/database"

const RUN_LIMIT = 8

export interface BenchmarkCopy {
  slug: string | null
  label: string | null
  tagline_fr: string | null
  tagline_en: string | null
  story_fr: string | null
  story_en: string | null
  reference: BenchmarkCircuitReference | null
}

export interface BenchmarkCompletionHistory {
  copy: BenchmarkCopy
  amrapViews: AmrapRunView[]
}

const EMPTY_COPY: BenchmarkCopy = {
  slug: null,
  label: null,
  tagline_fr: null,
  tagline_en: null,
  story_fr: null,
  story_en: null,
  reference: null,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function parseReference(value: unknown): BenchmarkCircuitReference | null {
  if (!isRecord(value)) return null
  if (typeof value.name !== "string" || typeof value.score !== "string") {
    return null
  }
  return { name: value.name, score: value.score }
}

function parseCopy(row: unknown): BenchmarkCopy {
  if (!isRecord(row)) return EMPTY_COPY
  return {
    slug: stringOrNull(row.slug),
    label: stringOrNull(row.label),
    tagline_fr: stringOrNull(row.tagline_fr),
    tagline_en: stringOrNull(row.tagline_en),
    story_fr: stringOrNull(row.story_fr),
    story_en: stringOrNull(row.story_en),
    reference: parseReference(row.reference),
  }
}

async function fetchCatalogCopy(catalogId: string): Promise<BenchmarkCopy> {
  const { data, error } = await supabase
    .from("benchmark_circuits")
    .select("slug, label, tagline_fr, tagline_en, story_fr, story_en, reference")
    .eq("id", catalogId)
    .maybeSingle()
  if (error) throw error
  return parseCopy(data)
}

export async function fetchBenchmarkCompletionHistory(
  catalogId: string,
): Promise<BenchmarkCompletionHistory> {
  const [copy, runsResult] = await Promise.all([
    fetchCatalogCopy(catalogId),
    supabase
      .from("block_runs")
      .select("session_id, started_at, finished_at, template_fingerprint, block_id")
      .eq("benchmark_circuit_id", catalogId)
      .order("started_at", { ascending: false })
      .limit(RUN_LIMIT),
  ])
  if (runsResult.error) throw runsResult.error

  const runRows = runsResult.data ?? []
  const runs: AmrapHistoryRun[] = runRows.map((r) => ({
    session_id: r.session_id,
    started_at: r.started_at,
    finished_at: r.finished_at,
    template_fingerprint: r.template_fingerprint,
  }))

  const blockIds = [...new Set(runRows.map((r) => r.block_id))]
  const sessionIds = [...new Set(runRows.map((r) => r.session_id))]
  if (blockIds.length === 0 || sessionIds.length === 0) {
    return { copy, amrapViews: annotateAmrapRuns(runs, []) }
  }

  const { data: beRows, error: beErr } = await supabase
    .from("block_exercises")
    .select("id")
    .in("block_id", blockIds)
  if (beErr) throw beErr

  const beIds = (beRows ?? []).map((r) => r.id)
  if (beIds.length === 0) {
    return { copy, amrapViews: annotateAmrapRuns(runs, []) }
  }

  const { data: logRows, error: logsErr } = await supabase
    .from("set_logs")
    .select(
      "session_id, set_number, reps_logged, duration_seconds, logged_at, exercise_name_snapshot",
    )
    .in("session_id", sessionIds)
    .in("block_exercise_id", beIds)
    .order("logged_at", { ascending: true })
  if (logsErr) throw logsErr

  const cells: AmrapScoreCell[] = (logRows ?? []).map((r) => ({
    session_id: r.session_id,
    set_number: r.set_number,
    reps_logged: r.reps_logged,
    duration_seconds: r.duration_seconds,
    logged_at: r.logged_at,
    exercise_name: r.exercise_name_snapshot,
  }))

  return { copy, amrapViews: annotateAmrapRuns(runs, cells) }
}

const EMPTY: BenchmarkCompletionHistory = {
  copy: EMPTY_COPY,
  amrapViews: [],
}

export function useBenchmarkCompletionHistory(
  open: boolean,
  catalogId: string | undefined,
) {
  const user = useAtomValue(authAtom)
  const isOnline = useOnlineStatus()

  return useQuery<BenchmarkCompletionHistory>({
    queryKey: ["benchmark-completion-history", catalogId],
    queryFn: () =>
      catalogId == null
        ? Promise.resolve(EMPTY)
        : fetchBenchmarkCompletionHistory(catalogId),
    enabled: Boolean(open && catalogId && isOnline && user),
    staleTime: 15_000,
  })
}
