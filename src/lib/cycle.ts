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
  | { kind: "unavailable" }

async function findOpenCycleId(
  programId: string,
  userId: string,
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("cycles")
      .select("id")
      .eq("program_id", programId)
      .eq("user_id", userId)
      .is("finished_at", null)
      .maybeSingle()
    return data?.id ?? null
  } catch {
    return null
  }
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
 */
export async function resolveOrCreateActiveCycle(
  programId: string,
  userId: string,
): Promise<ResolveCycleResult> {
  const existing = await findOpenCycleId(programId, userId)
  if (existing) return { kind: "ok", cycleId: existing, source: "existing" }

  try {
    const { data, error } = await supabase
      .from("cycles")
      .insert({ program_id: programId, user_id: userId })
      .select("id")
      .single()
    if (!error && data?.id) {
      return { kind: "ok", cycleId: data.id, source: "created" }
    }
  } catch {
    // Network blip or aborted request — fall through to self-heal.
  }

  const adopted = await findOpenCycleId(programId, userId)
  if (adopted) return { kind: "ok", cycleId: adopted, source: "adopted" }

  return { kind: "unavailable" }
}
