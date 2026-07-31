import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, waitFor } from "@testing-library/react"

import { renderHookWithProviders, mockQueryResult } from "@/test/utils"
import { authAtom, localeAtom } from "@/store/atoms"
import type { UserProfile } from "@/types/onboarding"
import { useUserProfile } from "@/hooks/useUserProfile"
import {
  useHydrateLocaleFromProfile,
  usePersistProfileLocale,
} from "./useProfileLocale"

const eq = vi.fn()
const update = vi.fn(() => ({ eq }))

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn(() => ({ update })) },
}))

vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: vi.fn(),
}))

const profile = (locale: UserProfile["locale"]) =>
  mockQueryResult({ locale } as UserProfile)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  eq.mockResolvedValue({ error: null })
  vi.mocked(useUserProfile).mockReturnValue(mockQueryResult(null))
})

afterEach(() => {
  localStorage.clear()
})

describe("usePersistProfileLocale", () => {
  it("writes the chosen language to the signed-in user's profile", async () => {
    const { result, store } = renderHookWithProviders(() =>
      usePersistProfileLocale(),
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await act(async () => {
      await result.current("fr")
    })

    expect(update).toHaveBeenCalledWith({ locale: "fr" })
    expect(eq).toHaveBeenCalledWith("user_id", "user-1")
  })

  it("does nothing at all when nobody is signed in", async () => {
    const { result } = renderHookWithProviders(() => usePersistProfileLocale())

    await act(async () => {
      await result.current("fr")
    })

    expect(update).not.toHaveBeenCalled()
  })

  // The UI is already correct when this runs, so a failure has nothing to
  // report: surfacing it would be noise about a preference, not a problem.
  it("stays silent when the write fails", async () => {
    eq.mockRejectedValue(new Error("network down"))
    const { result, store } = renderHookWithProviders(() =>
      usePersistProfileLocale(),
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await expect(
      act(async () => {
        await result.current("fr")
      }),
    ).resolves.not.toThrow()
  })
})

describe("useHydrateLocaleFromProfile", () => {
  it("adopts the profile language on a device that has stored nothing", async () => {
    vi.mocked(useUserProfile).mockReturnValue(profile("fr"))

    const { store } = renderHookWithProviders(() =>
      useHydrateLocaleFromProfile(),
    )

    await waitFor(() => {
      expect(store.get(localeAtom)).toBe("fr")
    })
  })

  it("leaves an explicit choice on this device alone", async () => {
    localStorage.setItem("locale", '"en"')
    vi.mocked(useUserProfile).mockReturnValue(profile("fr"))

    const { store } = renderHookWithProviders(() =>
      useHydrateLocaleFromProfile(),
    )

    await waitFor(() => {
      expect(store.get(localeAtom)).toBe("en")
    })
    expect(localStorage.getItem("locale")).toBe('"en"')
  })

  // NULL means "never chose", which must not be read as "chose the default".
  it("does nothing when the profile has no language", async () => {
    vi.mocked(useUserProfile).mockReturnValue(profile(null))

    renderHookWithProviders(() => useHydrateLocaleFromProfile())

    await waitFor(() => {
      expect(localStorage.getItem("locale")).toBeNull()
    })
  })

  it("stores what it adopted so the next boot needs no round-trip", async () => {
    vi.mocked(useUserProfile).mockReturnValue(profile("fr"))

    renderHookWithProviders(() => useHydrateLocaleFromProfile())

    await waitFor(() => {
      expect(localStorage.getItem("locale")).toBe('"fr"')
    })
  })
})
