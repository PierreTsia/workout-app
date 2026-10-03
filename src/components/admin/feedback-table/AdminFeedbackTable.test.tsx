import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders, mockQueryResult } from "@/test/utils"
import type { ExerciseContentFeedback } from "@/types/database"
import { AdminFeedbackPage } from "@/pages/AdminFeedbackPage"
import { useAdminFeedback } from "@/hooks/useAdminFeedback"

const spies = vi.hoisted(() => ({ mutate: vi.fn() }))

vi.mock("@/hooks/useAdminFeedback", () => ({ useAdminFeedback: vi.fn() }))
vi.mock("@/hooks/useAdminUpdateFeedbackStatus", () => ({
  useAdminUpdateFeedbackStatus: () => ({ mutate: spies.mutate }),
}))
vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

const feedback = (
  overrides: Partial<ExerciseContentFeedback> & { id: string },
): ExerciseContentFeedback => ({
  exercise_id: "bench",
  user_email: "user@example.com",
  user_id: "u1",
  source_screen: "workout",
  fields_reported: ["illustration"],
  error_details: {},
  other_illustration_text: null,
  other_video_text: null,
  other_description_text: null,
  comment: null,
  status: "pending",
  resolved_at: null,
  resolved_by: null,
  created_at: "2026-01-01T00:00:00Z",
  exercises: { name: "Développé couché", emoji: "🏋️" },
  ...overrides,
})

const DATA: ExerciseContentFeedback[] = [
  feedback({ id: "pending-1" }),
  feedback({
    id: "resolved-1",
    status: "resolved",
    source_screen: "builder",
    exercises: { name: "Curl biceps", emoji: "💪" },
  }),
]

const mockedFeedback = vi.mocked(useAdminFeedback)

function render(locale: "en" | "fr" = "en") {
  return renderWithProviders(<AdminFeedbackPage />, { locale })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedFeedback.mockReturnValue(mockQueryResult(DATA))
})

describe("admin feedback table", () => {
  it("renders a feedback report with its exercise and source", () => {
    render()

    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.getByText("Workout")).toBeInTheDocument()
  })

  // The old toolbar had a bespoke segmented control; the status filter now
  // lives in the core's FacetDef.
  it("filters by status through the facet", async () => {
    const user = userEvent.setup()
    render()

    expect(screen.getByText("Curl biceps")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Status", expanded: false }))
    await user.click(screen.getByRole("menuitem", { name: /^Resolved/ }))

    expect(screen.getByText("Curl biceps")).toBeInTheDocument()
    expect(screen.queryByText("Développé couché")).not.toBeInTheDocument()
  })

  it("searches by exercise name", async () => {
    const user = userEvent.setup()
    render()

    await user.type(screen.getByPlaceholderText(/search/i), "Curl")

    expect(screen.getByText("Curl biceps")).toBeInTheDocument()
    expect(screen.queryByText("Développé couché")).not.toBeInTheDocument()
  })

  it("searches by user email", async () => {
    const user = userEvent.setup()
    mockedFeedback.mockReturnValue(
      mockQueryResult([
        feedback({ id: "a", user_email: "alice@example.com" }),
        feedback({
          id: "b",
          user_email: "bob@example.com",
          exercises: { name: "Curl biceps", emoji: "💪" },
        }),
      ]),
    )
    render()

    await user.type(screen.getByPlaceholderText(/search/i), "bob@")

    expect(screen.getByText("Curl biceps")).toBeInTheDocument()
    expect(screen.queryByText("Développé couché")).not.toBeInTheDocument()
  })

  // The core owns the open/close of the detail; its inline placement replaces
  // the bespoke expanded-row branch.
  it("opens the inline detail when the row is clicked", async () => {
    const user = userEvent.setup()
    mockedFeedback.mockReturnValue(
      mockQueryResult([
        feedback({
          id: "with-detail",
          error_details: { illustration: ["wrong_exercise"] },
        }),
      ]),
    )
    render()

    expect(screen.queryByText("Error details")).not.toBeInTheDocument()

    await user.click(screen.getByText("user@example.com"))

    expect(screen.getByText("Error details")).toBeInTheDocument()
  })

  // Transitions live on a core Select now: picking a status fires the mutation.
  it("changes the status through the core Select", async () => {
    const user = userEvent.setup()
    mockedFeedback.mockReturnValue(mockQueryResult([feedback({ id: "pending-1" })]))
    render()

    await user.click(screen.getByRole("combobox", { name: "Status" }))

    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Pending", "In review", "Resolved"])

    await user.click(screen.getByRole("option", { name: "Resolved" }))

    expect(spies.mutate).toHaveBeenCalledWith({
      id: "pending-1",
      status: "resolved",
      adminEmail: "unknown",
    })
  })

  it("renders the empty state through the labels", () => {
    mockedFeedback.mockReturnValue(mockQueryResult([]))
    render()

    expect(screen.getByText("No feedback reports.")).toBeInTheDocument()
  })

  // The core's FacetedDataTable always mounts its pagination footer — even on
  // an empty queue, where it shows a meaningless "Page 0 of 0". The pre-Nomos
  // baseline had no footer at all, so an empty queue skips the table.
  it("hides the pagination footer when the queue is empty", () => {
    mockedFeedback.mockReturnValue(mockQueryResult([]))
    render()

    expect(screen.queryByText("Page 0 of 0")).not.toBeInTheDocument()
    expect(screen.queryByText("Rows per page")).not.toBeInTheDocument()
  })

  // Feedback had no pagination; the core defaults to 25, so a >25 dataset pins
  // the page size that keeps every row on screen.
  it("keeps every row on screen", () => {
    mockedFeedback.mockReturnValue(
      mockQueryResult(
        Array.from({ length: 30 }, (_, i) =>
          feedback({
            id: `f${i}`,
            exercises: { name: `Exercise ${i}`, emoji: "🏋️" },
          }),
        ),
      ),
    )
    render()

    expect(screen.getByText("Exercise 29")).toBeInTheDocument()
  })
})