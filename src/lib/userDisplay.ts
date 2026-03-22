import type { User } from "@supabase/supabase-js"
import type { UserProfile } from "@/types/onboarding"

/**
 * Shown name: `user_profiles.display_name`, else full auth email (unique), else OAuth `full_name`.
 * Email before Google name so the default handle stays unique for social-style features.
 */
export function resolveDisplayName(
  user: User | null,
  profile: UserProfile | null | undefined,
): string {
  const custom = profile?.display_name?.trim()
  if (custom) return custom
  const email = user?.email?.trim()
  if (email) return email
  const meta = user?.user_metadata?.full_name
  if (typeof meta === "string" && meta.trim()) return meta.trim()
  return ""
}

/** Avatar image URL: custom upload wins, else OAuth picture. */
export function resolveAvatarUrl(
  user: User | null,
  profile: UserProfile | null | undefined,
): string | undefined {
  const custom = profile?.avatar_url?.trim()
  if (custom) return custom
  const o = user?.user_metadata?.avatar_url
  if (typeof o === "string" && o.trim()) return o.trim()
  return undefined
}
