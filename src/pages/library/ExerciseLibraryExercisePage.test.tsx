import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Routes, Route } from "react-router-dom"
import { renderWithProviders } from "@/test/utils"
import { isAdminAtom } from "@/store/atoms"
import type { Exercise } from "@/types/database"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

import { ExerciseLibraryExercisePage } from "./ExerciseLibraryExercisePage"

const VALID_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

const stubExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: VALID_ID,
  name: "Squat",
  muscle_group: "legs",
  emoji: "🏋️",
  is_system: true,
  created_at: "2025-01-01T00:00:00Z",
  youtube_url: null,
  instructions: null,
  image_url: null,
  equipment: "barbell",
  difficulty_level: "intermediate",
  name_en: "Squat",
  source: null,
  secondary_muscles: null,
  reviewed_at: null,
  reviewed_by: null,
  ...overrides,
})

const mockUseExerciseFromLibrary = vi.fn<
  (id: string) => { data: Exercise | undefined; isLoading: boolean }
>()

vi.mock("@/hooks/useExerciseFromLibrary", () => ({
  useExerciseFromLibrary: (id: string) => mockUseExerciseFromLibrary(id),
}))

vi.mock("@/components/library/AddExerciseToDaySheet", () => ({
  AddExerciseToDaySheet: () => <div data-testid="add-sheet-mock" />,
}))

function renderAt(path: string, locale: "en" | "fr" = "en") {
  return renderWithProviders(
    <Routes>
      <Route path="/library/exercises/:exerciseId" element={<ExerciseLibraryExercisePage />} />
    </Routes>,
    { initialEntries: [path], locale },
  )
}

describe("ExerciseLibraryExercisePage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows not found for invalid exercise id", () => {
    mockUseExerciseFromLibrary.mockReturnValue({ data: undefined, isLoading: false })
    renderAt("/library/exercises/not-a-uuid")
    expect(screen.getByText("Exercise not found.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /back to exercise list/i })).toHaveAttribute(
      "href",
      "/library/exercises",
    )
  })

  it("shows loading state while fetching", () => {
    mockUseExerciseFromLibrary.mockReturnValue({ data: undefined, isLoading: true })
    renderAt(`/library/exercises/${VALID_ID}`)
    expect(screen.getByText("Loading…")).toBeInTheDocument()
  })

  it("shows not found when valid id returns no exercise", () => {
    mockUseExerciseFromLibrary.mockReturnValue({ data: undefined, isLoading: false })
    renderAt(`/library/exercises/${VALID_ID}`)
    expect(screen.getByText("Exercise not found.")).toBeInTheDocument()
  })

  it("renders exercise detail and add CTA", async () => {
    mockUseExerciseFromLibrary.mockReturnValue({
      data: stubExercise({ name: "Développé couché", name_en: "Bench Press" }),
      isLoading: false,
    })
    const user = userEvent.setup()
    renderAt(`/library/exercises/${VALID_ID}`)

    expect(screen.getByRole("heading", { name: "Bench Press" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /add to session/i })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /add to session/i }))
    expect(screen.getByTestId("add-sheet-mock")).toBeInTheDocument()
  })

  it.each([
    ["en", "Bench Press", "Chest", "Barbell"],
    ["fr", "Développé couché", "Pectoraux", "Barre"],
  ] as const)(
    "labels the exercise, its muscle and its equipment in %s",
    (locale, name, muscle, equipment) => {
      mockUseExerciseFromLibrary.mockReturnValue({
        data: stubExercise({
          name: "Développé couché",
          name_en: "Bench Press",
          muscle_group: "Pectoraux",
          equipment: "barbell",
        }),
        isLoading: false,
      })
      renderAt(`/library/exercises/${VALID_ID}`, locale)

      expect(screen.getByRole("heading", { name })).toBeInTheDocument()
      expect(screen.getByText(muscle)).toBeInTheDocument()
      expect(screen.getByText(equipment)).toBeInTheDocument()
    },
  )

  it("renders a muscle value that predates the taxonomy as-is", () => {
    mockUseExerciseFromLibrary.mockReturnValue({
      // No `muscles.*` key will ever match this one.
      data: stubExercise({ muscle_group: "Deltoïdes post." }),
      isLoading: false,
    })
    renderAt(`/library/exercises/${VALID_ID}`)

    expect(screen.getByText("Deltoïdes post.")).toBeInTheDocument()
  })

  it("renders feedback trigger for content issues", () => {
    mockUseExerciseFromLibrary.mockReturnValue({
      data: stubExercise(),
      isLoading: false,
    })
    renderAt(`/library/exercises/${VALID_ID}`)
    expect(screen.getByRole("button", { name: /report an issue/i })).toBeInTheDocument()
  })

  it("hides admin edit link for non-admins", () => {
    mockUseExerciseFromLibrary.mockReturnValue({
      data: stubExercise(),
      isLoading: false,
    })
    renderAt(`/library/exercises/${VALID_ID}`)
    expect(screen.queryByRole("link", { name: /edit in admin/i })).not.toBeInTheDocument()
  })

  it("shows admin edit link for admins", () => {
    mockUseExerciseFromLibrary.mockReturnValue({
      data: stubExercise(),
      isLoading: false,
    })
    const { store } = renderAt(`/library/exercises/${VALID_ID}`)
    act(() => {
      store.set(isAdminAtom, true)
    })
    const editLink = screen.getByRole("link", { name: /edit in admin/i })
    expect(editLink).toHaveAttribute("href", `/admin/exercises/${VALID_ID}`)
  })
})
