import { vi, describe, it, expect, beforeEach } from "vitest"
import { screen, waitFor, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders, type TestLocale } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import { ExerciseTab } from "./ExerciseTab"

const selectFn = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn(() => ({ select: selectFn })) },
}))

const fetchExercisesByIds = vi.hoisted(() => vi.fn())
vi.mock("@/lib/fetchExercisesByIds", () => ({ fetchExercisesByIds }))

vi.mock("@/components/history/ExerciseChart", () => ({
  ExerciseChart: () => <div>chart</div>,
}))

function renderTab(locale: TestLocale) {
  const rendered = renderWithProviders(<ExerciseTab />, { locale })
  act(() => {
    rendered.store.set(authAtom, { id: "user-1" } as never)
  })
  return rendered
}

describe("ExerciseTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectFn.mockResolvedValue({
      data: [{ exercise_id: "a", exercise_name_snapshot: "Développé couché" }],
      error: null,
    })
    fetchExercisesByIds.mockResolvedValue([
      {
        id: "a",
        name: "Développé couché",
        name_en: "Bench Press",
        muscle_group: "Pectoraux",
        equipment: "barbell",
        emoji: "🏋️",
      },
    ])
  })

  it("filters on the label it displays, not on the snapshot", async () => {
    renderTab("en")

    await userEvent.click(screen.getByRole("combobox"))
    await waitFor(() =>
      expect(screen.getByText("Bench Press")).toBeInTheDocument(),
    )

    // The snapshot is French; typing what's on screen has to find the row.
    await userEvent.type(
      screen.getByPlaceholderText("Search exercises…"),
      "Bench",
    )

    expect(screen.getByText("Bench Press")).toBeInTheDocument()
  })

  it("shows the French label to a French reader", async () => {
    renderTab("fr")

    await userEvent.click(screen.getByRole("combobox"))

    await waitFor(() =>
      expect(screen.getByText("Développé couché")).toBeInTheDocument(),
    )
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument()
  })
})
