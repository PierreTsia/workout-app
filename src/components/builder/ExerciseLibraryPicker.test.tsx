import { vi, describe, it, expect, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import type { Exercise } from "@/types/database"
import { ExerciseLibraryPicker } from "./ExerciseLibraryPicker"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

const EXERCISES: Exercise[] = [
  {
    id: "1",
    name: "Développé couché",
    name_en: "Bench Press",
    muscle_group: "Pectoraux",
    equipment: "barbell",
    difficulty_level: "beginner",
    emoji: "🏋️",
    is_system: true,
    created_at: "2025-01-01T00:00:00Z",
    youtube_url: null,
    instructions: null,
    image_url: null,
    source: "wger:73",
    secondary_muscles: null,
    reviewed_at: null,
    reviewed_by: null,
  },
  {
    id: "2",
    name: "Élévations latérales",
    name_en: "Lateral Raises",
    muscle_group: "Épaules",
    equipment: "dumbbell",
    difficulty_level: "intermediate",
    emoji: "🙆",
    is_system: true,
    created_at: "2025-01-01T00:00:00Z",
    youtube_url: null,
    instructions: null,
    image_url: null,
    source: "wger:348",
    secondary_muscles: null,
    reviewed_at: null,
    reviewed_by: null,
  },
  {
    id: "3",
    name: "Presse à cuisse",
    name_en: "Leg Press",
    muscle_group: "Quadriceps",
    equipment: "machine",
    difficulty_level: "advanced",
    emoji: "🦵",
    is_system: true,
    created_at: "2025-01-01T00:00:00Z",
    youtube_url: null,
    instructions: null,
    image_url: null,
    source: "wger:371",
    secondary_muscles: null,
    reviewed_at: null,
    reviewed_by: null,
  },
  {
    id: "4",
    name: "Curls biceps inclinés",
    name_en: "Dumbbell Incline Curl",
    muscle_group: "Biceps",
    equipment: "dumbbell",
    difficulty_level: null,
    emoji: "💪",
    is_system: true,
    created_at: "2025-01-01T00:00:00Z",
    youtube_url: null,
    instructions: null,
    image_url: null,
    source: "wger:204",
    secondary_muscles: null,
    reviewed_at: null,
    reviewed_by: null,
  },
]

const mockFetchNextPage = vi.fn()
function paginatedReturn(params: {
  muscleGroup?: string | null
  equipment?: string[]
  difficulty?: string[]
}) {
  let list = EXERCISES
  if (params.muscleGroup) {
    list = list.filter((e) => e.muscle_group === params.muscleGroup)
  }
  if (params.equipment?.length) {
    list = list.filter((e) => params.equipment!.includes(e.equipment))
  }
  if (params.difficulty?.length) {
    list = list.filter(
      (e) => e.difficulty_level != null && params.difficulty!.includes(e.difficulty_level),
    )
  }
  return {
    data: list,
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: mockFetchNextPage,
  }
}
const mockUseExerciseLibraryPaginated = vi.fn(
  (params: {
    muscleGroup?: string | null
    equipment?: string[]
    difficulty?: string[]
  }) => paginatedReturn(params),
)
const mockUseExerciseFilterOptions = vi.fn(() => ({
  data: {
    muscle_groups: ["Biceps", "Épaules", "Pectoraux", "Quadriceps"],
    equipment: ["barbell", "dumbbell", "machine"],
    difficulty_levels: ["beginner", "intermediate", "advanced"],
  },
  isLoading: false,
}))

const mockAddExercisesMutateAsync = vi.fn().mockResolvedValue(undefined)
const mockDeleteExerciseMutateAsync = vi.fn().mockResolvedValue(undefined)
const mockUseAddExercisesToDay = vi.fn(() => ({
  mutateAsync: mockAddExercisesMutateAsync,
  isPending: false,
}))
const mockUseDeleteExercise = vi.fn(() => ({
  mutateAsync: mockDeleteExerciseMutateAsync,
  isPending: false,
}))

vi.mock("@/hooks/useExerciseLibraryPaginated", () => ({
  useExerciseLibraryPaginated: (params: {
    search?: string
    muscleGroup?: string | null
    equipment?: string[]
    difficulty?: string[]
  }) => mockUseExerciseLibraryPaginated(params),
}))
vi.mock("@/hooks/useExerciseFilterOptions", () => ({
  useExerciseFilterOptions: () => mockUseExerciseFilterOptions(),
}))

vi.mock("@/hooks/useBuilderMutations", () => ({
  useAddExercisesToDay: () => mockUseAddExercisesToDay(),
  useDeleteExercise: () => mockUseDeleteExercise(),
}))

vi.mock("@/components/exercise/ExerciseInfoDialog", () => ({
  ExerciseInfoDialog: () => null,
}))

vi.mock("@/components/exercise/ExerciseThumbnail", () => ({
  ExerciseThumbnail: () => <div data-testid="thumbnail" />,
}))

function renderPicker(overrides = {}) {
  return renderWithProviders(
    <ExerciseLibraryPicker
      open={true}
      onOpenChange={vi.fn()}
      dayId="day-1"
      existingExerciseCount={0}
      onMutationStateChange={vi.fn()}
      {...overrides}
    />,
  )
}

describe("ExerciseLibraryPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseExerciseLibraryPaginated.mockImplementation(
      (params: {
        muscleGroup?: string | null
        equipment?: string[]
        difficulty?: string[]
      }) => paginatedReturn(params),
    )
  })

  it("renders all exercises grouped by muscle", () => {
    renderPicker()
    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.getByText("Élévations latérales")).toBeInTheDocument()
    expect(screen.getByText("Presse à cuisse")).toBeInTheDocument()
    expect(screen.getByText("Curls biceps inclinés")).toBeInTheDocument()
  })

  it("shows filter icon", () => {
    renderPicker()
    expect(screen.getByLabelText("Filters")).toBeInTheDocument()
  })

  it("shows filter panel when filter icon is clicked", async () => {
    renderPicker()
    const user = userEvent.setup()

    await user.click(screen.getByLabelText("Filters"))
    expect(screen.getByRole("button", { name: "Barbell" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Pectoraux" })).toBeInTheDocument()
  })

  it("filters by equipment when a pill is selected", async () => {
    renderPicker()
    const user = userEvent.setup()

    await user.click(screen.getByLabelText("Filters"))
    await user.click(screen.getByRole("button", { name: "Machine" }))

    expect(screen.getByText("Presse à cuisse")).toBeInTheDocument()
    expect(screen.queryByText("Développé couché")).not.toBeInTheDocument()
    expect(screen.queryByText("Élévations latérales")).not.toBeInTheDocument()
  })

  it("filters by muscle group when a pill is selected", async () => {
    renderPicker()
    const user = userEvent.setup()

    await user.click(screen.getByLabelText("Filters"))
    await user.click(screen.getByRole("button", { name: "Pectoraux" }))

    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.queryByText("Élévations latérales")).not.toBeInTheDocument()
    expect(screen.queryByText("Presse à cuisse")).not.toBeInTheDocument()
  })

  it("filters by difficulty when a pill is selected", async () => {
    renderPicker()
    const user = userEvent.setup()

    await user.click(screen.getByLabelText("Filters"))
    await user.click(screen.getByRole("button", { name: "Beginner" }))

    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.queryByText("Élévations latérales")).not.toBeInTheDocument()
    expect(screen.queryByText("Presse à cuisse")).not.toBeInTheDocument()
    expect(screen.queryByText("Curls biceps inclinés")).not.toBeInTheDocument()
  })

  it("includes difficulty in active filter count", async () => {
    renderPicker()
    const user = userEvent.setup()

    await user.click(screen.getByLabelText("Filters"))
    await user.click(screen.getByRole("button", { name: "Beginner" }))

    expect(screen.getByLabelText("Filters")).toHaveTextContent("1")
  })

  it("combines muscle group and equipment filters", async () => {
    const pectoralDumbbell = {
      ...EXERCISES[0],
      id: "5",
      name: "Écarté haltères",
      name_en: "Dumbbell Fly",
      equipment: "dumbbell",
    }
    mockUseExerciseLibraryPaginated.mockImplementation(
      (params: {
        muscleGroup?: string | null
        equipment?: string[]
        difficulty?: string[]
      }) => {
        if (
          params.muscleGroup === "Pectoraux" &&
          params.equipment?.includes("dumbbell")
        ) {
          return {
            data: [pectoralDumbbell],
            isLoading: false,
            isFetchingNextPage: false,
            hasNextPage: false,
            fetchNextPage: mockFetchNextPage,
          }
        }
        return paginatedReturn(params)
      },
    )

    renderPicker()
    const user = userEvent.setup()

    await user.click(screen.getByLabelText("Filters"))
    await user.click(screen.getByRole("button", { name: "Pectoraux" }))
    await user.click(screen.getByRole("button", { name: "Dumbbell" }))

    expect(screen.getByText("Écarté haltères")).toBeInTheDocument()
    expect(screen.queryByText("Développé couché")).not.toBeInTheDocument()
  })

  it("shows loading state", () => {
    mockUseExerciseLibraryPaginated.mockReturnValue({
      data: [] as Exercise[],
      isLoading: true,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
    })
    renderPicker()
    expect(screen.getByText("Add Exercise")).toBeInTheDocument()
  })

  it("shows empty state when no exercises match", () => {
    mockUseExerciseLibraryPaginated.mockReturnValue({
      data: [],
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
    })
    renderPicker()
    expect(screen.getByText("No exercises found.")).toBeInTheDocument()
  })

  it("shows Load more when hasNextPage and calls fetchNextPage on click", async () => {
    mockUseExerciseLibraryPaginated.mockReturnValue({
      data: EXERCISES,
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: true,
      fetchNextPage: mockFetchNextPage,
    })
    renderPicker()
    const loadMore = screen.getByRole("button", { name: /load more/i })
    expect(loadMore).toBeInTheDocument()
    await userEvent.setup().click(loadMore)
    expect(mockFetchNextPage).toHaveBeenCalledTimes(1)
  })

  it("adds one exercise when one checkbox selected and Apply changes clicked", async () => {
    renderPicker()
    const user = userEvent.setup()
    const checkboxes = screen.getAllByRole("checkbox", { name: "Add" })
    await user.click(checkboxes[0])
    await user.click(screen.getByRole("button", { name: "Apply changes" }))
    expect(mockAddExercisesMutateAsync).toHaveBeenCalledTimes(1)
    const [vars] = mockAddExercisesMutateAsync.mock.calls[0]
    expect(vars.exercises).toHaveLength(1)
    expect(vars).toMatchObject({ dayId: "day-1", startSortOrder: 0 })
  })

  it("does not add exercise when row text is clicked", async () => {
    renderPicker()
    const user = userEvent.setup()
    await user.click(screen.getByText("Développé couché"))
    expect(mockAddExercisesMutateAsync).not.toHaveBeenCalled()
  })

  it("shows Apply changes button and batch-adds when checkboxes selected", async () => {
    renderPicker()
    const user = userEvent.setup()
    const checkboxes = screen.getAllByRole("checkbox")
    expect(checkboxes.length).toBeGreaterThanOrEqual(2)
    await user.click(checkboxes[0])
    await user.click(checkboxes[1])
    expect(screen.getByRole("button", { name: "Apply changes" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Apply changes" }))
    expect(mockAddExercisesMutateAsync).toHaveBeenCalledTimes(1)
    const [vars] = mockAddExercisesMutateAsync.mock.calls[0]
    expect(vars).toMatchObject({
      dayId: "day-1",
      startSortOrder: 0,
    })
    expect(Array.isArray(vars.exercises)).toBe(true)
    expect(vars.exercises).toHaveLength(2)
  })

  it("pre-checks exercises already in the day", async () => {
    renderPicker({
      existingExercises: [{ exercise_id: "1", id: "we-1" }],
    })
    const checked = await screen.findByRole("checkbox", { checked: true })
    expect(checked).toBeInTheDocument()
  })

  it("calls delete when existing exercise is unchecked and Apply changes clicked", async () => {
    renderPicker({
      existingExerciseCount: 1,
      existingExercises: [{ exercise_id: "1", id: "we-1" }],
    })
    const user = userEvent.setup()
    const checked = screen.getByRole("checkbox", { checked: true })
    await user.click(checked)
    await user.click(screen.getByRole("button", { name: "Apply changes" }))
    expect(mockDeleteExerciseMutateAsync).toHaveBeenCalledWith({ id: "we-1", dayId: "day-1" })
  })
})
