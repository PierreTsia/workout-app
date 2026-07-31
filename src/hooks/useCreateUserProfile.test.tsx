import { describe, it, expect, vi, beforeEach } from "vitest"
import { act } from "@testing-library/react"

import { renderHookWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import { useCreateUserProfile } from "./useCreateUserProfile"

const single = vi.fn()
const select = vi.fn(() => ({ single }))
const upsert = vi.fn(() => ({ select }))

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn(() => ({ upsert })) },
}))

const INPUT = {
  gender: "male",
  age: 30,
  weight: 80,
  goal: "strength",
  experience: "intermediate",
  equipment: "gym",
  training_days_per_week: 4,
  session_duration_minutes: 60,
} as const

beforeEach(() => {
  vi.clearAllMocks()
  single.mockResolvedValue({ data: {}, error: null })
})

async function createProfileIn(locale: "en" | "fr") {
  const { result, store } = renderHookWithProviders(
    () => useCreateUserProfile(),
    { locale },
  )
  act(() => {
    store.set(authAtom, { id: "user-1", email: "a@b.c" } as never)
  })

  await act(async () => {
    await result.current.mutateAsync(INPUT)
  })

  return vi.mocked(upsert).mock.calls[0][0] as Record<string, unknown>
}

describe("useCreateUserProfile", () => {
  // Captured like `timezone`: the language they read the onboarding in is the
  // best guess we will ever have for a device we have not met yet.
  it.each(["en", "fr"] as const)(
    "seeds the profile with the onboarding language (%s)",
    async (locale) => {
      expect(await createProfileIn(locale)).toMatchObject({ locale })
    },
  )

  // The column's CHECK only accepts a base subtag, so an unnormalized
  // "en-US" would fail the whole upsert — the profile, not just the language.
  it("normalizes a regional tag before writing it", async () => {
    const { result, store, i18nInstance } = renderHookWithProviders(() =>
      useCreateUserProfile(),
    )
    await act(async () => {
      await i18nInstance.changeLanguage("en-US")
    })
    act(() => {
      store.set(authAtom, { id: "user-1", email: "a@b.c" } as never)
    })

    await act(async () => {
      await result.current.mutateAsync(INPUT)
    })

    expect(vi.mocked(upsert).mock.calls[0][0]).toMatchObject({ locale: "en" })
  })
})
