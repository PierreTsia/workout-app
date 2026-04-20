import { supabase } from "@/lib/supabase"

/**
 * Derives the cycle ID to attach to a new session.
 * Quick workouts (skipCycle) must never be linked to an active cycle.
 */
export function deriveCycleIdForSession(
  skipCycle: boolean,
  activeCycleId: string | null,
): string | null {
  return skipCycle ? null : (activeCycleId ?? null)
}

export type ResolveCycleResult =
  | { kind: "ok"; cycleId: string; source: "existing" | "created" | "adopted" }
  | { kind: "unavailable"; reason: string }

async function findOpenCycleId(
  programId: string,
  userId: string,
  stage: "lookup" | "recheck",
): Promise<{ id: string | null; error?: unknown }> {
  try {
    const { data, error } = await supabase
      .from("cycles")
      .select("id")
      .eq("program_id", programId)
      .eq("user_id", userId)
      .is("finished_at", null)
      .maybeSingle()
    if (error) {
      console.warn(`[cycle:${stage}] select failed`, error)
      return { id: null, error }
    }
    return { id: data?.id ?? null }
  } catch (e) {
    console.warn(`[cycle:${stage}] select threw`, e)
    return { id: null, error: e }
  }
}

function describeError(e: unknown): string {
  if (!e) return "unknown"
  if (typeof e === "string") return e
  if (e instanceof Error) return e.message
  if (typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message)
  }
  return "unknown"
}

/**
 * Resolves the active cycle for a program, creating one if needed.
 *
 * Why not just `insert`? The insert+select is not idempotent under flaky
 * networks: if the request reaches the DB but the response never comes back,
 * we get an orphan cycle (exists in DB, client doesn't know its id). The
 * unique partial index `one_active_cycle_per_program` then blocks all future
 * inserts with 23505. This helper self-heals by always re-querying for an
 * open cycle before giving up, so orphans are adopted on the next call.
 *
 * On `unavailable`, `reason` carries the last error message seen (select or
 * insert) so callers can surface it for diagnostics. All failures are also
 * logged here with their full error object so RLS/5xx/etc. are debuggable.
 */
export async function resolveOrCreateActiveCycle(
  programId: string,
  userId: string,
): Promise<ResolveCycleResult> {
  const existing = await findOpenCycleId(programId, userId, "lookup")
  if (existing.id) {
    return { kind: "ok", cycleId: existing.id, source: "existing" }
  }

  let insertError: unknown = undefined
  try {
    const { data, error } = await supabase
      .from("cycles")
      .insert({ program_id: programId, user_id: userId })
      .select("id")
      .single()
    if (!error && data?.id) {
      return { kind: "ok", cycleId: data.id, source: "created" }
    }
    if (error) {
      insertError = error
      console.warn("[cycle:insert] failed", error)
    }
  } catch (e) {
    insertError = e
    console.warn("[cycle:insert] threw", e)
  }

  const adopted = await findOpenCycleId(programId, userId, "recheck")
  if (adopted.id) return { kind: "ok", cycleId: adopted.id, source: "adopted" }

  const reason = describeError(insertError ?? adopted.error ?? existing.error)
  return { kind: "unavailable", reason }
}
