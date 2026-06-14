import { vi, describe, it, expect, beforeEach } from "vitest"
import { screen, within } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import type { Exercise, SetLog } from "@/types/database"
import { ExerciseChart } from "./ExerciseChart"

const mockUseExerciseById = vi.fn<
  (id: string) => { data: Exercise | undefined | null; isLoading: boolean }
>()
vi.mock("@/hooks/useExerciseById", () => ({
  useExerciseById: (id: string | null) => mockUseExerciseById(id ?? ""),
}))

const mockUseExerciseTrend = vi.fn<
  (id: string) => { data: SetLog[] | undefined; isLoading: boolean }
>()
vi.mock("@/hooks/useExerciseTrend", () => ({
  useExerciseTrend: (id: string | null) => mockUseExerciseTrend(id ?? ""),
}))

vi.mock("@/hooks/useWeightUnit", () => ({
  useWeightUnit: () => ({
    unit: "kg",
    setUnit: vi.fn(),
    toKg: (v: number) => v,
    toDisplay: (kg: number) => kg,
    formatWeight: (kg: number) => `${kg} kg`,
  }),
}))

const BASE_EXERCISE: Exercise = {
  id: "ex-1",
  name: "Bench Press",
  muscle_group: "chest",
  emoji: "🏋️",
  is_system: true,
  created_at: "2025-01-01T00:00:00Z",
  youtube_url: null,
  instructions: null,
  image_url: null,
  equipment: "barbell",
  difficulty_level: null,
  name_en: "Bench Press",
  source: null,
  secondary_muscles: null,
  reviewed_at: null,
  reviewed_by: null,
}

let logIdCounter = 0
function makeLog(overrides: Partial<SetLog> = {}): SetLog {
  logIdCounter += 1
  return {
    id: `log-${logIdCounter}`,
    session_id: "session-1",
    exercise_id: "ex-1",
    block_exercise_id: null,
    exercise_name_snapshot: "Bench Press",
    set_number: 1,
    reps_logged: "8",
    duration_seconds: null,
    weight_logged: 40,
    estimated_1rm: null,
    was_pr: false,
    logged_at: "2026-05-01T10:00:00Z",
    rir: null,
    rest_seconds: null,
    ...overrides,
  }
}

describe("ExerciseChart — table", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseExerciseById.mockReturnValue({ data: BASE_EXERCISE, isLoading: false })
  })

  it("renders rows in newest-date-first order", () => {
    const logs: SetLog[] = [
      makeLog({ logged_at: "2026-05-01T10:00:00Z", reps_logged: "8" }),
      makeLog({ logged_at: "2026-05-02T10:00:00Z", reps_logged: "10" }),
      makeLog({ logged_at: "2026-05-03T10:00:00Z", reps_logged: "12" }),
    ]
    mockUseExerciseTrend.mockReturnValue({ data: logs, isLoading: false })

    renderWithProviders(<ExerciseChart exerciseId="ex-1" />)

    const rows = screen.getAllByRole("row")
    // rows[0] is the header row
    expect(within(rows[1]).getByText(/May 3/)).toBeInTheDocument()
    expect(within(rows[2]).getByText(/May 2/)).toBeInTheDocument()
    expect(within(rows[3]).getByText(/May 1/)).toBeInTheDocument()
  })

  it("shows the first 100 rows and a Load more button when there are more, then reveals the rest on click", async () => {
    const userEvent = (await import("@testing-library/user-event")).default
    const user = userEvent.setup()

    const logs: SetLog[] = Array.from({ length: 105 }, (_, i) => {
      const day = String((i % 28) + 1).padStart(2, "0")
      const month = String(Math.floor(i / 28) + 1).padStart(2, "0")
      return makeLog({
        logged_at: `2026-${month}-${day}T10:00:00Z`,
        reps_logged: String(8 + (i % 5)),
      })
    })
    mockUseExerciseTrend.mockReturnValue({ data: logs, isLoading: false })

    renderWithProviders(<ExerciseChart exerciseId="ex-1" />)

    expect(screen.getAllByRole("row").length).toBe(101)
    const button = screen.getByRole("button", { name: /load more/i })
    expect(button).toBeInTheDocument()

    await user.click(button)

    expect(screen.getAllByRole("row").length).toBe(106)
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument()
  })

  it("does not render the Load more button when there are 100 or fewer rows", () => {
    const logs: SetLog[] = Array.from({ length: 100 }, (_, i) => {
      const day = String((i % 28) + 1).padStart(2, "0")
      const month = String(Math.floor(i / 28) + 1).padStart(2, "0")
      return makeLog({
        logged_at: `2026-${month}-${day}T10:00:00Z`,
        reps_logged: String(8 + (i % 5)),
      })
    })
    mockUseExerciseTrend.mockReturnValue({ data: logs, isLoading: false })

    renderWithProviders(<ExerciseChart exerciseId="ex-1" />)

    expect(screen.getAllByRole("row").length).toBe(101)
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument()
  })
})
