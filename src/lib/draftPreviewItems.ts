/**
 * Summarize Embedded Agent draft day items for honest preview counts (T169).
 * A Circuit object counts as one item regardless of nested exercise count.
 */

export type DraftPreviewCircuitExercise =
  | { exercise_id: string; amount: number; weight_kg: number }
  | { exercise_id: string; per_round: { amount: number; weight_kg: number }[] }

export type DraftPreviewExercise =
  | string
  | {
      type: "circuit"
      label?: string
      rounds?: number
      rest_seconds?: number
      transition_seconds?: number
      exercises: DraftPreviewCircuitExercise[]
    }

export function isDraftCircuit(
  item: DraftPreviewExercise,
): item is Extract<DraftPreviewExercise, { type: "circuit" }> {
  return typeof item !== "string" && item.type === "circuit"
}

export function summarizeDraftExercises(exercises: DraftPreviewExercise[]): {
  items: number
  solos: number
  circuits: number
} {
  const circuits = exercises.filter(isDraftCircuit).length
  return {
    items: exercises.length,
    solos: exercises.length - circuits,
    circuits,
  }
}

/** One-line args-only fallback when MCP rendered lines are missing. */
export function formatDraftExerciseFallback(item: DraftPreviewExercise): string {
  if (typeof item === "string") return item
  const label = item.label?.trim() ? ` "${item.label.trim()}"` : ""
  const rounds = item.rounds ?? 3
  const nested = item.exercises.length
  return `Circuit${label} — ${rounds} rounds · ${nested} exercises`
}
