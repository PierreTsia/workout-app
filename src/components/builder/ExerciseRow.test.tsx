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

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => true,
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
    onDelete?: () => void
    onMutationStateChange?: (state: "saving" | "saved" | "error") => void
  } = {},
) {
  const {
    locale,
    onDelete = vi.fn(),
    onMutationStateChange = vi.fn(),
  } = options
  return renderWithProviders(
    <ExerciseRow
      exercise={exercise}
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

  it("renders the catalog illustration from the slot embed, not the emoji", () => {
    render(
      makeExercise({
        emoji_snapshot: "🦅",
        exercise: catalogRow({ image_url: "papillon.webp", emoji: "🦅" }),
      }),
    )

    const thumb = document.querySelector("img")
    expect(thumb).toHaveAttribute(
      "src",
      expect.stringContaining("papillon.webp"),
    )
    expect(screen.queryByText("🦅")).not.toBeInTheDocument()
  })

  it("keeps Sets / Reps / unit / Rest visible above the values", () => {
    render(makeExercise())

    const setsLegend = screen.getByText("Sets")
    expect(setsLegend).toBeVisible()
    expect(setsLegend).not.toHaveClass("sr-only")
    expect(screen.getByText("Reps")).toBeVisible()
    expect(screen.getByText("kg")).toBeVisible()
    expect(screen.getByText("Rest")).toBeVisible()
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

  it("saves sets from the row without opening leftover fields", async () => {
    const user = userEvent.setup()

    render(makeExercise({ sets: 4 }))

    const sets = screen.getByRole("spinbutton", { name: "Sets" })
    await user.clear(sets)
    await user.type(sets, "5")

    expect(screen.queryByText("Progression settings")).not.toBeInTheDocument()

    await waitFor(() =>
      expect(mutate.mock.calls.at(-1)?.[0]).toMatchObject({
        id: "ex-1",
        dayId: "day-1",
        sets: 5,
      }),
    )
    expect(screen.queryByText("Progression settings")).not.toBeInTheDocument()
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

  it("does not navigate on name click; leftover fields open from overflow", async () => {
    const user = userEvent.setup()
    render(makeExercise())

    await user.click(screen.getByText("Bench Press"))

    expect(
      screen.queryByRole("button", { name: "More actions" }),
    ).toBeInTheDocument()
    expect(screen.queryByText("Progression settings")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "More actions" }))
    await user.click(
      screen.getByRole("menuitem", { name: "Ranges and instructions" }),
    )

    expect(screen.getByText("Progression settings")).toBeInTheDocument()
    expect(screen.getByRole("spinbutton", { name: "Min reps" })).toBeInTheDocument()
    expect(
      screen.queryByRole("spinbutton", { name: "Sets" }),
    ).not.toBeInTheDocument()
  })

  it("opens remove from overflow instead of a trash button", async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(makeExercise(), { onDelete })

    expect(document.querySelector(".lucide-trash-2")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "More actions" }))
    await user.click(screen.getByRole("menuitem", { name: "Remove" }))

    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it("puts the admin catalog link in the overflow menu only", async () => {
    const user = userEvent.setup()
    const { store } = render(makeExercise())
    act(() => {
      store.set(isAdminAtom, true)
    })

    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(document.querySelector(".lucide-pencil")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "More actions" }))
    const catalogLink = screen.getByRole("menuitem", { name: "Edit in admin" })
    expect(catalogLink).toHaveAttribute("href", "/admin/exercises/lib-1")
  })

  it("hides the catalog link from non-admins", async () => {
    const user = userEvent.setup()
    render(makeExercise())

    await user.click(screen.getByRole("button", { name: "More actions" }))

    expect(
      screen.queryByRole("menuitem", { name: "Edit in admin" }),
    ).not.toBeInTheDocument()
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
    expect(
      screen.getByRole("button", { name: "Plus d'actions" }),
    ).toBeInTheDocument()
  })
})
