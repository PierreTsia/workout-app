import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, screen, waitFor, within } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { ProfilePage } from "@/pages/ProfilePage"
import {
  restoreChartLayout,
  stubChartLayout,
} from "@/components/profile/charts/chartTestLayout"
import { authAtom } from "@/store/atoms"
import type { SetFact } from "@/lib/profile/types"
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

vi.mock("@/hooks/useProfileCircuitLedger", () => ({
  useProfileCircuitLedger: () => ({
    data: [],
    isSuccess: false,
    isPending: false,
    isError: false,
    fetchStatus: "idle",
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

function withinRecords() {
  const heading = screen.getByRole("heading", { name: "Records" })
  const card = heading.closest(".bg-card")
  if (!(card instanceof HTMLElement)) throw new Error("expected Records card")
  return within(card)
}

function prValue() {
  const title = withinRecords().getAllByText("PRs")[0]
  const value = title?.parentElement?.querySelector(".text-5xl")
  if (value == null) throw new Error("expected Records PR value")
  return value
}

function testUser(): User {
  return {
    id: "user-1",
    aud: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
  }
}

function snapshotWithSets(sets: SetFact[], finishedAt = new Date()) {
  return {
    sessions: [
      {
        id: "s1",
        started_at: new Date(finishedAt.getTime() - 40 * 60_000).toISOString(),
        finished_at: finishedAt.toISOString(),
        active_duration_ms: 40 * 60_000,
        program_id: null,
        has_catalog_circuit: false,
      },
    ],
    sets,
  }
}

describe("profile Records from snapshot", () => {
  beforeEach(() => {
    stubChartLayout()
    mockRpc.mockReset()
    mockRpc.mockResolvedValue({ data: { sessions: [], sets: [] }, error: null })
  })

  afterEach(() => {
    restoreChartLayout()
  })

  it("increments Records from a duration was_pr, not the Pierre fixture or cycle_stats", async () => {
    mockRpc.mockResolvedValue({
      data: snapshotWithSets([
        {
          session_id: "s1",
          exercise_id: "ex-plank",
          was_pr: true,
          rir: null,
          weight_logged: 0,
          reps: null,
          duration_seconds: 60,
          block_exercise_id: null,
        },
      ]),
      error: null,
    })
    const { store } = renderWithProviders(<ProfilePage />)
    act(() => {
      store.set(authAtom, testUser())
    })

    await waitFor(() => {
      expect(prValue()).toHaveTextContent("1")
    })
    expect(withinRecords().queryByText("11")).not.toBeInTheDocument()
  })

  it("increments the same Records count for a loaded Circuit station was_pr", async () => {
    mockRpc.mockResolvedValue({
      data: snapshotWithSets([
        {
          session_id: "s1",
          exercise_id: "ex-deadlift",
          was_pr: true,
          rir: 1,
          weight_logged: 140,
          reps: "3",
          duration_seconds: null,
          block_exercise_id: "station-1",
        },
      ]),
      error: null,
    })
    const { store } = renderWithProviders(<ProfilePage />)
    act(() => {
      store.set(authAtom, testUser())
    })

    await waitFor(() => {
      expect(prValue()).toHaveTextContent("1")
    })
  })

  it("omits the RIR 0 line when the window has no declared RIR", async () => {
    mockRpc.mockResolvedValue({
      data: snapshotWithSets([
        {
          session_id: "s1",
          exercise_id: "ex-plank",
          was_pr: true,
          rir: null,
          weight_logged: 0,
          reps: null,
          duration_seconds: 60,
          block_exercise_id: null,
        },
      ]),
      error: null,
    })
    const { store } = renderWithProviders(<ProfilePage />)
    act(() => {
      store.set(authAtom, testUser())
    })

    await waitFor(() => {
      const combo = withinRecords().getByRole("img", { name: /PRs and RIR 0/i })
      expect(combo.querySelectorAll(".recharts-line")).toHaveLength(0)
      expect(combo.querySelectorAll(".recharts-dot")).toHaveLength(0)
    })
  })
})
