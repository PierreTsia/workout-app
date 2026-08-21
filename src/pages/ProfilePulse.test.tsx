import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, screen, waitFor } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { ProfilePage } from "@/pages/ProfilePage"
import {
  restoreChartLayout,
  stubChartLayout,
} from "@/components/profile/charts/chartTestLayout"
import enProfile from "@/locales/en/profile.json"
import frProfile from "@/locales/fr/profile.json"
import { authAtom } from "@/store/atoms"

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

vi.mock("@/hooks/useFirstFinishedSessionAt", () => ({
  useFirstFinishedSessionAt: () => ({
    data: "2024-03-12T08:00:00.000Z",
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
    data: [{ id: "upper-lower", name: "Upper/Lower" }],
    isPending: false,
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

vi.mock("@/hooks/useProfileCircuitLedger", () => ({
  useProfileCircuitLedger: () => ({
    data: [],
    isSuccess: false,
    isPending: false,
    isError: false,
    fetchStatus: "idle",
  }),
}))

describe("profile pulse tiles", () => {
  beforeEach(() => {
    stubChartLayout()
    mockRpc.mockReset()
    mockRpc.mockResolvedValue({ data: { sessions: [], sets: [] }, error: null })
  })

  afterEach(() => {
    restoreChartLayout()
  })

  it("stretches the three tiles so they share a row height", () => {
    renderWithProviders(<ProfilePage />)

    const grid = screen.getByText("Sessions").closest(".grid")
    expect(grid?.className).toMatch(/items-stretch/)
  })

  it("labels duration as session time, not time under the bar", () => {
    renderWithProviders(<ProfilePage />)

    expect(screen.getByText("Session time")).toBeInTheDocument()
    expect(screen.queryByText("Time under the bar")).not.toBeInTheDocument()
    expect(screen.queryByText(/under the bar/i)).not.toBeInTheDocument()
    expect(enProfile.pulse.sessionTime).toBe("Session time")
    expect(frProfile.pulse.sessionTime).toBe("Temps de séance")
  })

  it("shows an empty strip when the live window has no sessions, not vs-prescribed zeros", async () => {
    const { store } = renderWithProviders(<ProfilePage />)
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => {
      expect(
        screen.getAllByText("No sessions in this window.").length,
      ).toBeGreaterThan(0)
    })
    expect(screen.queryByText(/vs 60 min prescribed/i)).not.toBeInTheDocument()
    expect(screen.queryByText("0 min")).not.toBeInTheDocument()
  })

  it("puts an RPC failure in the pulse error slot", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "snapshot failed" },
    })
    const { store } = renderWithProviders(<ProfilePage />)
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => {
      const pulse = screen.getByRole("heading", { name: "Sessions" }).closest(".bg-card")
      expect(pulse?.querySelector("[role='alert']")).toHaveTextContent(
        "Couldn't load this block.",
      )
    })
    expect(screen.queryByText(/vs 60 min prescribed/i)).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Mix" })).toBeInTheDocument()
  })

  it("uses snapshot active duration, not wall-clock activity minutes", async () => {
    const finished = new Date()
    const started = new Date(finished.getTime() - 2 * 60 * 60_000)
    mockRpc.mockResolvedValue({
      data: {
        sessions: [
          {
            id: "s1",
            started_at: started.toISOString(),
            finished_at: finished.toISOString(),
            active_duration_ms: 40 * 60_000,
            program_id: null,
            has_catalog_circuit: false,
          },
        ],
        sets: [],
      },
      error: null,
    })
    const { store } = renderWithProviders(<ProfilePage />)
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => {
      expect(screen.getAllByText("40 min").length).toBeGreaterThan(0)
    })
    const sessionTime = screen.getByText("Session time")
    const value = sessionTime.parentElement?.querySelector(".text-5xl")
    expect(value?.textContent).toBe("40 min")
    expect(screen.queryByText("120 min")).not.toBeInTheDocument()
    expect(screen.queryByText("2h")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /vs 60 min prescribed/i })).toHaveAttribute(
      "href",
      "/account",
    )
  })
})
