import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest"
import { act, waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import { useOnboardingResume } from "./useOnboardingResume"
import * as featureFlags from "@/lib/featureFlags"
import type { UserProfile } from "@/types/onboarding"

// Build a chainable Supabase query mock that lets us pre-program the
// `.maybeSingle()` resolution without exploding on the intermediate
// `.select`/`.eq`/`.in`/`.order`/`.limit` no-ops the production code chains.
function chain(maybeSingle: Promise<{ data: unknown; error: unknown }>) {
  const builder: Record<string, unknown> = {}
  for (const m of ["select", "eq", "in", "order", "limit"]) {
    builder[m] = vi.fn(() => builder)
  }
  builder.maybeSingle = vi.fn(() => maybeSingle)
  return builder
}

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

const fromMock = supabase.from as unknown as Mock

const PROFILE: UserProfile = {
  user_id: "u1",
  display_name: null,
  avatar_url: null,
  gender: "female",
  age: 30,
  weight_kg: 65,
  goal: "hypertrophy",
  experience: "beginner",
  equipment: "gym",
  training_days_per_week: 3,
  session_duration_minutes: 45,
  active_title_tier_id: null,
  timezone: "Europe/Paris",
  locale: null,
  created_at: "2026-05-08T10:00:00Z",
  updated_at: "2026-05-08T10:00:00Z",
}

const AUTHED_USER = { id: "u1", email: "x@y.z" }

beforeEach(() => {
  fromMock.mockReset()
  vi.spyOn(featureFlags, "isEmbeddedAgentEnabled").mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function setupSupabase(opts: {
  profile: UserProfile | null
  threadStatus?: "open" | "preview_ready" | null
}) {
  fromMock.mockImplementation((table: string) => {
    if (table === "user_profiles") {
      return chain(Promise.resolve({ data: opts.profile, error: null }))
    }
    if (table === "embedded_agent_threads") {
      return chain(
        Promise.resolve({
          data: opts.threadStatus ? { status: opts.threadStatus } : null,
          error: null,
        }),
      )
    }
    throw new Error(`unexpected supabase.from('${table}')`)
  })
}

describe("useOnboardingResume", () => {
  it("returns initialStep='welcome' when there's no user_profiles row (genuinely fresh user)", async () => {
    setupSupabase({ profile: null })

    const { result, store } = renderHookWithProviders(() => useOnboardingResume())
    act(() => { store.set(authAtom, AUTHED_USER as never) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.initialStep).toBe("welcome")
    expect(result.current.profile).toBeNull()
  })

  it("returns initialStep='path' when the user already has a profile but no embedded thread (questionnaire done, AI path not started)", async () => {
    setupSupabase({ profile: PROFILE, threadStatus: null })

    const { result, store } = renderHookWithProviders(() => useOnboardingResume())
    act(() => { store.set(authAtom, AUTHED_USER as never) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.initialStep).toBe("path")
    expect(result.current.profile).toEqual(PROFILE)
  })

  it("returns initialStep='embedded_chat' when an active 'open' thread exists (resume mid-conversation)", async () => {
    setupSupabase({ profile: PROFILE, threadStatus: "open" })

    const { result, store } = renderHookWithProviders(() => useOnboardingResume())
    act(() => { store.set(authAtom, AUTHED_USER as never) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.initialStep).toBe("embedded_chat")
    expect(result.current.profile).toEqual(PROFILE)
  })

  it("returns initialStep='embedded_preview' when a 'preview_ready' thread exists (resume at confirm screen)", async () => {
    setupSupabase({ profile: PROFILE, threadStatus: "preview_ready" })

    const { result, store } = renderHookWithProviders(() => useOnboardingResume())
    act(() => { store.set(authAtom, AUTHED_USER as never) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.initialStep).toBe("embedded_preview")
    expect(result.current.profile).toEqual(PROFILE)
  })

  it("never queries embedded_agent_threads when the embedded agent feature flag is off (legacy path users don't pay the round trip)", async () => {
    vi.spyOn(featureFlags, "isEmbeddedAgentEnabled").mockReturnValue(false)
    setupSupabase({ profile: PROFILE })

    const { result, store } = renderHookWithProviders(() => useOnboardingResume())
    act(() => { store.set(authAtom, AUTHED_USER as never) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.initialStep).toBe("path")
    // Only user_profiles should have been queried.
    const tablesQueried = fromMock.mock.calls.map((c) => c[0])
    expect(tablesQueried).toContain("user_profiles")
    expect(tablesQueried).not.toContain("embedded_agent_threads")
  })

  it("reports isLoading=true while the queries are in flight (so OnboardingPage can render a spinner instead of flashing 'welcome')", async () => {
    // Never resolve to keep the queries pending — we only want to assert the
    // loading state, not the final value.
    fromMock.mockImplementation(() => chain(new Promise(() => {})))

    const { result, store } = renderHookWithProviders(() => useOnboardingResume())
    act(() => { store.set(authAtom, AUTHED_USER as never) })

    expect(result.current.isLoading).toBe(true)
  })
})
