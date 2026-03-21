import { createServiceClient } from "./supabase.ts"

export type AIGenerationSource = "program" | "workout"

const QUOTA_WHITELISTED = 5
const QUOTA_REGULAR = 5
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

  return { allowed: totalCount < QUOTA_REGULAR }
}
