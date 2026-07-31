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

async function createProfileIn(locale?: "en" | "fr") {
  const harness = renderHookWithProviders(() => useCreateUserProfile(), {
    locale,
  })
  act(() => {
    harness.store.set(authAtom, { id: "user-1", email: "a@b.c" } as never)
  })

  return harness
}

async function submitQuestionnaire(
  harness: Awaited<ReturnType<typeof createProfileIn>>,
) {
  await act(async () => {
    await harness.result.current.mutateAsync(INPUT)
  })
}

describe("useCreateUserProfile", () => {
  // Captured like `timezone`: the language they read the onboarding in is the
  // best guess we will ever have for a device we have not met yet.
  it.each(["en", "fr"] as const)(
    "seeds the profile with the onboarding language (%s)",
    async (locale) => {
      await submitQuestionnaire(await createProfileIn(locale))

      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({ locale }),
        expect.anything(),
      )
    },
  )

  // The column's CHECK only accepts a base subtag, so an unnormalized
  // "en-US" would fail the whole upsert — the profile, not just the language.
  it("normalizes a regional tag before writing it", async () => {
    const harness = await createProfileIn()
    await act(async () => {
      await harness.i18nInstance.changeLanguage("en-US")
    })

    await submitQuestionnaire(harness)

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en" }),
      expect.anything(),
    )
  })
})
