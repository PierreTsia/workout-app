import type { ProfileSnapshot, SessionFact, SetFact } from "@/lib/profile/types"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function asNullableString(value: unknown): string | null {
  if (value === null) return null
  return asString(value)
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asNullableNumber(value: unknown): number | null | undefined {
  if (value === null) return null
  if (value === undefined) return undefined
  return asFiniteNumber(value)
}

function parseSession(raw: unknown): SessionFact | null {
  if (!isRecord(raw)) return null
  const id = asString(raw.id)
  const started_at = asString(raw.started_at)
  const finished_at = asString(raw.finished_at)
  const program_id = asNullableString(raw.program_id)
  const has_catalog_circuit = asBoolean(raw.has_catalog_circuit)
  const active_duration_ms = asNullableNumber(raw.active_duration_ms)
  if (id == null || started_at == null || finished_at == null) return null
  if (has_catalog_circuit == null) return null
  if (active_duration_ms === undefined) return null
  return {
    id,
    started_at,
    finished_at,
    active_duration_ms,
    program_id,
    has_catalog_circuit,
  }
}

function parseSet(raw: unknown): SetFact | null {
  if (!isRecord(raw)) return null
  const session_id = asString(raw.session_id)
  const exercise_id = asString(raw.exercise_id)
  const was_pr = asBoolean(raw.was_pr)
  const rir = asNullableNumber(raw.rir)
  const weight_logged = asFiniteNumber(raw.weight_logged)
  const reps = asNullableString(raw.reps)
  const duration_seconds = asNullableNumber(raw.duration_seconds)
  const block_exercise_id = asNullableString(raw.block_exercise_id)
  if (session_id == null || exercise_id == null || was_pr == null) return null
  if (weight_logged == null) return null
  if (rir === undefined || duration_seconds === undefined) return null
  return {
    session_id,
    exercise_id,
    was_pr,
    rir,
    weight_logged,
    reps,
    duration_seconds,
    block_exercise_id,
  }
}

export function parseProfileSnapshot(data: unknown): ProfileSnapshot {
  if (!isRecord(data)) {
    throw new Error("get_profile_snapshot: expected { sessions, sets }")
  }
  if (!Array.isArray(data.sessions) || !Array.isArray(data.sets)) {
    throw new Error("get_profile_snapshot: expected { sessions, sets }")
  }
  return {
    sessions: data.sessions
      .map(parseSession)
      .filter((session): session is SessionFact => session != null),
    sets: data.sets.map(parseSet).filter((set): set is SetFact => set != null),
  }
}
