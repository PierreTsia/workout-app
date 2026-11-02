/**
 * Server-side locale resolution for the MCP tools (ADR 0035). The host's language is not
 * visible here — it stays a client-only fallback (ADR 0031) — so the order is
 * explicit argument → `user_profiles.locale` seed → `en`.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.103.3"

import type { DisplayLocale } from "./displayLabels.ts"
import { asCardLocale } from "./sessionCard.ts"

export async function readProfileLocale(supabase: SupabaseClient): Promise<unknown> {
  const { data } = await supabase.from("user_profiles").select("locale").maybeSingle()
  return (data as { locale?: unknown } | null)?.locale
}

export function resolveToolLocale(
  args: Record<string, unknown>,
  profileLocale: unknown,
): DisplayLocale {
  return asCardLocale(args.locale) ?? asCardLocale(profileLocale) ?? "en"
}
