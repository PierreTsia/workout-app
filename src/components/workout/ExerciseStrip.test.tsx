import { describe, expect, it, vi } from "vitest"
import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { sessionAtom, prFlagsAtom } from "@/store/atoms"
import type {
  Exercise,
  ExerciseBlockWithExercises,
  WorkoutExerciseWithLabel,
} from "@/types/database"
import type { SessionItem } from "@/lib/sessionItems"
import { ExerciseStrip } from "./ExerciseStrip"

/** Strip tests only assert labels/overlays; thumbnails use snapshots without library rows. */
const emptyLibraryById: ReadonlyMap<string, Exercise> = new Map()

const soloItems = (exercises: WorkoutExerciseWithLabel[]): SessionItem[] =>
  exercises.map((exercise) => ({
    kind: "solo",
    sort_order: exercise.sort_order,
    exercise,
  }))

const EXERCISES: WorkoutExerciseWithLabel[] = [
  {
    id: "ex-1",
    workout_day_id: "day-1",
    exercise_id: "lib-1",
    exercise: null,
    name_snapshot: "Bench Press",
    muscle_snapshot: "chest",
    emoji_snapshot: "🏋️",
    sets: 3,
    reps: "10",
    weight: "60",
    rest_seconds: 90,
    sort_order: 0,
    rep_range_min: 8,
    rep_range_max: 12,
    set_range_min: 2,
    set_range_max: 5,
    weight_increment: null,
    max_weight_reached: false,
    template_updated_at: "2020-01-01T00:00:00Z",
  },
  {
    id: "ex-2",
    workout_day_id: "day-1",
    exercise_id: "lib-2",
    exercise: null,
    name_snapshot: "Squat",
    muscle_snapshot: "legs",
    emoji_snapshot: "🦵",
    sets: 3,
    reps: "8",
    weight: "80",
    rest_seconds: 120,
    sort_order: 1,
    rep_range_min: 8,
    rep_range_max: 12,
    set_range_min: 2,
    set_range_max: 5,
    weight_increment: null,
    max_weight_reached: false,
    template_updated_at: "2020-01-01T00:00:00Z",
  },
  {
    id: "ex-3",
    workout_day_id: "day-1",
    exercise_id: "lib-3",
    exercise: null,
    name_snapshot: "Deadlift",
    muscle_snapshot: "back",
    emoji_snapshot: "💪",
    sets: 3,
    reps: "5",
    weight: "100",
    rest_seconds: 180,
    sort_order: 2,
    rep_range_min: 8,
    rep_range_max: 12,
    set_range_min: 2,
    set_range_max: 5,
    weight_increment: null,
    max_weight_reached: false,
    template_updated_at: "2020-01-01T00:00:00Z",
  },
]

describe("ExerciseStrip — locale", () => {
  const localized = (): WorkoutExerciseWithLabel => ({
    ...EXERCISES[0],
    name_snapshot: "Développé couché",
    exercise: {
      id: "lib-1",
      name: "Développé couché",
      name_en: "Bench Press",
      muscle_group: "Pectoraux",
      equipment: "barbell",
      emoji: "💪",
    },
  })

  const renderStrip = (
    exercise: WorkoutExerciseWithLabel,
    locale: "en" | "fr",
  ) =>
    renderWithProviders(
      <ExerciseStrip
        items={soloItems([exercise])}
        libraryById={emptyLibraryById}
        activeIndex={0}
        onSelectIndex={() => {}}
      />,
      { locale },
    )

  it("labels the active slot in English for an English reader", () => {
    renderStrip(localized(), "en")

    expect(screen.getByText("Bench Press")).toBeInTheDocument()
  })

  it("keeps the French label for a French reader", () => {
    renderStrip(localized(), "fr")

    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument()
  })

  it("falls back to the snapshot when the row carries no catalog embed", () => {
    renderStrip({ ...EXERCISES[0], name_snapshot: "Rowing barre" }, "en")

    expect(screen.getByText("Rowing barre")).toBeInTheDocument()
  })
})

