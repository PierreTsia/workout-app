import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { ProfilePage } from "@/pages/ProfilePage"
import {
  restoreChartLayout,
  stubChartLayout,
} from "@/components/profile/charts/chartTestLayout"
import { MUSCLE_TAXONOMY } from "@/lib/trainingBalance"
import { authAtom } from "@/store/atoms"
import type { User } from "@/types/auth"

const mockRpc = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: () => ({
    data: { session_duration_minutes: 60 },
    isLoading: false,
    isError: false,
  }),
}))

vi.mock("@/hooks/useBadgeStatus", () => ({
  useBadgeStatus: () => ({
    data: [],
    isPending: false,
    isError: false,
    isSuccess: true,
  }),
}))

vi.mock("@/hooks/useFirstFinishedSessionAt", () => ({
  useFirstFinishedSessionAt: () => ({
    data: "2023-01-01T08:00:00.000Z",
    isPending: false,
    isError: false,
    isSuccess: true,
  }),
}))

vi.mock("@/hooks/useActiveProgram", () => ({
  useActiveProgram: () => ({
    data: { id: "upper-lower", name: "Upper/Lower" },
    isPending: false,
    isError: false,
  }),
}))

vi.mock("@/hooks/useUserPrograms", () => ({
  useUserPrograms: () => ({
    data: [
      { id: "upper-lower", name: "Upper/Lower" },
      { id: "ppl", name: "PPL" },
    ],
    isPending: false,
    isError: false,
  }),
}))

vi.mock("@/hooks/useProfileCircuitLedger", () => ({
  useProfileCircuitLedger: () => ({
    data: [],
    isSuccess: false,
    isPending: false,
    isError: false,
    fetchStatus: "idle",
  }),
}))

vi.mock("@/lib/trainingActivityTimezone", () => ({
  getResolvedIANATimeZone: () => "UTC",
}))

function testUser(): User {
  return {
    id: "user-1",
    aud: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
  }
}

function volume(sessions: number) {
  return {
    finished_sessions: sessions,
    muscles: MUSCLE_TAXONOMY.map((muscle) => ({
      muscle_group: muscle,
      total_sets: muscle === "Pectoraux" || muscle === "Dos" ? 12 : 6,
      total_volume_kg: 1000,
      exercise_count: 2,
    })),
  }
}

describe("profile Toujours rollups", () => {
  beforeEach(() => {
    stubChartLayout()
    mockRpc.mockReset()
    mockRpc.mockImplementation((name: string) => {
      if (name === "get_profile_all_time_rollups") {
        return Promise.resolve({
          data: {
            years: [
              {
                year: 2023,
                mix: { programme: 10, quickWorkout: 2, circuits: 1 },
                tonnage_kg: 4000,
                pr_pairs: 8,
                rir0_num: 2,
                rir0_den: 20,
                session_count: 13,
                duration_ms: 13 * 40 * 60_000,
              },
              {
                year: 2026,
                mix: { programme: 4, quickWorkout: 1, circuits: 0 },
                tonnage_kg: 2000,
                pr_pairs: 3,
                rir0_num: 1,
                rir0_den: 10,
                session_count: 5,
                duration_ms: 5 * 40 * 60_000,
              },
            ],
            program_ids: ["upper-lower", "ppl"],
            regulars: [
              {
                exercise_id: "career-squat",
                reps: 1240,
                last_logged_at: "2026-08-01T11:00:00.000Z",
              },
            ],
            pr_exercise_count: 7,
            last_pr_day: "2026-08-19",
          },
          error: null,
        })
      }
      if (name === "get_volume_by_muscle_group_all_time") {
        return Promise.resolve({ data: volume(40), error: null })
      }
      if (name === "get_profile_snapshot") {
        return Promise.resolve({ data: { sessions: [], sets: [] }, error: null })
      }
      if (name === "get_volume_by_muscle_group") {
        return Promise.resolve({ data: volume(4), error: null })
      }
      return Promise.resolve({ data: [], error: null })
    })
    Object.assign(Element.prototype, {
      hasPointerCapture: () => false,
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
      scrollIntoView: () => undefined,
    })
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  afterEach(() => {
    restoreChartLayout()
  })

  it("hides the broken Toujours cran and stays on a snapshot window", async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<ProfilePage />)
    act(() => {
      store.set(authAtom, testUser())
    })

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith(
        "get_profile_snapshot",
        expect.objectContaining({ p_tz: "UTC" }),
      )
    })
    expect(
      mockRpc.mock.calls.some((call) => call[0] === "get_profile_all_time_rollups"),
    ).toBe(false)

    await user.click(screen.getByRole("combobox", { name: "Window" }))
    expect(
      screen.queryByRole("option", { name: "All time" }),
    ).not.toBeInTheDocument()
    expect(
      mockRpc.mock.calls.some((call) => call[0] === "get_profile_all_time_rollups"),
    ).toBe(false)
    expect(screen.getAllByText(/vs prior/i).length).toBeGreaterThan(0)
  })
})
