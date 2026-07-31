import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest"
import { act, waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { supabase } from "@/lib/supabase"
import { authAtom, hasProgramAtom, hasProgramLoadingAtom } from "@/store/atoms"
import { useOnboardingEntry } from "./useOnboardingEntry"
import { useOnboardingResume } from "./useOnboardingResume"
import * as featureFlags from "@/lib/featureFlags"
import type { UserProfile } from "@/types/onboarding"

// Mirrors the chainable builder in `useOnboardingResume.test.ts` — the resume
// probe is composed as-is, so this suite has to satisfy the same query shape.
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

describe("useOnboardingEntry", () => {
  it("sends an onboarded user home even though the resume probe resolves to 'path' (#420 — the race that stranded them on the wizard)", async () => {
    setupSupabase({ profile: PROFILE, threadStatus: null })

    const { result, store } = renderHookWithProviders(() => useOnboardingEntry())
    act(() => {
      store.set(authAtom, AUTHED_USER as never)
      store.set(hasProgramAtom, true)
      store.set(hasProgramLoadingAtom, false)
    })

    await waitFor(() => expect(result.current.status).toBe("redirect"))
    expect(result.current).toEqual({ status: "redirect" })
  })

  it("withholds the decision until the program probe settles, even once the resume probe has answered", async () => {
    setupSupabase({ profile: PROFILE, threadStatus: null })

    // `useOnboardingResume` is observed here purely as a precondition: it is a
    // public hook, and watching it lets the test pin the exact interleaving
    // that used to strand users — resume first, program probe second.
    const { result, store } = renderHookWithProviders(() => ({
      entry: useOnboardingEntry(),
      resume: useOnboardingResume(),
    }))
    act(() => {
      store.set(authAtom, AUTHED_USER as never)
    })

    await waitFor(() => expect(result.current.resume.isLoading).toBe(false))

    // `hasProgramLoadingAtom` is still true: no decision can be taken yet.
    expect(result.current.entry.status).toBe("pending")
  })

  it("resumes at the step the probe reported when the user has no program yet", async () => {
    setupSupabase({ profile: PROFILE, threadStatus: null })

    const { result, store } = renderHookWithProviders(() => useOnboardingEntry())
    act(() => {
      store.set(authAtom, AUTHED_USER as never)
      store.set(hasProgramLoadingAtom, false)
    })

    await waitFor(() => expect(result.current.status).toBe("resume"))
    expect(result.current).toEqual({
      status: "resume",
      step: "path",
      profile: PROFILE,
    })
  })

  it("resumes at 'welcome' for a genuinely fresh user", async () => {
    setupSupabase({ profile: null })

    const { result, store } = renderHookWithProviders(() => useOnboardingEntry())
    act(() => {
      store.set(authAtom, AUTHED_USER as never)
      store.set(hasProgramLoadingAtom, false)
    })

    await waitFor(() => expect(result.current.status).toBe("resume"))
    expect(result.current).toEqual({
      status: "resume",
      step: "welcome",
      profile: null,
    })
  })

  it("keeps resuming after a program is created mid-wizard, instead of bouncing the user home", async () => {
    setupSupabase({ profile: PROFILE, threadStatus: null })

    const { result, store } = renderHookWithProviders(() => useOnboardingEntry())
    act(() => {
      store.set(authAtom, AUTHED_USER as never)
      store.set(hasProgramLoadingAtom, false)
    })

    await waitFor(() => expect(result.current.status).toBe("resume"))

    // The blank, template and AI-commit paths all flip this atom while the
    // user is still on the wizard, before their own navigate() runs. Treating
    // that as "already onboarded" would strand them on home.
    act(() => {
      store.set(hasProgramAtom, true)
    })

    expect(result.current.status).toBe("resume")
  })
})
