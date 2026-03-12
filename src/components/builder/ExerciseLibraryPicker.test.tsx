import { vi, describe, it, expect, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import type { Exercise } from "@/types/database"
import { ExerciseLibraryPicker } from "./ExerciseLibraryPicker"

const EXERCISES: Exercise[] = [
  {
    id: "1",
    name: "Développé couché",
    name_en: "Bench Press",
    muscle_group: "Pectoraux",
    equipment: "barbell",
    emoji: "🏋️",
    is_system: true,
    created_at: "2025-01-01T00:00:00Z",
    youtube_url: null,
    instructions: null,
    image_url: null,
    source: "wger:73",
    secondary_muscles: null,
  },
  {
    id: "2",
    name: "Élévations latérales",
    name_en: "Lateral Raises",
    muscle_group: "Épaules",
    equipment: "dumbbell",
    emoji: "🙆",
    is_system: true,
    created_at: "2025-01-01T00:00:00Z",
    youtube_url: null,
    instructions: null,
    image_url: null,
    source: "wger:348",
    secondary_muscles: null,
  },
  {
    id: "3",
    name: "Presse à cuisse",
    name_en: "Leg Press",
    muscle_group: "Quadriceps",
    equipment: "machine",
    emoji: "🦵",
    is_system: true,
    created_at: "2025-01-01T00:00:00Z",
    youtube_url: null,
    instructions: null,
    image_url: null,
    source: "wger:371",
    secondary_muscles: null,
  },
  {
    id: "4",
    name: "Curls biceps inclinés",
    name_en: "Dumbbell Incline Curl",
    muscle_group: "Biceps",
    equipment: "dumbbell",
    emoji: "💪",
    is_system: true,
    created_at: "2025-01-01T00:00:00Z",
    youtube_url: null,
    instructions: null,
    image_url: null,
    source: "wger:204",
    secondary_muscles: null,
  },
]

const mockUseExerciseLibrary = vi.fn(() => ({
  data: EXERCISES,
  isLoading: false,
}))

const mockMutate = vi.fn()
const mockUseAddExerciseToDay = vi.fn(() => ({
  mutate: mockMutate,
  isPending: false,
}))

vi.mock("@/hooks/useExerciseLibrary", () => ({
  useExerciseLibrary: () => mockUseExerciseLibrary(),
}))

vi.mock("@/hooks/useBuilderMutations", () => ({
  useAddExerciseToDay: () => mockUseAddExerciseToDay(),
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
    mockUseExerciseLibrary.mockReturnValue({
      data: EXERCISES,
      isLoading: false,
    })
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

  it("combines muscle group and equipment filters", async () => {
    const allExercises = [
      ...EXERCISES,
      {
        ...EXERCISES[0],
        id: "5",
        name: "Écarté haltères",
        name_en: "Dumbbell Fly",
        equipment: "dumbbell",
      },
    ]
    mockUseExerciseLibrary.mockReturnValue({
      data: allExercises,
      isLoading: false,
    })

    renderPicker()
    const user = userEvent.setup()

    await user.click(screen.getByLabelText("Filters"))
    await user.click(screen.getByRole("button", { name: "Pectoraux" }))
    await user.click(screen.getByRole("button", { name: "Dumbbell" }))

    expect(screen.getByText("Écarté haltères")).toBeInTheDocument()
    expect(screen.queryByText("Développé couché")).not.toBeInTheDocument()
  })

  it("shows loading state", () => {
    mockUseExerciseLibrary.mockReturnValue({ data: [] as Exercise[], isLoading: true })
    renderPicker()
    expect(screen.getByText("Add Exercise")).toBeInTheDocument()
  })

  it("shows empty state when no exercises match", () => {
    mockUseExerciseLibrary.mockReturnValue({ data: [], isLoading: false })
    renderPicker()
    expect(screen.getByText("No exercises found.")).toBeInTheDocument()
  })
})
