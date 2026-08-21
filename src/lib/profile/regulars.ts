export type RegularEvolution =
  | { kind: "weight"; kg: number }
  | { kind: "reps"; n: number }

export type RegularRow = {
  name: string
  evolution: RegularEvolution
  /** Total numeric reps over the 100d Regulars window. Null = duration-only. */
  reps: number | null
}

export function rankRegulars<T extends { reps: number | null }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => {
    if (a.reps == null && b.reps == null) return 0
    if (a.reps == null) return 1
    if (b.reps == null) return -1
    return b.reps - a.reps
  })
}

/** Unsorted on purpose — the block ranks by `reps`. Mix of kg and reps evolutions. */
export const PIERRE_REGULARS: readonly RegularRow[] = [
  { name: "Walking lunge", evolution: { kind: "reps", n: 2 }, reps: 80 },
  { name: "Squat", evolution: { kind: "weight", kg: 2 }, reps: 320 },
  { name: "Hip thrust", evolution: { kind: "weight", kg: 5 }, reps: 160 },
  { name: "Pull-up", evolution: { kind: "reps", n: 2 }, reps: 400 },
  { name: "Overhead press", evolution: { kind: "weight", kg: 2 }, reps: 120 },
  { name: "Deadlift", evolution: { kind: "weight", kg: -2 }, reps: 200 },
  { name: "Bench press", evolution: { kind: "weight", kg: 2.5 }, reps: 240 },
  { name: "Row", evolution: { kind: "weight", kg: 2 }, reps: 280 },
]
