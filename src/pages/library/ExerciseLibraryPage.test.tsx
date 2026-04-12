import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import type { Exercise } from "@/types/database"
import { ExerciseLibraryPage } from "./ExerciseLibraryPage"

const EX: Exercise = {
  id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  name: "Test Move",
  muscle_group: "chest",
  emoji: "🏋️",
  is_system: true,
  created_at: "2025-01-01T00:00:00Z",
  youtube_url: null,
  instructions: null,
  image_url: null,
  equipment: "barbell",
  difficulty_level: null,
  name_en: null,
  source: null,
  secondary_muscles: null,
  reviewed_at: null,
  reviewed_by: null,
}

const mockUseExerciseLibraryPaginated = vi.fn()
const mockFetchNextPage = vi.fn()

vi.mock("@/hooks/useExerciseLibraryPaginated", () => ({
  useExerciseLibraryPaginated: (params: unknown) => mockUseExerciseLibraryPaginated(params),
}))

vi.mock("@/hooks/useExerciseFilterOptions", () => ({
  useExerciseFilterOptions: () => ({
    data: {
      muscle_groups: ["chest"],
      equipment: ["barbell"],
      difficulty_levels: ["beginner"],
    },
  }),
}))

const mockNavigate = vi.fn()
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return {
    ...actual,
    useNavigate: (): ReturnType<typeof actual.useNavigate> => mockNavigate as never,
  }
})

describe("ExerciseLibraryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseExerciseLibraryPaginated.mockReturnValue({
      data: [EX],
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: true,
      fetchNextPage: mockFetchNextPage,
    })
  })

  it("renders title and exercise row", () => {
    renderWithProviders(<ExerciseLibraryPage />, { initialEntries: ["/library/exercises"] })
    expect(screen.getByRole("heading", { name: /^Exercises$/i })).toBeInTheDocument()
    expect(screen.getByText("Test Move")).toBeInTheDocument()
  })

  it("navigates to detail when selecting an exercise", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExerciseLibraryPage />, { initialEntries: ["/library/exercises"] })

    await user.click(screen.getByText("Test Move"))
    expect(mockNavigate).toHaveBeenCalledWith(
      `/library/exercises/${EX.id}`,
    )
  })

  it("load more triggers fetchNextPage", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExerciseLibraryPage />, { initialEntries: ["/library/exercises"] })

    await user.click(screen.getByRole("button", { name: /load more/i }))
    expect(mockFetchNextPage).toHaveBeenCalled()
  })
})
