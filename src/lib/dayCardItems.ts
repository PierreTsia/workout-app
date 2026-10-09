/** Solo line in a library day summary. */
export interface DayExercise {
  id: string
  emoji: string
  name: string
  sets: number
  reps: string
  restSeconds: number
  sortOrder: number
  /** Catalog id — set when the line can open instructions. */
  exerciseId?: string | null
}

/** One station inside a Circuit summary. */
export interface DayCircuitStation {
  id: string
  name: string
  emoji: string
  amounts: number[]
  isDuration: boolean
  exerciseId?: string | null
}

/** Circuit line in a library day summary (#454). */
export interface DayCircuitSummary {
  id: string
  label: string | null
  rounds: number
  exerciseCount: number
  sortOrder: number
  stations?: readonly DayCircuitStation[]
}

export type DayCardItem =
  | ({ kind: "solo" } & DayExercise)
  | ({ kind: "circuit" } & DayCircuitSummary)

export type DayCardExercise = {
  id: string
  emoji_snapshot: string
  name_snapshot: string
  sets: number
  reps: string
  rest_seconds: number
  sort_order: number
  exercise_id?: string | null
}

export type DayCardBlockStation = {
  id: string
  position: number
  exercise_id?: string | null
  name_snapshot?: string | null
  emoji_snapshot?: string | null
  per_round?: ReadonlyArray<{ amount: number }>
  exercise?: { measurement_type?: "reps" | "duration" | null } | null
}

export type DayCardBlock = {
  id: string
  label: string | null
  rounds: number
  sort_order: number
  exercises: ReadonlyArray<DayCardBlockStation>
}

function stationAmounts(
  perRound: ReadonlyArray<{ amount: number }> | undefined,
): number[] {
  return (perRound ?? [])
    .map((cell) => cell.amount)
    .filter((amount) => typeof amount === "number" && Number.isFinite(amount))
}

function toCircuitStation(ex: DayCardBlockStation): DayCircuitStation | null {
  const name = ex.name_snapshot?.trim()
  if (name == null || name === "") return null
  return {
    id: ex.id,
    name,
    emoji: ex.emoji_snapshot?.trim() ?? "",
    amounts: stationAmounts(ex.per_round),
    isDuration: ex.exercise?.measurement_type === "duration",
    exerciseId: ex.exercise_id,
  }
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
    exerciseId: ex.exercise_id,
  }))
  const circuits: DayCardItem[] = blocks.map((block) => ({
    kind: "circuit",
    id: block.id,
    label: block.label,
    rounds: block.rounds,
    exerciseCount: block.exercises.length,
    sortOrder: block.sort_order,
    stations: [...block.exercises]
      .sort((a, b) => a.position - b.position)
      .map(toCircuitStation)
      .filter((station): station is DayCircuitStation => station != null),
  }))
  return [...solos, ...circuits].sort((a, b) => a.sortOrder - b.sortOrder)
}
