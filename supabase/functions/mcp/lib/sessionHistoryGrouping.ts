/**
 * Edge port of `src/lib/sessionHistoryGrouping.ts` (T166 / #351).
 * No `@/` imports — Deno Edge only.
 */

export interface BlockMeta {
  blockId: string
  label: string | null
  position: number
  emoji: string | null
  blockSortOrder: number
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
