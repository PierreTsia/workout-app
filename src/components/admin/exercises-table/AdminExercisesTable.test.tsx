import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders, mockQueryResult } from "@/test/utils"
import type { Exercise } from "@/types/database"
import { AdminExercisesPage } from "@/pages/AdminExercisesPage"
import { useAdminExercises } from "@/hooks/useAdminExercises"

// jsdom has no layout and no matchMedia: the responsive column rule reads this
// seam, so the test drives desktop vs. mobile by flipping the mock.
const viewport = vi.hoisted(() => ({ desktop: true }))
vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => viewport.desktop,
}))
vi.mock("@/hooks/useAdminExercises", () => ({ useAdminExercises: vi.fn() }))
vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

const exercise = (overrides: Partial<Exercise> & { id: string }): Exercise => ({
  name: "Développé couché",
  name_en: "Bench Press",
  muscle_group: "Pectoraux",
  equipment: "barbell",
  emoji: "🏋️",
  is_system: true,
  created_at: "",
  youtube_url: null,
  instructions: null,
  image_url: null,
  difficulty_level: null,
  source: null,
  secondary_muscles: null,
  reviewed_at: null,
  reviewed_by: null,
  ...overrides,
})

const DATA: Exercise[] = [
  exercise({ id: "bench", reviewed_at: "2026-01-01T00:00:00Z" }),
  exercise({
    id: "curl",
    name: "Curl biceps",
    name_en: "Bicep Curl",
    muscle_group: "Biceps",
    equipment: "dumbbell",
  }),
]

const mockedExercises = vi.mocked(useAdminExercises)

function render(locale: "en" | "fr" = "en") {
  return renderWithProviders(<AdminExercisesPage />, { locale })
}

beforeEach(() => {
  vi.clearAllMocks()
  viewport.desktop = true
  mockedExercises.mockReturnValue(mockQueryResult(DATA))
})

describe("admin exercises table", () => {
  it("translates the muscle and equipment cells", () => {
    render()

    expect(screen.getByText("Chest")).toBeInTheDocument()
    expect(screen.getByText("Barbell")).toBeInTheDocument()
  })

  // The name column deliberately keeps the stored value: admins edit the
  // catalog, so they need to see what is actually written in it.
  it("keeps the stored name in the name column", () => {
    render()

    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument()
  })

  // Searching for what is on screen has to work, or translating the cell made
  // the table worse than when it showed the stored value.
  it("searches on the translated muscle label", async () => {
    const user = userEvent.setup()
    render()

    await user.type(screen.getByPlaceholderText(/search/i), "Chest")

    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.queryByText("Curl biceps")).not.toBeInTheDocument()
  })

  it("searches on the translated equipment label", async () => {
    const user = userEvent.setup()
    render()

    await user.type(screen.getByPlaceholderText(/search/i), "Dumbbell")

    expect(screen.getByText("Curl biceps")).toBeInTheDocument()
    expect(screen.queryByText("Développé couché")).not.toBeInTheDocument()
  })

  // An admin who has typed French muscle names for a year should not have to
  // stop.
  it("still searches on the stored canonical value", async () => {
    const user = userEvent.setup()
    render()

    await user.type(screen.getByPlaceholderText(/search/i), "Pectoraux")

    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.queryByText("Curl biceps")).not.toBeInTheDocument()
  })

  // The review tri-state now lives in the core's FacetDef, not a bespoke
  // segmented control. Multi-select facets have no "all" wildcard: it combined
  // with a real value into a union that silently cancelled the filter. The
  // unfiltered state is the facet's Clear action.
  it("filters by review status and clears through the facet", async () => {
    const user = userEvent.setup()
    render()

    expect(screen.getByText("Curl biceps")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /review status/i }))

    expect(
      screen.queryByRole("menuitem", { name: /^All/ }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("menuitem", { name: /^Reviewed/ }))

    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.queryByText("Curl biceps")).not.toBeInTheDocument()

    await user.click(screen.getByRole("menuitem", { name: "Clear" }))

    expect(screen.getByText("Curl biceps")).toBeInTheDocument()
  })

  // The baseline showed 50 rows per page (`Page 1 of 2`); the core defaults to
  // 25, so keeping this green is what pins the page size.
  it("paginates 50 exercises per page", () => {
    mockedExercises.mockReturnValue(
      mockQueryResult(
        Array.from({ length: 80 }, (_, i) =>
          exercise({ id: `e${i}`, name: `Exercise ${i}` }),
        ),
      ),
    )
    render()

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument()
  })

  // The @qa overflow at 390px: secondary columns are dropped on narrow
  // viewports instead of forcing a horizontal scroll.
  it("hides secondary columns on mobile", () => {
    viewport.desktop = false
    render()

    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.queryByText("Chest")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("columnheader", { name: /muscle group/i }),
    ).not.toBeInTheDocument()
  })
})
