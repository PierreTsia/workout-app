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
const HOUR_MS = 60 * 60 * 1000
const LOG_TABLE = "ai_generation_log"

export interface QuotaResult {
  allowed: boolean
  limit: number
  used: number
}

// Narrow shape of the supabase-js client we actually call. Tests inject a
// fake; the real `@supabase/supabase-js` client satisfies this structurally.
export interface QuotaSupabaseLike {
  from(table: string): {
    select(columns: string): {
      eq(col: string, val: unknown): {
        eq(col: string, val: unknown): {
          gte(col: string, val: string): Promise<{ data: unknown[] | null; error: { message?: string } | null }>
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
  const { data, error } = await supabase
    .from(LOG_TABLE)
    .select("id")
    .eq("user_id", userId)
    .eq("source", "embedded_chat")
    .gte("created_at", cutoffIso)

  if (error) {
    throw new Error(`enforceTurnQuota count failed: ${error.message ?? "unknown"}`)
  }
  const used = data?.length ?? 0
  return {
    allowed: used < EMBEDDED_TURNS_PER_HOUR,
    limit: EMBEDDED_TURNS_PER_HOUR,
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
