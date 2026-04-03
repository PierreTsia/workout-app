import { computeEpley1RM } from "./epley"

export type PrModality = "duration" | "bodyweight_reps" | "weighted_reps"

export type ExercisePrMeta = {
  measurement_type?: "reps" | "duration" | null
  equipment?: string | null
}

export function getPrModality(meta: ExercisePrMeta): PrModality {
  if (meta.measurement_type === "duration") return "duration"
  if (meta.equipment === "bodyweight") return "bodyweight_reps"
  return "weighted_reps"
}

/** Shape of a row from `set_logs` (or queue) used for scoring. */
export type SetLogScoreInput = {
  reps_logged: string | null
  weight_logged: number | string | null
  estimated_1rm?: number | string | null
  duration_seconds?: number | null
}

export function scoreSetLogRow(
  row: SetLogScoreInput,
  modality: PrModality,
): number {
  if (modality === "duration") {
    const s = row.duration_seconds
    if (s == null) return 0
    const n = Number(s)
    return Number.isFinite(n) && n > 0 ? n : 0
  }

  if (modality === "bodyweight_reps") {
    const r = parseInt(String(row.reps_logged ?? "0"), 10)
    return Number.isFinite(r) && r > 0 ? r : 0
  }

  if (row.duration_seconds != null && Number(row.duration_seconds) > 0) {
    return 0
  }

  const repsRaw = String(row.reps_logged ?? "")
  if (!/^\d+$/.test(repsRaw)) return 0

  if (row.estimated_1rm != null && row.estimated_1rm !== "") {
    const e = Number(row.estimated_1rm)
    return Number.isFinite(e) ? e : 0
  }

  return computeEpley1RM(
    Number(row.weight_logged) || 0,
    parseInt(repsRaw, 10),
  )
}

/** Live rep-based set (about to log) — same units as `scoreSetLogRow` for reps modalities. */
export function scoreLiveRepSet(
  weightKg: number,
  reps: number,
  modality: PrModality,
): number {
  if (modality === "bodyweight_reps") {
    return Number.isFinite(reps) && reps > 0 ? reps : 0
  }
  if (modality === "weighted_reps") {
    return computeEpley1RM(weightKg, reps)
  }
  return 0
}

export function scoreLiveDurationSet(durationSeconds: number): number {
  return Number.isFinite(durationSeconds) && durationSeconds > 0
    ? durationSeconds
    : 0
}

export function isPositivePrScore(
  score: number,
  _modality: PrModality,
): boolean {
  return score > 0
}
