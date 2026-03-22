import type { User } from "@supabase/supabase-js"
import type { UserProfile } from "@/types/onboarding"

/** Shown name: custom `user_profiles.display_name`, else OAuth `full_name`, else email local-part. */
export function resolveDisplayName(
  user: User | null,
  profile: UserProfile | null | undefined,
): string {
  const custom = profile?.display_name?.trim()
  if (custom) return custom
  const meta = user?.user_metadata?.full_name
  if (typeof meta === "string" && meta.trim()) return meta.trim()
  const email = user?.email
  if (email) return email.split("@")[0] ?? email
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
