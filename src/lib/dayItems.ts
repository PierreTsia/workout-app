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
 * Move `activeId` to `overId`'s slot within the merged sequence, then reindex
 * the whole day `0..n-1`. Returns the new `sort_order` for solos and blocks
 * separately so each can be persisted to its own table (#351, T140).
 */
export function reorderDayItems(
  items: DayItem[],
  activeId: string,
  overId: string,
): DayItemReorder {
  const oldIndex = items.findIndex((i) => dayItemId(i) === activeId)
  const newIndex = items.findIndex((i) => dayItemId(i) === overId)
  if (oldIndex === -1 || newIndex === -1) return { solos: [], blocks: [] }

  const reindexed = arrayMove(items, oldIndex, newIndex).map(
    (item, sort_order) => ({ item, sort_order }),
  )

  const solos = reindexed
    .filter(({ item }) => item.kind === "solo")
    .map(({ item, sort_order }) => ({
      id: dayItemId(item),
      sort_order,
    }))
  const blocks = reindexed
    .filter(({ item }) => item.kind === "block")
    .map(({ item, sort_order }) => ({
      id: dayItemId(item),
      sort_order,
    }))

  return { solos, blocks }
}
