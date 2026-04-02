import { describe, it, expect } from "vitest"
import type { User } from "@supabase/supabase-js"
import { resolveAvatarUrl, resolveDisplayName } from "./userDisplay"
import type { UserProfile } from "@/types/onboarding"

function user(over: Partial<User> & { user_metadata?: Record<string, string> }): User {
  return {
    id: "u1",
    aud: "a",
    role: "authenticated",
    email: "jane@example.com",
    email_confirmed_at: "",
    phone: "",
    confirmed_at: "",
    last_sign_in_at: "",
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: "",
    updated_at: "",
    is_anonymous: false,
    ...over,
  } as User
}

const baseProfile: UserProfile = {
  user_id: "u1",
  display_name: null,
  avatar_url: null,
  gender: "female",
  age: 28,
  weight_kg: 65,
  goal: "hypertrophy",
  experience: "intermediate",
  equipment: "gym",
  training_days_per_week: 4,
  session_duration_minutes: 60,
  active_title_tier_id: null,
  created_at: "",
  updated_at: "",
}

describe("resolveDisplayName", () => {
  it("prefers profile display_name", () => {
    expect(
      resolveDisplayName(user({ user_metadata: { full_name: "OAuth" } }), {
        ...baseProfile,
        display_name: "Custom",
      }),
    ).toBe("Custom")
  })

  it("falls back to full email before OAuth full_name", () => {
    expect(
      resolveDisplayName(
        user({ email: "x@y.co", user_metadata: { full_name: "OAuth Name" } }),
        baseProfile,
      ),
    ).toBe("x@y.co")
  })

  it("falls back to OAuth full_name when email missing", () => {
    expect(resolveDisplayName(user({ email: undefined, user_metadata: { full_name: "OAuth Name" } }), baseProfile)).toBe(
      "OAuth Name",
    )
  })
})

describe("resolveAvatarUrl", () => {
  it("prefers profile avatar_url", () => {
    expect(
      resolveAvatarUrl(user({ user_metadata: { avatar_url: "https://google/a.png" } }), {
        ...baseProfile,
        avatar_url: "https://cdn.example/u.png",
      }),
    ).toBe("https://cdn.example/u.png")
  })

  it("falls back to OAuth avatar_url", () => {
    expect(
      resolveAvatarUrl(user({ user_metadata: { avatar_url: "https://google/a.png" } }), baseProfile),
    ).toBe("https://google/a.png")
  })

  it("returns undefined when none set", () => {
    expect(resolveAvatarUrl(user({ user_metadata: {} }), baseProfile)).toBeUndefined()
  })
})
