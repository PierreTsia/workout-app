import { createServiceClient } from "./supabase.ts"

export type AIGenerationSource =
  | "program"
  | "workout"
  | "embedded_chat"
  | "embedded_draft"
  | "quick_workout"

const QUOTA_WHITELISTED = 5

/**
 * Per-source regular cap, evaluated over the rolling 30-day window. Replaces
 * the old single `QUOTA_REGULAR = 5` constant when epic #342 introduced an
 * independent budget for the Quick Workout flow.
 *
 * - `program` (5/30) and `workout` (5/30) keep their historical caps so
 *   `generate-program` and the legacy `generate-workout` ship unchanged.
 * - `quick_workout` (10/30) gets a higher cap because it's a smaller call
 *   (single day instead of a multi-day program) and a more frequent action.
 * - `embedded_chat` (40) and `embedded_draft` (10) are listed for
 *   completeness — those quotas are enforced by `embedded-agent/quota.ts`,
 *   not via `checkQuota`. Keeping them here makes the cap surface
 *   exhaustive over `AIGenerationSource` so the type checker flags any
 *   future source that forgets to declare a cap.
 *
 * `embedded_draft` was bumped 3 → 10 in T131 (#343) — when both the
 * onboarding AND the additional-program flow share the cap, an engaged
 * user creates ~6 programs/year × ~1.5 drafts each (with regenerates)
 * ≈ ~9/year peak demand. 3/24h saturates fast for repeat creators;
 * 10/24h leaves headroom while staying bounded. See ADR 0003.
 */
export const QUOTA_REGULAR_BY_SOURCE: Record<AIGenerationSource, number> = {
  program: 5,
  workout: 5,
  embedded_chat: 40,
  embedded_draft: 10,
  quick_workout: 10,
}

const WINDOW_WHITELISTED_MS = 24 * 60 * 60 * 1000
const WINDOW_REGULAR_MS = 30 * 24 * 60 * 60 * 1000

export interface JwtPayload {
  sub: string
  email?: string
}

function base64UrlDecode(input: string): string {
  let b64 = input.replace(/-/g, "+").replace(/_/g, "/")
  while (b64.length % 4 !== 0) b64 += "="
  return atob(b64)
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const raw: unknown = JSON.parse(base64UrlDecode(parts[1]))
    if (typeof raw !== "object" || raw === null) return null
    if (!("sub" in raw)) return null
    const sub = raw.sub
    if (typeof sub !== "string") return null
    let email: string | undefined
    if ("email" in raw && typeof raw.email === "string") email = raw.email
    return { sub, email }
  } catch {
    return null
  }
}

type ServiceClient = ReturnType<typeof createServiceClient>

export async function checkQuota(
  supabase: ServiceClient,
  userId: string,
  email: string | null,
  source: AIGenerationSource,
): Promise<{ allowed: boolean }> {
  const [whitelistResult, countResult] = await Promise.all([
    email
      ? supabase
          .from("ai_whitelisted_users")
          .select("email")
          .eq("email", email)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("ai_generation_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("source", source)
      .gte("created_at", new Date(Date.now() - WINDOW_REGULAR_MS).toISOString()),
  ])

  const isWhitelisted = !!whitelistResult.data
  const totalCount = countResult.count ?? 0

  if (isWhitelisted) {
    const { count: recentCount } = await supabase
      .from("ai_generation_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("source", source)
      .gte("created_at", new Date(Date.now() - WINDOW_WHITELISTED_MS).toISOString())

    return { allowed: (recentCount ?? 0) < QUOTA_WHITELISTED }
  }

  return { allowed: totalCount < QUOTA_REGULAR_BY_SOURCE[source] }
}
