import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders, mockQueryResult } from "@/test/utils"
import type {
  DayItem,
  Exercise,
  ExerciseBlockWithExercises,
  WorkoutExerciseWithExercise,
} from "@/types/database"
import type { WorkoutDayWithExerciseCount } from "@/hooks/useWorkoutDays"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

vi.mock("react-body-highlighter", () => ({
  default: ({
    type,
    style,
  }: {
    type: string
    style?: { maxWidth?: string }
  }) => (
    <div
      data-testid={`body-model-${type}`}
      data-max-width={style?.maxWidth}
    />
  ),
  MuscleType: {},
  ModelType: { ANTERIOR: "anterior", POSTERIOR: "posterior" },
}))

vi.mock("./ExerciseLibraryPicker", () => ({
  ExerciseLibraryPicker: () => null,
}))

vi.mock("./BlockEditor", () => ({
  BlockEditor: ({ open }: { open: boolean }) =>
    open ? <div>block editor</div> : null,
}))

const useWorkoutDays = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/useWorkoutDays", () => ({ useWorkoutDays }))

const useDayItems = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/useDayItems", () => ({ useDayItems }))

const idleMutation = vi.hoisted(() => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
}))

vi.mock("@/hooks/useBuilderMutations", () => ({
  useUpdateDay: () => idleMutation,
  useDeleteExercise: () => idleMutation,
  useReorderExercises: () => idleMutation,
  useUpdateExercise: () => idleMutation,
}))

vi.mock("@/hooks/useBlockMutations", () => ({
  useCreateBlock: () => idleMutation,
  useReorderBlocks: () => idleMutation,
  useDeleteBlock: () => idleMutation,
}))

vi.mock("@/hooks/useExerciseFromLibrary", () => ({
  useExerciseFromLibrary: () => ({ data: undefined }),
}))

import { DayEditor } from "./DayEditor"

function makeCatalog(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-1",
    name: "Développé couché",
    name_en: "Bench Press",
    muscle_group: "Pectoraux",
    emoji: "💪",
    is_system: true,
    created_at: "1970-01-01T00:00:00Z",
    youtube_url: null,
    instructions: null,
    image_url: null,
    equipment: "barbell",
    difficulty_level: "intermediate",
    source: null,
    secondary_muscles: ["Triceps"],
    reviewed_at: null,
    reviewed_by: null,
    measurement_type: "reps",
    default_duration_seconds: null,
    ...overrides,
  }
}

function makeSolo(
  overrides: Partial<WorkoutExerciseWithExercise> = {},
): WorkoutExerciseWithExercise {
  return {
    id: "solo-1",
    workout_day_id: "day-1",
    exercise_id: "ex-1",
    name_snapshot: "Bench",
    muscle_snapshot: "Pectoraux",
    emoji_snapshot: "💪",
    sets: 4,
    reps: "8-12",
    weight: "60",
    rest_seconds: 90,
    sort_order: 0,
    template_updated_at: "1970-01-01T00:00:00Z",
    exercise: makeCatalog(),
    ...overrides,
  }
}

function makeBlock(
  overrides: Partial<ExerciseBlockWithExercises> = {},
): ExerciseBlockWithExercises {
  return {
    id: "b-1",
    workout_day_id: "day-1",
    label: "Metcon",
    rounds: 3,
    rest_seconds: 90,
    transition_seconds: 0,
    mode: "rounds",
    cap_seconds: null,
    sort_order: 1,
    created_at: "1970-01-01T00:00:00Z",
    exercises: [
      {
        id: "be-1",
        block_id: "b-1",
        exercise_id: "ex-2",
        name_snapshot: "Burpee",
        muscle_snapshot: "full",
        emoji_snapshot: "🔥",
        position: 0,
        per_round: [{ amount: 10, weight: 0 }],
        exercise: null,
      },
    ],
    ...overrides,
  }
}

function makeDay(): WorkoutDayWithExerciseCount {
  return {
    id: "day-1",
    user_id: "user-1",
    program_id: "prog-1",
    label: "Push A",
    emoji: "🔥",
    sort_order: 0,
    created_at: "1970-01-01T00:00:00Z",
    saved_at: null,
    exerciseCount: 1,
  }
}

function stubEditor(items: DayItem[]) {
  useWorkoutDays.mockReturnValue(mockQueryResult([makeDay()]))
  useDayItems.mockReturnValue({ items, isLoading: false })
}

function renderEditor() {
  return renderWithProviders(
    <DayEditor
      programId="prog-1"
      dayId="day-1"
      onMutationStateChange={vi.fn()}
    />,
  )
}

describe("DayEditor intent map", () => {
  it("shows a live Body Map when the day has at least one slot", () => {
    stubEditor([
      { kind: "solo", sort_order: 0, exercise: makeSolo() },
    ])

    renderEditor()

    const anterior = screen.getByTestId("body-model-anterior")
    expect(anterior).toBeInTheDocument()
    expect(anterior).toHaveAttribute("data-max-width", "140px")
    expect(screen.getByText("Chest")).toBeInTheDocument()
  })

  it("hides the map and shows the empty copy when the day has no slots", () => {
    stubEditor([])

    renderEditor()

    expect(screen.queryByTestId("body-model-anterior")).not.toBeInTheDocument()
    expect(screen.queryByText("Chest")).not.toBeInTheDocument()
    expect(screen.getByText("Nothing on this day yet.")).toBeInTheDocument()
  })
})

describe("DayEditor overflow", () => {
  it("opens the existing remove-exercise confirm from ⋯", async () => {
    idleMutation.mutate.mockClear()
    stubEditor([{ kind: "solo", sort_order: 0, exercise: makeSolo() }])
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole("button", { name: "More actions" }))
    await user.click(screen.getByRole("menuitem", { name: "Remove" }))

    expect(
      screen.getByRole("heading", { name: "Remove exercise?" }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Remove" }))
    expect(idleMutation.mutate).toHaveBeenCalledWith(
      { id: "solo-1", dayId: "day-1" },
      expect.any(Object),
    )
  })

  it("opens BlockEditor from ⋯ Edit circuit", async () => {
    stubEditor([{ kind: "block", sort_order: 0, block: makeBlock() }])
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole("button", { name: "More actions" }))
    await user.click(screen.getByRole("menuitem", { name: "Edit circuit" }))

    expect(screen.getByText("block editor")).toBeInTheDocument()
  })
})
