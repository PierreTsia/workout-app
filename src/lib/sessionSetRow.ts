import type { Exercise, WorkoutExercise } from "@/types/database"

/** Default hold length when exercise has no explicit default (seconds). */
export const DEFAULT_DURATION_FALLBACK_SEC = 30

export type SessionSetRowReps = {
  kind: "reps"
  reps: string
  weight: string
  done: boolean
  rir?: number
}

export type SessionSetRowDuration = {
  kind: "duration"
  targetSeconds: number
  weight: string
  done: boolean
  rir?: number
  /** Wall-clock ms when countdown started; UI derives elapsed from Date.now() - timerStartedAt */
  timerStartedAt: number | null
}

export type SessionSetRow = SessionSetRowReps | SessionSetRowDuration

export function migrateSessionSetsData(
  setsData: Record<string, unknown[]>,
): Record<string, SessionSetRow[]> {
  const out: Record<string, SessionSetRow[]> = {}
  for (const [k, rows] of Object.entries(setsData)) {
    out[k] = rows.map((raw) => normalizeSessionSetRow(raw))
  }
  return out
}

/** Legacy rows from storage before `kind` existed (reps-only). */
export function normalizeSessionSetRow(raw: unknown): SessionSetRow {
  if (
    raw &&
    typeof raw === "object" &&
    "kind" in raw &&
    (raw as SessionSetRow).kind === "reps"
  ) {
    return raw as SessionSetRowReps
  }
  if (
    raw &&
    typeof raw === "object" &&
    "kind" in raw &&
    (raw as SessionSetRow).kind === "duration"
  ) {
    return raw as SessionSetRowDuration
  }
  const r = raw as {
    reps?: string
    weight?: string
    done?: boolean
    rir?: number
  }
  return {
    kind: "reps",
    reps: r.reps ?? "",
    weight: r.weight ?? "0",
    done: !!r.done,
    rir: r.rir,
  }
}

export function resolveTargetSecondsForRow(
  row: WorkoutExercise,
  lib: Exercise | undefined,
): number {
  const fromTemplate = row.target_duration_seconds
  if (fromTemplate != null && fromTemplate > 0) return fromTemplate
  const def = lib?.default_duration_seconds
  if (def != null && def > 0) return def
  return DEFAULT_DURATION_FALLBACK_SEC
}

export function buildInitialSetRowsForExercise(
  row: WorkoutExercise,
  lib: Exercise | undefined,
  displayWeight: string,
): SessionSetRow[] {
  const isDuration = lib?.measurement_type === "duration"
  if (isDuration) {
    const targetSeconds = resolveTargetSecondsForRow(row, lib)
    return Array.from({ length: row.sets }, () => ({
      kind: "duration" as const,
      targetSeconds,
      weight: displayWeight,
      done: false,
      timerStartedAt: null,
    }))
  }
  return Array.from({ length: row.sets }, () => ({
    kind: "reps" as const,
    reps: row.reps,
    weight: displayWeight,
    done: false,
  }))
}

/** Update weight on untouched sets; preserves row kind. */
export function mapRowsUpdateWeight(
  rows: SessionSetRow[],
  displayWeight: string,
): SessionSetRow[] {
  return rows.map((s) => ({ ...s, weight: displayWeight }))
}
