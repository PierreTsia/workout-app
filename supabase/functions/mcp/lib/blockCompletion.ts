/**
 * Edge port of `src/lib/blockCompletionHistory.ts` (ADR 0008). Circuit completion
 * time is wall-clock between the first and last logged cell of a run; pauses are
 * included by design. No schema, no writeback.
 */

export interface CompletionCell {
  block_exercise_id: string
  set_number: number
  reps_logged: string | null
  duration_seconds: number | null
  weight_logged: number
  logged_at: string
}

/** Wall-clock seconds between the first and last logged cell of a run. */
export function runCompletionSeconds(cells: CompletionCell[]): number {
  const times = cells.map((c) => new Date(c.logged_at).getTime())
  return Math.round((Math.max(...times) - Math.min(...times)) / 1000)
}

/**
 * A run "counts" only when it forms a full rectangle: contiguous rounds `1..R`,
 * each round logging exactly the same set of exercise slots.
 */
export function isRunComplete(cells: CompletionCell[]): boolean {
  if (cells.length === 0) return false
  const rounds = [...new Set(cells.map((c) => c.set_number))].sort((a, b) => a - b)
  const contiguousFromOne = rounds.every((round, i) => round === i + 1)
  if (!contiguousFromOne) return false
  const slotsPerRound = new Set(cells.map((c) => c.block_exercise_id)).size
  return rounds.every((round) => {
    const slots = cells.filter((c) => c.set_number === round).map((c) => c.block_exercise_id)
    return slots.length === slotsPerRound && new Set(slots).size === slotsPerRound
  })
}
