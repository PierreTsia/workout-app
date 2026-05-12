// Embedded Agent quota helpers (Phase B of epic #295). Independent of the
// shared `_shared/aiQuota.ts` because the embedded chat enforces a per-hour
// turn cap, not the per-30d program cap, and surfaces both `used` and
// `limit` so the UI can render a meaningful retry banner.
//
// Source attribution:
//   - `embedded_chat` — every assistant turn (success or failure: log_everything)
//   - `embedded_draft` — every /draft call (success or failure)

import type { AIGenerationSource } from "../_shared/aiQuota.ts"

export const EMBEDDED_TURNS_PER_HOUR = 40
// T131 (#343) — bumped 3 → 10 to share the lane between onboarding and
// the additional-program flow. Engaged users (~6 programs/year × ~1.5
// drafts with regenerates ≈ ~9/year peak) saturated 3/24h fast; 10/24h
// leaves headroom while staying bounded. Mirror this constant in
// `_shared/aiQuota.QUOTA_REGULAR_BY_SOURCE.embedded_draft`.
export const EMBEDDED_DRAFTS_PER_24H = 10
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const LOG_TABLE = "ai_generation_log"

export interface QuotaResult {
  allowed: boolean
  limit: number
  used: number
}

// Narrow shape of the supabase-js client we actually call. Tests inject a
// fake; the real `@supabase/supabase-js` client satisfies this structurally.
//
// PR review #2: we use the count-only PostgREST mode
// (`select('id', { count: 'exact', head: true })`) to avoid streaming back
// every matching row just to call `.length`. This mirrors
// `_shared/aiQuota.checkQuota`.
export interface QuotaSupabaseLike {
  from(table: string): {
    select(
      columns: string,
      opts?: { count?: "exact"; head?: boolean },
    ): {
      eq(col: string, val: unknown): {
        eq(col: string, val: unknown): {
          gte(
            col: string,
            val: string,
          ): Promise<{ count: number | null; error: { message?: string } | null }>
        }
      }
    }
    insert(values: Record<string, unknown>): Promise<{ error: { message?: string } | null }>
  }
}

export async function enforceTurnQuota(
  supabase: QuotaSupabaseLike,
  userId: string,
  nowMs: number = Date.now(),
): Promise<QuotaResult> {
  const cutoffIso = new Date(nowMs - HOUR_MS).toISOString()
  const { count, error } = await supabase
    .from(LOG_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source", "embedded_chat")
    .gte("created_at", cutoffIso)

  if (error) {
    throw new Error(`enforceTurnQuota count failed: ${error.message ?? "unknown"}`)
  }
  const used = count ?? 0
  return {
    allowed: used < EMBEDDED_TURNS_PER_HOUR,
    limit: EMBEDDED_TURNS_PER_HOUR,
    used,
  }
}

/**
 * Same shape as `enforceTurnQuota` but for the `/draft` route: caps each
 * user at `EMBEDDED_DRAFTS_PER_24H` program drafts per rolling 24h
 * window. The cap is enforced via `ai_generation_log` rows tagged with
 * `source = 'embedded_draft'`, written by `logBillableCall` on both
 * success and failure paths (log_everything).
 */
export async function enforceDraftQuota(
  supabase: QuotaSupabaseLike,
  userId: string,
  nowMs: number = Date.now(),
): Promise<QuotaResult> {
  const cutoffIso = new Date(nowMs - DAY_MS).toISOString()
  const { count, error } = await supabase
    .from(LOG_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source", "embedded_draft")
    .gte("created_at", cutoffIso)

  if (error) {
    throw new Error(`enforceDraftQuota count failed: ${error.message ?? "unknown"}`)
  }
  const used = count ?? 0
  return {
    allowed: used < EMBEDDED_DRAFTS_PER_24H,
    limit: EMBEDDED_DRAFTS_PER_24H,
    used,
  }
}

/**
 * Persists one billable-call marker in `ai_generation_log`. Embedded Agent
 * follows the **log_everything** rule (CONTEXT.md `Embedded Agent quota`):
 * the caller invokes this on **both** model success and model failure, so
 * the user's quota cannot be bypassed by triggering provider errors.
 */
export async function logBillableCall(
  supabase: QuotaSupabaseLike,
  userId: string,
  source: Extract<AIGenerationSource, "embedded_chat" | "embedded_draft">,
): Promise<void> {
  const { error } = await supabase
    .from(LOG_TABLE)
    .insert({ user_id: userId, source })
  if (error) {
    throw new Error(`logBillableCall insert failed: ${error.message ?? "unknown"}`)
  }
}
