import { groupBy } from "@/lib/utils"
import type { CatalogNameSource } from "@/lib/catalogLabels"
import type {
  ExerciseBlockMode,
  ExerciseLabelFields,
  SetLogWithExercise,
} from "@/types/database"

/** `set_number` breaks ties: bulk-inserted logs can share a `logged_at`. */
const byLoggedThenSetNumber = (a: SetLogWithExercise, b: SetLogWithExercise) =>
  Date.parse(a.logged_at) - Date.parse(b.logged_at) || a.set_number - b.set_number

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
  mode: ExerciseBlockMode
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
    mode: ExerciseBlockMode
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
          mode: r.block!.mode,
        },
      ]),
  )
}

/**
 * Both history units extend {@link CatalogNameSource}: a caller renders the name
 * with `exerciseName(group)` / `exerciseName(cell)` and cannot accidentally
 * display the frozen snapshot, because no field holds a display-ready name.
 */
export interface SoloHistoryGroup extends CatalogNameSource {
  kind: "solo"
  /** `exercise_id`: the group's identity, and a language-independent React key. */
  key: string
  exercise: ExerciseLabelFields | null
  exercise_name_snapshot: string
  sets: SetLogWithExercise[]
}

export interface BlockHistoryCell extends CatalogNameSource {
  blockExerciseId: string
  exercise: ExerciseLabelFields | null
  exercise_name_snapshot: string
  emoji: string | null
  log: SetLogWithExercise
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
  mode: ExerciseBlockMode
}

export type SessionHistoryItem = SoloHistoryGroup | BlockHistoryGroup

/**
 * Splits a session's `set_logs` into circuit cards and solo groups.
 *
 * - A log is a **block** cell only when its `block_exercise_id` resolves in
 *   `metaById`. Orphaned block logs (template deleted → `ON DELETE SET NULL`,
 *   or meta not yet loaded) fall back to a flat solo group — snapshots on the
 *   row keep them coherent.
 * - Solo groups are keyed on `exercise_id` and ordered by their earliest log, so
 *   a revisited exercise stays one group and the session reads chronologically.
 *   Grouping on the name would split a renamed exercise in two, and would split
 *   every revisited one now that logs arrive in logging order. The output does
 *   not depend on the order `logs` arrives in.
 * - Block cells are grouped by their parent `block_id`, split into rounds
 *   (`set_number`), and ordered within a round by the exercise's `position`.
 * - Circuits render first (by their day `sort_order`), then solos — a solo-only
 *   session is therefore unchanged.
 */
export function groupSessionHistory(
  logs: SetLogWithExercise[],
  metaById: Map<string, BlockMeta>,
): SessionHistoryItem[] {
  const isBlockLog = (
    log: SetLogWithExercise,
  ): log is SetLogWithExercise & { block_exercise_id: string } =>
    log.block_exercise_id != null && metaById.has(log.block_exercise_id)

  const soloLogs = logs.filter((log) => !isBlockLog(log))
  const soloGroups: SoloHistoryGroup[] = [
    ...groupBy(soloLogs, (log) => log.exercise_id),
  ]
    // Sorted, not merely grouped: the result must not depend on the order the
    // caller hands over, so every group derives its position *and* its identity
    // from its earliest log rather than from whichever one arrived first.
    .map(([exerciseId, logsForExercise]) => {
      const sets = [...logsForExercise].sort(byLoggedThenSetNumber)
      return { exerciseId, sets, first: sets[0] }
    })
    .sort((a, b) => byLoggedThenSetNumber(a.first, b.first))
    .map(({ exerciseId, sets, first }) => ({
      kind: "solo" as const,
      key: exerciseId,
      exercise: first.exercise,
      exercise_name_snapshot: first.exercise_name_snapshot,
      sets,
    }))

  const blockLogs = logs.filter(isBlockLog)
  const byBlockId = blockLogs.reduce<Map<string, SetLogWithExercise[]>>((acc, log) => {
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
              exercise: log.exercise,
              exercise_name_snapshot: log.exercise_name_snapshot,
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
        mode: firstMeta.mode,
      }
    },
  )

  const sortedBlocks = [...blockGroups].sort((a, b) => a.sortOrder - b.sortOrder)
  return [...sortedBlocks, ...soloGroups]
}
