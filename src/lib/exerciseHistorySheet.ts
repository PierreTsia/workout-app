import { computeEpley1RM } from "@/lib/epley"

export interface ExerciseHistorySetRow {
  id: string
  set_number: number
  reps_logged: string | null
  duration_seconds: number | null
  weight_logged: number
  rir: number | null
  estimated_1rm: number | null
}

export interface ExerciseHistorySessionRow {
  session_id: string
  finished_at: string
  sets: ExerciseHistorySetRow[]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function parseSet(raw: unknown): ExerciseHistorySetRow | null {
  if (!isRecord(raw)) return null
  const id = raw.id
  const set_number = raw.set_number
  const reps_logged =
    raw.reps_logged === null || raw.reps_logged === undefined
      ? null
      : typeof raw.reps_logged === "string"
        ? raw.reps_logged
        : String(raw.reps_logged)
  const duration_raw = raw.duration_seconds
  const duration_seconds =
    duration_raw === null || duration_raw === undefined
      ? null
      : typeof duration_raw === "number"
        ? duration_raw
        : Number(duration_raw)
  const weight_logged = raw.weight_logged
  if (typeof id !== "string") return null
  if (typeof set_number !== "number") return null
  if (reps_logged === null && (duration_seconds === null || Number.isNaN(duration_seconds))) {
    return null
  }
  const w =
    typeof weight_logged === "number"
      ? weight_logged
      : typeof weight_logged === "string"
        ? Number(weight_logged)
        : NaN
  if (!Number.isFinite(w)) return null
  const rir =
    raw.rir === null || raw.rir === undefined
      ? null
      : typeof raw.rir === "number"
        ? raw.rir
        : null
  const estimated_1rm =
    raw.estimated_1rm === null || raw.estimated_1rm === undefined
      ? null
      : typeof raw.estimated_1rm === "number"
        ? raw.estimated_1rm
        : Number(raw.estimated_1rm)
  return {
    id,
    set_number,
    reps_logged,
    duration_seconds:
      duration_seconds !== null && Number.isFinite(duration_seconds)
        ? duration_seconds
        : null,
    weight_logged: w,
    rir,
    estimated_1rm:
      estimated_1rm !== null && Number.isFinite(estimated_1rm)
        ? estimated_1rm
        : null,
  }
}

function parseSession(raw: unknown): ExerciseHistorySessionRow | null {
  if (!isRecord(raw)) return null
  const session_id = raw.session_id
  const finished_at = raw.finished_at
  const setsRaw = raw.sets
  if (typeof session_id !== "string") return null
  if (typeof finished_at !== "string") return null
  if (!Array.isArray(setsRaw)) return null
  const sets: ExerciseHistorySetRow[] = []
  for (const s of setsRaw) {
    const row = parseSet(s)
    if (row) sets.push(row)
  }
  return { session_id, finished_at, sets }
}

/** Parses RPC jsonb result from get_exercise_history_for_sheet. */
export function parseExerciseHistorySheetPayload(data: unknown): ExerciseHistorySessionRow[] {
  if (!Array.isArray(data)) return []
  const out: ExerciseHistorySessionRow[] = []
  for (const row of data) {
    const s = parseSession(row)
    if (s) out.push(s)
  }
  return out
}

/** Estimated 1RM (kg) for one logged set — prefers stored value, else Epley from weight × reps. */
export function setEstimated1RmKg(set: ExerciseHistorySetRow): number {
  if (set.duration_seconds != null) return 0
  if (
    set.estimated_1rm != null &&
    Number.isFinite(set.estimated_1rm) &&
    set.estimated_1rm > 0
  ) {
    return set.estimated_1rm
  }
  const reps = parseInt(String(set.reps_logged ?? "0"), 10)
  return computeEpley1RM(set.weight_logged, reps)
}

/**
 * Best estimated 1RM (kg) per session for trend — incorporates reps via Epley (same as logging).
 * Sessions should be newest-first from API; returned series is oldest → newest.
 */
export function trendBestE1RmKgPerSessionOldestFirst(
  sessions: ExerciseHistorySessionRow[],
): number[] {
  const chronological = [...sessions].reverse()
  return chronological.map((sess) => {
    let best = 0
    for (const st of sess.sets) {
      const e = setEstimated1RmKg(st)
      if (e > best) best = e
    }
    return best
  })
}

/** Longest hold (seconds) per session for duration exercises — oldest → newest. */
export function trendBestDurationSecondsPerSessionOldestFirst(
  sessions: ExerciseHistorySessionRow[],
): number[] {
  const chronological = [...sessions].reverse()
  return chronological.map((sess) => {
    let best = 0
    for (const st of sess.sets) {
      const d = st.duration_seconds
      if (d != null && Number.isFinite(d) && d > best) best = d
    }
    return best
  })
}
