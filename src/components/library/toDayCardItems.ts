import type { DayCardItem } from "@/components/library/DayCard"

export type DayCardExercise = {
  id: string
  emoji_snapshot: string
  name_snapshot: string
  sets: number
  reps: string
  rest_seconds: number
  sort_order: number
}

export type DayCardBlock = {
  id: string
  label: string | null
  rounds: number
  sort_order: number
  exercises: ReadonlyArray<{ id: string; position: number }>
}

export function toDayCardItems(
  exercises: readonly DayCardExercise[],
  blocks: readonly DayCardBlock[],
): DayCardItem[] {
  const solos: DayCardItem[] = exercises.map((ex) => ({
    kind: "solo",
    id: ex.id,
    emoji: ex.emoji_snapshot,
    name: ex.name_snapshot,
    sets: ex.sets,
    reps: ex.reps,
    restSeconds: ex.rest_seconds,
    sortOrder: ex.sort_order,
  }))
  const circuits: DayCardItem[] = blocks.map((block) => ({
    kind: "circuit",
    id: block.id,
    label: block.label,
    rounds: block.rounds,
    exerciseCount: block.exercises.length,
    sortOrder: block.sort_order,
  }))
  return [...solos, ...circuits].sort((a, b) => a.sortOrder - b.sortOrder)
}
