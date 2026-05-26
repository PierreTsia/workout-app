import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { CycleSummaryPage } from "./CycleSummaryPage"

const mockNavigate = vi.fn()

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  )
  return {
    ...actual,
    useParams: () => ({ cycleId: "cycle-1" }),
    useNavigate: () => mockNavigate,
  }
})

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: {
              id: "cycle-1",
              user_id: "user-1",
              program_id: "program-1",
              started_at: "2026-01-01T00:00:00.000Z",
              finished_at: "2026-01-30T00:00:00.000Z",
            },
            error: null,
          }),
        }),
      }),
    }),
  },
}))

vi.mock("@/hooks/useCycleStats", () => ({
  useCycleStats: () => ({
    data: {
      session_count: 4,
      total_duration_ms: 3600000,
      total_sets: 42,
      total_volume_kg: 288566,
      pr_count: 3,
      duration_days: 28,
      started_at: "2026-01-01T00:00:00.000Z",
      last_finished_at: "2026-01-30T00:00:00.000Z",
      delta_sets_pct: null,
      delta_volume_pct: null,
      delta_prs_pct: null,
    },
    isLoading: false,
  }),
}))

vi.mock("@/hooks/usePreviousCycle", () => ({
  usePreviousCycle: () => ({ data: null }),
}))

vi.mock("@/hooks/useWorkoutDays", () => ({
  useWorkoutDays: () => ({
    data: [
      {
        id: "day-1",
        user_id: "user-1",
        program_id: "program-1",
        label: "Day 1",
        emoji: "💪",
        sort_order: 0,
        created_at: "2026-01-01T00:00:00.000Z",
        saved_at: null,
      },
      {
        id: "day-2",
        user_id: "user-1",
        program_id: "program-1",
        label: "Day 2",
        emoji: "💪",
        sort_order: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        saved_at: null,
      },
    ],
  }),
}))

vi.mock("@/hooks/useCycle", () => ({
  useCycleProgress: () => ({
    completedDayIds: ["day-1", "day-2"],
    totalDays: 2,
    nextDayId: null,
    isComplete: true,
    isLoading: false,
  }),
}))

describe("CycleSummaryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows a single return-to-home CTA instead of start new cycle", async () => {
    const user = userEvent.setup()
    renderWithProviders(<CycleSummaryPage />)

    const backButton = await screen.findByRole("button", {
      name: /back to workouts/i,
    })

    expect(
      screen.queryByRole("button", { name: /start new cycle/i }),
    ).not.toBeInTheDocument()

    await user.click(backButton)
    expect(mockNavigate).toHaveBeenCalledWith("/")
  })

  it("renders the cycle volume in compact notation, not as a raw integer", async () => {
    renderWithProviders(<CycleSummaryPage />)

    await screen.findByRole("button", { name: /back to workouts/i })

    expect(screen.getByText("288.6K kg")).toBeInTheDocument()
    expect(screen.queryByText("288,566 kg")).not.toBeInTheDocument()
  })
})
