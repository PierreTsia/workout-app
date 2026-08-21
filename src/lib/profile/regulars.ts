import type { ProfileWindowKind } from "@/lib/profile/window"

export type RegularEvolution =
  | { kind: "weight"; kg: number }
  | { kind: "reps"; n: number }

export type RegularRow = {
  name: string
  evolution: RegularEvolution
  /** Total numeric reps in the selected window. Null = duration-only. */
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

const BY_KIND: Record<ProfileWindowKind, readonly RegularRow[]> = {
  "7": [
    { name: "Squat", evolution: { kind: "weight", kg: 2 }, reps: 48 },
    { name: "Bench press", evolution: { kind: "weight", kg: 2.5 }, reps: 40 },
    { name: "Pull-up", evolution: { kind: "reps", n: 1 }, reps: 36 },
    { name: "Row", evolution: { kind: "weight", kg: 2 }, reps: 32 },
    { name: "Deadlift", evolution: { kind: "weight", kg: -2 }, reps: 20 },
  ],
  "30": [
    { name: "Pull-up", evolution: { kind: "reps", n: 2 }, reps: 140 },
    { name: "Row", evolution: { kind: "weight", kg: 2 }, reps: 110 },
    { name: "Squat", evolution: { kind: "weight", kg: 2 }, reps: 108 },
    { name: "Bench press", evolution: { kind: "weight", kg: 2.5 }, reps: 90 },
    { name: "Deadlift", evolution: { kind: "weight", kg: -2 }, reps: 72 },
    { name: "Hip thrust", evolution: { kind: "weight", kg: 5 }, reps: 56 },
    { name: "Overhead press", evolution: { kind: "weight", kg: 2 }, reps: 44 },
  ],
  "100": [
    { name: "Walking lunge", evolution: { kind: "reps", n: 2 }, reps: 80 },
    { name: "Squat", evolution: { kind: "weight", kg: 2 }, reps: 320 },
    { name: "Hip thrust", evolution: { kind: "weight", kg: 5 }, reps: 160 },
    { name: "Pull-up", evolution: { kind: "reps", n: 2 }, reps: 400 },
    { name: "Overhead press", evolution: { kind: "weight", kg: 2 }, reps: 120 },
    { name: "Deadlift", evolution: { kind: "weight", kg: -2 }, reps: 200 },
    { name: "Bench press", evolution: { kind: "weight", kg: 2.5 }, reps: 240 },
    { name: "Row", evolution: { kind: "weight", kg: 2 }, reps: 280 },
  ],
  "365": [
    { name: "Walking lunge", evolution: { kind: "reps", n: 4 }, reps: 220 },
    { name: "Squat", evolution: { kind: "weight", kg: 10 }, reps: 800 },
    { name: "Hip thrust", evolution: { kind: "weight", kg: 10 }, reps: 400 },
    { name: "Pull-up", evolution: { kind: "reps", n: 6 }, reps: 980 },
    { name: "Overhead press", evolution: { kind: "weight", kg: 5 }, reps: 300 },
    { name: "Deadlift", evolution: { kind: "weight", kg: 5 }, reps: 510 },
    { name: "Bench press", evolution: { kind: "weight", kg: 7.5 }, reps: 620 },
    { name: "Row", evolution: { kind: "weight", kg: 5 }, reps: 720 },
  ],
  all: [
    { name: "Walking lunge", evolution: { kind: "reps", n: 6 }, reps: 360 },
    { name: "Squat", evolution: { kind: "weight", kg: 15 }, reps: 1240 },
    { name: "Hip thrust", evolution: { kind: "weight", kg: 15 }, reps: 640 },
    { name: "Pull-up", evolution: { kind: "reps", n: 10 }, reps: 1520 },
    { name: "Overhead press", evolution: { kind: "weight", kg: 7.5 }, reps: 480 },
    { name: "Deadlift", evolution: { kind: "weight", kg: 10 }, reps: 820 },
    { name: "Bench press", evolution: { kind: "weight", kg: 10 }, reps: 980 },
    { name: "Row", evolution: { kind: "weight", kg: 7.5 }, reps: 1100 },
  ],
}

export function pierreRegulars(kind: ProfileWindowKind): readonly RegularRow[] {
  return BY_KIND[kind]
}
