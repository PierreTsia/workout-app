/**
 * Edge port of `src/lib/sessionHistoryGrouping.ts` (T166 / #351).
 * No `@/` imports — Deno Edge only.
 */

import {
  amrapScore,
  annotateAmrapRuns,
  type AmrapRunView,
  type AmrapScoreCell,
  type AmrapScoreValue,
} from "./amrapScore.ts"

export interface BlockMeta {
  blockId: string
  label: string | null
  position: number
  emoji: string | null
  blockSortOrder: number
  mode: "rounds" | "amrap"
}

export interface BlockExerciseMetaRow {
  id: string
  block_id: string
  emoji_snapshot: string | null
  position: number
  block: {
    id: string
    label: string | null
    rounds: number
    sort_order: number
    mode?: "rounds" | "amrap"
  } | null
}

/** Minimal set_log fields needed for MCP history grouping + formatting. */
export interface HistorySetLog {
  id: string
  exercise_id: string
  block_exercise_id: string | null
  exercise_name_snapshot: string
  set_number: number
  reps_logged: string | null
  duration_seconds: number | null
  weight_logged: number
  was_pr: boolean
  logged_at: string
}

export interface SoloHistoryGroup {
  kind: "solo"
  key: string
  exercise_name_snapshot: string
  sets: HistorySetLog[]
}

export interface BlockHistoryCell {
  blockExerciseId: string
  exercise_name_snapshot: string
  emoji: string | null
  log: HistorySetLog
}

export interface BlockHistoryRound {
  round: number
  cells: BlockHistoryCell[]
}

export interface BlockHistoryGroup {
  kind: "block"
  key: string
  label: string | null
  sortOrder: number
  rounds: BlockHistoryRound[]
  exerciseCount: number
  /** Finished AMRAP only — T188. Absent / null for Tours and unfinished runs. */
  amrapScore?: AmrapScoreValue | null
  /** PB / delta from {@link annotateHistoryAmrap}, scoped to the catalog key. */
  isPb?: boolean
  deltaRounds?: number | null
}

export type SessionHistoryItem = SoloHistoryGroup | BlockHistoryGroup

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  return items.reduce((map, item) => {
    const key = keyFn(item)
    const list = map.get(key) ?? []
    return map.set(key, [...list, item])
  }, new Map<K, T[]>())
}

const byLoggedThenSetNumber = (a: HistorySetLog, b: HistorySetLog) =>
  Date.parse(a.logged_at) - Date.parse(b.logged_at) || a.set_number - b.set_number

export function buildBlockMetaMap(
  rows: BlockExerciseMetaRow[],
): Map<string, BlockMeta> {
  return new Map(
    rows
      .filter((r) => r.block != null)
      .map((r) => {
        const block = r.block
        if (!block) throw new Error("unreachable: filtered non-null block")
        return [
          r.id,
          {
            blockId: r.block_id,
            label: block.label,
            position: r.position,
            emoji: r.emoji_snapshot,
            blockSortOrder: block.sort_order,
            mode: block.mode ?? "rounds",
          },
        ] as const
      }),
  )
}

/**
 * Splits a session's set_logs into Circuit cards and solo groups.
 * Circuits first (by day sort_order), then solos — solo-only unchanged.
 * Orphan `block_exercise_id` (missing meta) falls back to solo.
 */
export function groupSessionHistory(
  logs: HistorySetLog[],
  metaById: Map<string, BlockMeta>,
): SessionHistoryItem[] {
  const isBlockLog = (
    log: HistorySetLog,
  ): log is HistorySetLog & { block_exercise_id: string } =>
    log.block_exercise_id != null && metaById.has(log.block_exercise_id)

  const soloGroups: SoloHistoryGroup[] = [...groupBy(logs.filter((log) => !isBlockLog(log)), (log) => log.exercise_id)]
    .map(([exerciseId, logsForExercise]) => {
      const sets = [...logsForExercise].sort(byLoggedThenSetNumber)
      return { exerciseId, sets, first: sets[0] }
    })
    .sort((a, b) => byLoggedThenSetNumber(a.first, b.first))
    .map(({ exerciseId, sets, first }) => ({
      kind: "solo" as const,
      key: exerciseId,
      exercise_name_snapshot: first.exercise_name_snapshot,
      sets,
    }))

  const blockLogs = logs.filter(isBlockLog)
  const byBlockId = blockLogs.reduce<Map<string, HistorySetLog[]>>((acc, log) => {
    const meta = metaById.get(log.block_exercise_id)
    if (!meta) return acc
    return acc.set(meta.blockId, [...(acc.get(meta.blockId) ?? []), log])
  }, new Map())

  const blockGroups: BlockHistoryGroup[] = [...byBlockId.entries()].map(
    ([blockId, blkLogs]) => {
      const firstBeId = blkLogs[0].block_exercise_id
      const firstMeta = firstBeId ? metaById.get(firstBeId) : undefined
      if (!firstMeta) {
        throw new Error(`groupSessionHistory: missing meta for block ${blockId}`)
      }
      const rounds = [...new Set(blkLogs.map((l) => l.set_number))]
        .sort((a, b) => a - b)
        .map((round) => ({
          round,
          cells: blkLogs
            .filter((l) => l.set_number === round)
            .sort((a, b) => {
              const posA = metaById.get(a.block_exercise_id ?? "")?.position ?? 0
              const posB = metaById.get(b.block_exercise_id ?? "")?.position ?? 0
              return posA - posB
            })
            .map((log) => ({
              blockExerciseId: log.block_exercise_id ?? "",
              exercise_name_snapshot: log.exercise_name_snapshot,
              emoji: metaById.get(log.block_exercise_id ?? "")?.emoji ?? null,
              log,
            })),
        }))
      return {
        kind: "block" as const,
        key: blockId,
        label: firstMeta.label,
        sortOrder: firstMeta.blockSortOrder,
        rounds,
        exerciseCount: new Set(blkLogs.map((l) => l.block_exercise_id)).size,
      }
    },
  )

  const sortedBlocks = [...blockGroups].sort((a, b) => a.sortOrder - b.sortOrder)
  return [...sortedBlocks, ...soloGroups]
}

