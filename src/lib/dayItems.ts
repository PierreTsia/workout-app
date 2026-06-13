import type {
  DayItem,
  ExerciseBlockWithExercises,
  WorkoutExerciseWithExercise,
} from "@/types/database"

/**
 * Merge a day's solo exercises and blocks into a single ordered sequence
 * (Unified Day Sequence, #351). Both sources share one `sort_order` namespace
 * per day.
 */
export function buildDayItems(
  exercises: WorkoutExerciseWithExercise[],
  blocks: ExerciseBlockWithExercises[],
): DayItem[] {
  const soloItems: DayItem[] = exercises.map((exercise) => ({
    kind: "solo",
    sort_order: exercise.sort_order,
    exercise,
  }))
  const blockItems: DayItem[] = blocks.map((block) => ({
    kind: "block",
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
