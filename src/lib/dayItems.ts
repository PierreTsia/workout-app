import { arrayMove } from "@dnd-kit/sortable"
import type { DayItem, ExerciseBlockWithExercises } from "@/types/database"

/**
 * Merge a day's solo exercises and blocks into a single ordered sequence
 * (Unified Day Sequence, #351). Both sources share one `sort_order` namespace
 * per day.
 */
export function buildDayItems<E extends { sort_order: number }>(
  exercises: E[],
  blocks: ExerciseBlockWithExercises[],
): Array<
  | { kind: "solo"; sort_order: number; exercise: E }
  | { kind: "block"; sort_order: number; block: ExerciseBlockWithExercises }
> {
  const soloItems = exercises.map((exercise) => ({
    kind: "solo" as const,
    sort_order: exercise.sort_order,
    exercise,
  }))
  const blockItems = blocks.map((block) => ({
    kind: "block" as const,
    sort_order: block.sort_order,
    block: {
      ...block,
      exercises: [...block.exercises].sort((a, b) => a.position - b.position),
    },
  }))
  return [...soloItems, ...blockItems].sort(
    (a, b) => a.sort_order - b.sort_order,
  )
}

/** Stable DnD id for an item in the Unified Day Sequence. */
export function dayItemId(item: DayItem): string {
  return item.kind === "solo" ? item.exercise.id : item.block.id
}

/** Sort-order updates for a unified reorder, split by source table. */
export interface DayItemReorder {
  solos: { id: string; sort_order: number }[]
  blocks: { id: string; sort_order: number }[]
}

/**
 * Move `activeId` to `overId`'s slot and reindex `0..n-1` on both the item
 * and its nested row. Same-array return means the ids were not found or
 * already sit on the same slot — callers can skip the persist.
 */
export function moveDayItems(
  items: DayItem[],
  activeId: string,
  overId: string,
): DayItem[] {
  const oldIndex = items.findIndex((i) => dayItemId(i) === activeId)
  const newIndex = items.findIndex((i) => dayItemId(i) === overId)
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return items

  return arrayMove(items, oldIndex, newIndex).map((item, sort_order) =>
    item.kind === "solo"
      ? { ...item, sort_order, exercise: { ...item.exercise, sort_order } }
      : { ...item, sort_order, block: { ...item.block, sort_order } },
  )
}

export function dayItemSortUpdates(items: readonly DayItem[]): DayItemReorder {
  const indexed = items.map((item, sort_order) => ({ item, sort_order }))
  return {
    solos: indexed
      .filter(({ item }) => item.kind === "solo")
      .map(({ item, sort_order }) => ({
        id: dayItemId(item),
        sort_order,
      })),
    blocks: indexed
      .filter(({ item }) => item.kind === "block")
      .map(({ item, sort_order }) => ({
        id: dayItemId(item),
        sort_order,
      })),
  }
}

/**
 * Move `activeId` to `overId`'s slot within the merged sequence, then reindex
 * the whole day `0..n-1`. Returns the new `sort_order` for solos and blocks
 * separately so each can be persisted to its own table (#351, T140).
 */
export function reorderDayItems(
  items: DayItem[],
  activeId: string,
  overId: string,
): DayItemReorder {
  const next = moveDayItems(items, activeId, overId)
  if (next === items) return { solos: [], blocks: [] }
  return dayItemSortUpdates(next)
}

/** Apply a reorder payload onto cached rows without waiting for a refetch. */
export function applySortOrders<T extends { id: string; sort_order: number }>(
  rows: readonly T[],
  updates: readonly { id: string; sort_order: number }[],
): T[] {
  const nextOrder = new Map(updates.map((row) => [row.id, row.sort_order]))
  return rows.map((row) => {
    const sort_order = nextOrder.get(row.id)
    return sort_order === undefined ? row : { ...row, sort_order }
  })
}
