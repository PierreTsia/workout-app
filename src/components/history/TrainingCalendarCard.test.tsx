import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import { TrainingCalendarCard } from "@/components/history/TrainingCalendarCard"
import { renderWithProviders } from "@/test/utils"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

describe("TrainingCalendarCard", () => {
  it("shows month empty state when the visible month has no sessions", () => {
    renderWithProviders(
      <TrainingCalendarCard
        visibleMonth={new Date(2024, 2, 1)}
        onVisibleMonthChange={vi.fn()}
        selectedDate={new Date(2024, 2, 15)}
        onSelectDate={vi.fn()}
        monthRows={[]}
        daySessions={[]}
        isLoadingMonth={false}
        hasSessionsInVisibleMonth={false}
      />,
    )
    expect(screen.getByText("No sessions this month")).toBeInTheDocument()
  })

  it("shows day empty copy when the month has sessions but the selected day does not", () => {
    renderWithProviders(
      <TrainingCalendarCard
        visibleMonth={new Date(2024, 2, 1)}
        onVisibleMonthChange={vi.fn()}
        selectedDate={new Date(2024, 2, 10)}
        onSelectDate={vi.fn()}
        monthRows={[{ day: "2024-03-05", session_count: 1, minutes: 40 }]}
        daySessions={[]}
        isLoadingMonth={false}
        hasSessionsInVisibleMonth
      />,
    )
    expect(screen.getByText("Nothing logged that day")).toBeInTheDocument()
  })
})
