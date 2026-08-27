import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { screen, waitFor, fireEvent, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { isAdminAtom } from "@/store/atoms"
import type { Exercise, WorkoutExerciseWithExercise } from "@/types/database"
import { ExerciseRow } from "./ExerciseRow"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

const mutate = vi.fn()
vi.mock("@/hooks/useBuilderMutations", () => ({
  useUpdateExercise: () => ({ mutate }),
}))

let mockLibExercise: Exercise | undefined
vi.mock("@/hooks/useExerciseFromLibrary", () => ({
  useExerciseFromLibrary: () => ({ data: mockLibExercise, isLoading: false }),
}))

const catalogRow = (overrides: Partial<Exercise> = {}) =>
  ({
    id: "lib-1",
    name: "Développé couché",
    name_en: "Bench Press",
    muscle_group: "Pectoraux",
    equipment: "barbell",
    emoji: "💪",
    ...overrides,
  }) as Exercise

function makeExercise(
  overrides: Partial<WorkoutExerciseWithExercise> = {},
): WorkoutExerciseWithExercise {
  return {
    exercise: null,
    id: "ex-1",
    workout_day_id: "day-1",
    exercise_id: "lib-1",
    name_snapshot: "Bench Press",
    muscle_snapshot: "Chest",
    emoji_snapshot: "💪",
    sets: 4,
    reps: "8-12",
    weight: "60",
    rest_seconds: 90,
    sort_order: 0,
    target_duration_seconds: null,
    template_updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function render(
  exercise: WorkoutExerciseWithExercise,
  options: {
    locale?: "en" | "fr"
    onTap?: () => void
    onDelete?: () => void
    onMutationStateChange?: (state: "saving" | "saved" | "error") => void
  } = {},
) {
  const {
    locale,
    onTap = vi.fn(),
    onDelete = vi.fn(),
    onMutationStateChange = vi.fn(),
  } = options
  return renderWithProviders(
    <ExerciseRow
      exercise={exercise}
      onTap={onTap}
      onDelete={onDelete}
      onMutationStateChange={onMutationStateChange}
    />,
    { locale },
  )
}

describe("ExerciseRow", () => {
  beforeEach(() => {
    mutate.mockReset()
    mockLibExercise = undefined
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("displays the rest time", () => {
    render(makeExercise({ rest_seconds: 90 }))

    expect(screen.getByRole("spinbutton", { name: "Rest" })).toHaveValue(90)
  })

  it("shows the English catalog name to an English reader", () => {
    render(
      makeExercise({ name_snapshot: "Développé couché", exercise: catalogRow() }),
      { locale: "en" },
    )

    expect(screen.getByText("Bench Press")).toBeInTheDocument()
  })

  it("shows the French catalog name to a French reader", () => {
    render(
      makeExercise({ name_snapshot: "Développé couché", exercise: catalogRow() }),
      { locale: "fr" },
    )

    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument()
  })

  it("falls back to the catalog name in both locales when name_en is missing", () => {
    const exercise = makeExercise({
      name_snapshot: "Gainage latéral",
      exercise: catalogRow({ name: "Gainage latéral", name_en: null }),
    })

    render(exercise, { locale: "en" })
    expect(screen.getByText("Gainage latéral")).toBeInTheDocument()
  })

  it("falls back to the snapshot when the catalog row is absent", () => {
    render(makeExercise({ name_snapshot: "Exercice supprimé" }), { locale: "en" })

    expect(screen.getByText("Exercice supprimé")).toBeInTheDocument()
  })

  it("saves sets from the row without opening detail", async () => {
    const user = userEvent.setup()
    const onTap = vi.fn()

    render(makeExercise({ sets: 4 }), { onTap })

    const sets = screen.getByRole("spinbutton", { name: "Sets" })
    await user.clear(sets)
    await user.type(sets, "5")

    expect(onTap).not.toHaveBeenCalled()

    await waitFor(() =>
      expect(mutate.mock.calls.at(-1)?.[0]).toMatchObject({
        id: "ex-1",
        dayId: "day-1",
        sets: 5,
      }),
    )
    expect(onTap).not.toHaveBeenCalled()
  })

  it("shows a hold field instead of reps for duration exercises", () => {
    mockLibExercise = catalogRow({ measurement_type: "duration" })

    render(makeExercise({ target_duration_seconds: 45 }))

    expect(screen.getByRole("spinbutton", { name: "Hold" })).toHaveValue(45)
    expect(screen.queryByRole("textbox", { name: "Reps" })).not.toBeInTheDocument()
  })

  it("patches rest as seconds without writing template_updated_at", async () => {
    const user = userEvent.setup()

    render(makeExercise({ rest_seconds: 90 }))

    const rest = screen.getByRole("spinbutton", { name: "Rest" })
    await user.clear(rest)
    await user.type(rest, "120")

    await waitFor(() => expect(mutate).toHaveBeenCalled())
    const payload = mutate.mock.calls.at(-1)?.[0]
    expect(payload).toEqual({
      id: "ex-1",
      dayId: "day-1",
      rest_seconds: 120,
    })
    expect(payload).not.toHaveProperty("template_updated_at")
  })

  it("flushes a pending debounce once on unmount", () => {
    const { unmount } = render(makeExercise({ rest_seconds: 90 }))

    fireEvent.change(screen.getByRole("spinbutton", { name: "Rest" }), {
      target: { value: "120" },
    })
    expect(mutate).not.toHaveBeenCalled()

    unmount()

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate.mock.calls[0]?.[0]).toEqual({
      id: "ex-1",
      dayId: "day-1",
      rest_seconds: 120,
    })
  })

  it("waits 500ms before saving an inline edit", () => {
    vi.useFakeTimers()
    render(makeExercise({ sets: 4 }))

    fireEvent.change(screen.getByRole("spinbutton", { name: "Sets" }), {
      target: { value: "5" },
    })

    vi.advanceTimersByTime(499)
    expect(mutate).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(mutate).toHaveBeenCalledTimes(1)
  })

  it("still opens detail when tapping the name", async () => {
    const user = userEvent.setup()
    const onTap = vi.fn()
    render(makeExercise(), { onTap })

    await user.click(screen.getByText("Bench Press"))

    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it("keeps the admin pencil and trash on the row", () => {
    const { store } = render(makeExercise())
    act(() => {
      store.set(isAdminAtom, true)
    })

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/admin/exercises/lib-1",
    )
    expect(document.querySelector(".lucide-pencil")).toBeInTheDocument()
    expect(document.querySelector(".lucide-trash-2")).toBeInTheDocument()
  })

  it("keeps the typed value and reports error when the mutation fails", async () => {
    mutate.mockImplementation(
      (
        _vars: unknown,
        callbacks?: { onError?: (error: Error) => void },
      ) => {
        callbacks?.onError?.(new Error("sync failed"))
      },
    )
    const onMutationStateChange = vi.fn()
    const user = userEvent.setup()
    render(makeExercise({ sets: 4 }), { onMutationStateChange })

    const sets = screen.getByRole("spinbutton", { name: "Sets" })
    await user.clear(sets)
    await user.type(sets, "5")

    await waitFor(() =>
      expect(onMutationStateChange).toHaveBeenCalledWith("error"),
    )
    expect(sets).toHaveValue(5)
  })

  it("labels rest and hold in French", () => {
    mockLibExercise = catalogRow({ measurement_type: "duration" })
    render(makeExercise({ target_duration_seconds: 30 }), { locale: "fr" })

    expect(screen.getByRole("spinbutton", { name: "Repos" })).toBeInTheDocument()
    expect(screen.getByRole("spinbutton", { name: "Tenue" })).toBeInTheDocument()
  })
})
