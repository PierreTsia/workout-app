import type { SetLog, WorkoutExercise } from "@/types/database"

export interface ExercisePreviewItem {
  id: string
  emoji: string
  name: string
  sets: number
  reps: string
  maxWeight: number
}

/**
 * Builds preview items from actual session logs, using the template exercises
 * for emoji and sort order (which set_logs don't carry).
 * Exercises that appear in logs but not in the template are appended at the end.
 */
export function summarizeSessionLogs(
  logs: SetLog[],
  templateExercises: WorkoutExercise[],
): ExercisePreviewItem[] {
  const grouped = new Map<
    string,
    { name: string; reps: string[]; maxWeight: number }
  >()

  for (const log of logs) {
    let entry = grouped.get(log.exercise_id)
    if (!entry) {
      entry = { name: log.exercise_name_snapshot, reps: [], maxWeight: 0 }
      grouped.set(log.exercise_id, entry)
    }
    entry.reps.push(log.reps_logged)
    if (log.weight_logged > entry.maxWeight) {
      entry.maxWeight = log.weight_logged
    }
  }

  const emojiByExerciseId = new Map<string, string>()
  const orderByExerciseId = new Map<string, number>()
  for (const ex of templateExercises) {
    emojiByExerciseId.set(ex.exercise_id, ex.emoji_snapshot)
    orderByExerciseId.set(ex.exercise_id, ex.sort_order)
  }

  const items: ExercisePreviewItem[] = []
  for (const [exerciseId, entry] of grouped) {
    const uniqueReps = [...new Set(entry.reps)]
    const repsLabel =
      uniqueReps.length === 1
        ? uniqueReps[0]
        : `${Math.min(...uniqueReps.map(Number))}–${Math.max(...uniqueReps.map(Number))}`

    items.push({
      id: exerciseId,
      emoji: emojiByExerciseId.get(exerciseId) ?? "🏋️",
      name: entry.name,
      sets: entry.reps.length,
      reps: repsLabel,
      maxWeight: entry.maxWeight,
    })
  }

  items.sort(
    (a, b) =>
      (orderByExerciseId.get(a.id) ?? Infinity) -
      (orderByExerciseId.get(b.id) ?? Infinity),
  )

  return items
}

/** Converts template exercises into the same preview shape. */
export function templateToPreviewItems(
  exercises: WorkoutExercise[],
): ExercisePreviewItem[] {
  return exercises.map((ex) => ({
    id: ex.id,
    emoji: ex.emoji_snapshot,
    name: ex.name_snapshot,
    sets: ex.sets,
    reps: ex.reps,
    maxWeight: Number(ex.weight),
  }))
}