describe("ExerciseStrip", () => {
  it("renders all exercise names", () => {
    renderWithProviders(
      <ExerciseStrip
        items={soloItems(EXERCISES)}
        libraryById={emptyLibraryById}
        activeIndex={0}
        onSelectIndex={() => {}}
      />,
    )

    expect(screen.getByText("Bench Press")).toBeInTheDocument()
    expect(screen.getByText("Squat")).toBeInTheDocument()
    expect(screen.getByText("Deadlift")).toBeInTheDocument()
  })

  it("shows PR badge when exercise has PR flag", () => {
    const { store } = renderWithProviders(
      <ExerciseStrip
        items={soloItems(EXERCISES)}
        libraryById={emptyLibraryById}
        activeIndex={0}
        onSelectIndex={() => {}}
      />,
    )

    act(() => {
      store.set(prFlagsAtom, { "lib-1": true })
    })

    expect(screen.getByText("🏆")).toBeInTheDocument()
  })

  it("shows checkmark overlay when exercise is completed", () => {
    const { store } = renderWithProviders(
      <ExerciseStrip
        items={soloItems(EXERCISES)}
        libraryById={emptyLibraryById}
        activeIndex={1}
        onSelectIndex={() => {}}
      />,
    )

    act(() => {
      store.set(sessionAtom, {
        currentDayId: "day-1",
        activeDayId: "day-1",
        exerciseIndex: 1,
        setsData: {
          "ex-1": [
            { kind: "reps", reps: "10", weight: "60", done: true },
            { kind: "reps", reps: "10", weight: "60", done: true },
            { kind: "reps", reps: "10", weight: "60", done: true },
          ],
        },
        startedAt: Date.now(),
        isActive: true,
        totalSetsDone: 3,
        pausedAt: null,
        accumulatedPause: 0,
        cycleId: null,
      })
    })

    const checkIcon = document.querySelector('[class*="lucide-check"]')
    expect(checkIcon).toBeInTheDocument()
  })

  it("does not show checkmark when exercise has incomplete sets", () => {
    const { store } = renderWithProviders(
      <ExerciseStrip
        items={soloItems(EXERCISES)}
        libraryById={emptyLibraryById}
        activeIndex={0}
        onSelectIndex={() => {}}
      />,
    )

    act(() => {
      store.set(sessionAtom, {
        currentDayId: "day-1",
        activeDayId: "day-1",
        exerciseIndex: 0,
        setsData: {
          "ex-1": [
            { kind: "reps", reps: "10", weight: "60", done: true },
            { kind: "reps", reps: "10", weight: "60", done: false },
            { kind: "reps", reps: "10", weight: "60", done: false },
          ],
        },
        startedAt: Date.now(),
        isActive: true,
        totalSetsDone: 1,
        pausedAt: null,
        accumulatedPause: 0,
        cycleId: null,
      })
    })

    const checkIcon = document.querySelector('[class*="lucide-check"]')
    expect(checkIcon).not.toBeInTheDocument()
  })

  it("shows multiple checkmarks for multiple completed exercises", () => {
    const { store } = renderWithProviders(
      <ExerciseStrip
        items={soloItems(EXERCISES)}
        libraryById={emptyLibraryById}
        activeIndex={2}
        onSelectIndex={() => {}}
      />,
    )

    act(() => {
      store.set(sessionAtom, {
        currentDayId: "day-1",
        activeDayId: "day-1",
        exerciseIndex: 2,
        setsData: {
          "ex-1": [
            { kind: "reps", reps: "10", weight: "60", done: true },
            { kind: "reps", reps: "10", weight: "60", done: true },
            { kind: "reps", reps: "10", weight: "60", done: true },
          ],
          "ex-2": [
            { kind: "reps", reps: "8", weight: "80", done: true },
            { kind: "reps", reps: "8", weight: "80", done: true },
            { kind: "reps", reps: "8", weight: "80", done: true },
          ],
        },
        startedAt: Date.now(),
        isActive: true,
        totalSetsDone: 6,
        pausedAt: null,
        accumulatedPause: 0,
        cycleId: null,
      })
    })

    const checkIcons = document.querySelectorAll('[class*="lucide-check"]')
    expect(checkIcons).toHaveLength(2)
  })

  it("renders a block item inline and reports its index on click", async () => {
    const user = userEvent.setup()
    const onSelectIndex = vi.fn()
    const blockItem: ExerciseBlockWithExercises = {
      id: "blk-1",
      workout_day_id: "day-1",
      label: "Finisher circuit",
      rounds: 4,
      rest_seconds: 60,
      transition_seconds: 0,
      sort_order: 1,
      created_at: "2020-01-01",
      exercises: [],
    }
    const items: SessionItem[] = [
      { kind: "solo", sort_order: 0, exercise: EXERCISES[0] },
      { kind: "block", sort_order: 1, block: blockItem },
      { kind: "solo", sort_order: 2, exercise: EXERCISES[1] },
    ]
    renderWithProviders(
      <ExerciseStrip
        items={items}
        libraryById={emptyLibraryById}
        activeIndex={0}
        onSelectIndex={onSelectIndex}
      />,
    )

    expect(screen.getByText("Finisher circuit")).toBeInTheDocument()
    expect(screen.getByTestId("strip-block-item")).toBeInTheDocument()

    await user.click(screen.getByText("Finisher circuit"))
    expect(onSelectIndex).toHaveBeenCalledWith(1)
  })

  it("shows a checkmark on a completed block item", () => {
    const blockItem: ExerciseBlockWithExercises = {
      id: "blk-1",
      workout_day_id: "day-1",
      label: "Done circuit",
      rounds: 2,
      rest_seconds: 0,
      transition_seconds: 0,
      sort_order: 1,
      created_at: "2020-01-01",
      exercises: [],
    }
    const items: SessionItem[] = [
      { kind: "solo", sort_order: 0, exercise: EXERCISES[0] },
      { kind: "block", sort_order: 1, block: blockItem },
    ]
    const { store } = renderWithProviders(
      <ExerciseStrip
        items={items}
        libraryById={emptyLibraryById}
        activeIndex={0}
        onSelectIndex={() => {}}
      />,
    )

    expect(
      document.querySelector('[class*="lucide-check"]'),
    ).not.toBeInTheDocument()

    act(() => {
      store.set(sessionAtom, {
        currentDayId: "day-1",
        activeDayId: "day-1",
        exerciseIndex: 0,
        setsData: {},
        startedAt: Date.now(),
        isActive: true,
        totalSetsDone: 0,
        pausedAt: null,
        accumulatedPause: 0,
        cycleId: null,
        completedBlockIds: ["blk-1"],
      })
    })

    expect(document.querySelector('[class*="lucide-check"]')).toBeInTheDocument()
  })

  it("calls onSelectIndex when clicking an exercise", async () => {
    const user = userEvent.setup()
    const onSelectIndex = vi.fn()
    renderWithProviders(
      <ExerciseStrip
        items={soloItems(EXERCISES)}
        libraryById={emptyLibraryById}
        activeIndex={0}
        onSelectIndex={onSelectIndex}
      />,
    )

    await user.click(screen.getByText("Squat"))

    expect(onSelectIndex).toHaveBeenCalledWith(1)
  })
})
