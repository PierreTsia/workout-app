import type { SetLog } from "@/types/database"

/**
 * Block metadata needed to render a circuit's history card, resolved per
 * `block_exercise_id`. `set_logs` only stores `block_exercise_id` (+ the
 * exercise name snapshot), so the parent block (label, ordering) and the
 * exercise's position/emoji are joined back from `block_exercises` /
 * `exercise_blocks` at read time (#351, T143).
 */
export interface BlockMeta {
  blockId: string
  label: string | null
  position: number
  emoji: string | null
  blockSortOrder: number
}

/** Raw `block_exercises` row shape returned by {@link useSessionBlockMeta}. */
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

export function buildBlockMetaMap(
  rows: BlockExerciseMetaRow[],
): Map<string, BlockMeta> {
  return new Map(
    rows
      .filter((r) => r.block != null)
      .map((r) => [
        r.id,
        {
          blockId: r.block_id,
          label: r.block!.label,
          position: r.position,
          emoji: r.emoji_snapshot,
          blockSortOrder: r.block!.sort_order,
        },
      ]),
  )
}

export interface SoloHistoryGroup {
  kind: "solo"
  key: string
  name: string
  sets: SetLog[]
}

export interface BlockHistoryCell {
  blockExerciseId: string
  name: string
  emoji: string | null
  log: SetLog
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

/**
 * Splits a session's `set_logs` into circuit cards and solo groups.
 *
 * - A log is a **block** cell only when its `block_exercise_id` resolves in
 *   `metaById`. Orphaned block logs (template deleted → `ON DELETE SET NULL`,
 *   or meta not yet loaded) fall back to a flat solo group — snapshots on the
 *   row keep them coherent.
 * - Solo groups keep the existing consecutive-name behavior (logs arrive
 *   ordered by `exercise_name_snapshot`).
 * - Block cells are grouped by their parent `block_id`, split into rounds
 *   (`set_number`), and ordered within a round by the exercise's `position`.
 * - Circuits render first (by their day `sort_order`), then solos — a solo-only
 *   session is therefore unchanged.
 */
export function groupSessionHistory(
  logs: SetLog[],
  metaById: Map<string, BlockMeta>,
): SessionHistoryItem[] {
  const isBlockLog = (log: SetLog): log is SetLog & { block_exercise_id: string } =>
    log.block_exercise_id != null && metaById.has(log.block_exercise_id)

  const soloGroups = logs
    .filter((log) => !isBlockLog(log))
    .reduce<SoloHistoryGroup[]>((groups, log) => {
      const last = groups.at(-1)
      if (last && last.name === log.exercise_name_snapshot) {
        last.sets.push(log)
        return groups
      }
      return [
        ...groups,
        {
          kind: "solo",
          key: `solo-${groups.length}-${log.exercise_name_snapshot}`,
          name: log.exercise_name_snapshot,
          sets: [log],
        },
      ]
    }, [])

  const blockLogs = logs.filter(isBlockLog)
  const byBlockId = blockLogs.reduce<Map<string, SetLog[]>>((acc, log) => {
    const { blockId } = metaById.get(log.block_exercise_id)!
    acc.set(blockId, [...(acc.get(blockId) ?? []), log])
    return acc
  }, new Map())

  const blockGroups: BlockHistoryGroup[] = [...byBlockId.entries()].map(
    ([blockId, blkLogs]) => {
      const firstMeta = metaById.get(blkLogs[0].block_exercise_id!)!
      const rounds = [...new Set(blkLogs.map((l) => l.set_number))]
        .sort((a, b) => a - b)
        .map((round) => ({
          round,
          cells: blkLogs
            .filter((l) => l.set_number === round)
            .sort(
              (a, b) =>
                metaById.get(a.block_exercise_id!)!.position -
                metaById.get(b.block_exercise_id!)!.position,
            )
            .map((log) => ({
              blockExerciseId: log.block_exercise_id!,
              name: log.exercise_name_snapshot,
              emoji: metaById.get(log.block_exercise_id!)!.emoji,
              log,
            })),
        }))
      return {
        kind: "block",
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
