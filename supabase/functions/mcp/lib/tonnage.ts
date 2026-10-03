/**
 * Edge port of the tonnage math in `src/lib/profile/tonnage.ts`.
 * No `@/` imports — Deno Edge only. Loaded iron only: bodyweight at 0 kg and
 * duration holds are out (glossary **Tonnage**).
 */

export interface TonnageSet {
  reps_logged: string | null
  duration_seconds: number | null
  weight_logged: number
}

function numericReps(reps: string | null): number | null {
  if (reps == null) return null
  const trimmed = reps.trim()
  if (trimmed === "") return null
  const n = Number(trimmed)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function loadedSetKg(set: TonnageSet): number {
  if (set.weight_logged <= 0) return 0
  if (set.duration_seconds != null) return 0
  const reps = numericReps(set.reps_logged)
  if (reps == null) return 0
  return set.weight_logged * reps
}

/** Total loaded kg for one session: `Σ weight_logged × reps` over its loaded sets. */
export function sessionTonnageKg(sets: TonnageSet[]): number {
  return sets.reduce((sum, set) => sum + loadedSetKg(set), 0)
}
