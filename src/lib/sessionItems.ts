import type {
  ExerciseBlockWithExercises,
  WorkoutExerciseWithLabel,
} from "@/types/database"

/**
 * One slot in the active-session sequence (#351). The solo variant carries only
 * the label fields of the catalog row, not the full embed the builder's
 * {@link DayItem} holds: the session works off the merged pre-session list,
 * where a swapped row is synthesised from the slim picker pool.
 */
export type SessionItem =
  | { kind: "solo"; sort_order: number; exercise: WorkoutExerciseWithLabel }
  | { kind: "block"; sort_order: number; block: ExerciseBlockWithExercises }

/**
 * Merge a day's solo exercises and blocks into a single ordered sequence so a
 * block occupies one navigable slot, exactly like an exercise. Solos sort
 * before blocks on equal `sort_order` for a stable order.
 */
export function buildSessionItems(
  exercises: WorkoutExerciseWithLabel[],
  blocks: ExerciseBlockWithExercises[],
): SessionItem[] {
  const soloItems: SessionItem[] = exercises.map((exercise) => ({
    kind: "solo",
    sort_order: exercise.sort_order,
    exercise,
  }))
  const blockItems: SessionItem[] = blocks.map((block) => ({
    kind: "block",
    sort_order: block.sort_order,
    block,
  }))
  return [...soloItems, ...blockItems]
    .map((item, i) => ({ item, i }))
    .sort((a, b) => a.item.sort_order - b.item.sort_order || a.i - b.i)
    .map(({ item }) => item)
}

/** Stable id for a session sequence slot (exercise row id or block id). */
export function sessionItemId(item: SessionItem): string {
  return item.kind === "solo" ? item.exercise.id : item.block.id
}