export interface HistoryBlockRun {
  session_id: string
  block_id: string
  finished_at: string | null
  mode: "rounds" | "amrap"
  /** GO snapshot — catalog identity. Null / omitted = jetable. */
  benchmark_circuit_id?: string | null
  started_at?: string
  template_fingerprint?: string
}

/** Catalog id when the GO snapshot is set, else the day-scoped block_id. */
export function historyGroupKey(
  run: Pick<HistoryBlockRun, "block_id" | "benchmark_circuit_id">,
): string {
  return run.benchmark_circuit_id ?? run.block_id
}

/**
 * PB / delta via existing `annotateAmrapRuns`, scoped to {@link historyGroupKey}
 * so two Cindy days share a PB and two jetable AMRAPs do not.
 */
export function annotateHistoryAmrap(
  runs: HistoryBlockRun[],
  cells: AmrapScoreCell[],
): AmrapRunView[] {
  return [...groupBy(runs, historyGroupKey).values()].flatMap((group) =>
    annotateAmrapRuns(
      group.map((run) => ({
        session_id: run.session_id,
        started_at: run.started_at ?? "",
        finished_at: run.finished_at,
        template_fingerprint: run.template_fingerprint ?? run.block_id,
      })),
      cells,
    ),
  )
}

function cellsFromGroup(
  sessionId: string,
  group: BlockHistoryGroup,
): AmrapScoreCell[] {
  return group.rounds.flatMap((round) =>
    round.cells.map((cell) => ({
      session_id: sessionId,
      set_number: cell.log.set_number,
      reps_logged: cell.log.reps_logged,
      duration_seconds: cell.log.duration_seconds,
      logged_at: cell.log.logged_at,
      exercise_name: cell.exercise_name_snapshot,
    })),
  )
}

export interface SessionHistoryBundle {
  sessionId: string
  items: SessionHistoryItem[]
}

/**
 * Cross-session attach: score each Circuit, then stamp PB / delta from
 * {@link annotateHistoryAmrap} so two Cindy days share one catalog PB.
 */
export function attachAmrapHistory(
  sessions: SessionHistoryBundle[],
  runs: HistoryBlockRun[],
): SessionHistoryBundle[] {
  const cells = sessions.flatMap(({ sessionId, items }) =>
    items.flatMap((item) =>
      item.kind === "block" ? cellsFromGroup(sessionId, item) : [],
    ),
  )
  const views = annotateHistoryAmrap(runs, cells)
  const runBySessionBlock = new Map(
    runs.map((run) => [`${run.session_id}:${run.block_id}`, run] as const),
  )
  const viewBySessionFingerprint = new Map(
    views.map((view) => [`${view.sessionId}:${view.fingerprint}`, view] as const),
  )
  return sessions.map(({ sessionId, items }) => ({
    sessionId,
    items: attachAmrapScores(items, runs, sessionId).map((item) => {
      if (item.kind !== "block") return item
      const run = runBySessionBlock.get(`${sessionId}:${item.key}`)
      if (run == null) return item
      const view = viewBySessionFingerprint.get(
        `${sessionId}:${run.template_fingerprint ?? run.block_id}`,
      )
      if (view == null) return item
      return { ...item, isPb: view.isPb, deltaRounds: view.deltaRounds }
    }),
  }))
}

/**
 * Attach a finished AMRAP score onto each matching Circuit. Tours have no
 * `block_runs` row, so they stay untouched (no CCT on the MCP wire).
 */
export function attachAmrapScores(
  items: SessionHistoryItem[],
  runs: HistoryBlockRun[],
  sessionId: string,
): SessionHistoryItem[] {
  const runByBlockId = new Map(
    runs
      .filter((run) => run.session_id === sessionId && run.mode === "amrap")
      .map((run) => [run.block_id, run] as const),
  )
  return items.map((item) => {
    if (item.kind !== "block") return item
    const run = runByBlockId.get(item.key)
    if (run == null) return item
    return {
      ...item,
      amrapScore: amrapScore(run, cellsFromGroup(sessionId, item)),
    }
  })
}
