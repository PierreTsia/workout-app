import { vi, describe, it, expect, beforeEach } from "vitest"
import { screen, waitFor, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import type { User } from "@/types/auth"
import { AIProgramPreviewStep } from "./AIProgramPreviewStep"
import type { AIGeneratedProgram, GenerateProgramConstraints } from "@/types/aiProgram"
import type { Exercise } from "@/types/database"

function stubExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-1",
    name: "Bench",
    muscle_group: "chest",
    emoji: "🏋️",
    is_system: true,
    created_at: "",
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
    ...overrides,
  }
}

const mockNavigate = vi.fn()

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

const program: AIGeneratedProgram = {
  rationale: "Test rationale",
  days: [
    {
      label: "Day 1",
      muscleFocus: "Chest",
      exercises: [
        {
          exercise: stubExercise(),
          sets: 3,
          reps: "8",
          restSeconds: 90,
          isCompound: true,
        },
      ],
    },
  ],
}

const constraints: GenerateProgramConstraints = {
  daysPerWeek: 3,
  duration: 60,
  equipmentCategory: "full-gym",
  goal: "hypertrophy",
  experience: "intermediate",
}

const TEST_USER = { id: "user-1" } as unknown as User

async function mockSupabaseSuccess(programId: string) {
  const { supabase } = await import("@/lib/supabase")
  const workoutDaysInsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(() =>
        Promise.resolve({ data: { id: "day-1" }, error: null }),
      ),
    })),
  }))

  vi.mocked(supabase.from).mockImplementation(
    (table: string) => {
      if (table === "programs") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ error: null })),
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({ data: { id: programId }, error: null }),
              ),
            })),
          })),
        } as never
      }
      if (table === "workout_days") {
        return { insert: workoutDaysInsert } as never
      }
      if (table === "workout_exercises") {
        return {
          insert: vi.fn(() => Promise.resolve({ error: null })),
        } as never
      }
      return {} as never
    },
  )
}

describe("AIProgramPreviewStep", () => {
  beforeEach(async () => {
    mockNavigate.mockClear()
    vi.clearAllMocks()
    const { supabase } = await import("@/lib/supabase")
    vi.mocked(supabase.from).mockReset()
  })

  async function renderAuthenticated(
    props: {
      successReplacePath?: string
      onProgramCreated?: (id: string) => void
    } = {},
  ) {
    const result = renderWithProviders(
      <AIProgramPreviewStep
        program={program}
        constraints={constraints}
        onRegenerate={vi.fn()}
        successReplacePath={props.successReplacePath}
        onProgramCreated={props.onProgramCreated}
      />,
    )
    await act(async () => {
      result.store.set(authAtom, TEST_USER)
    })
    result.rerender(
      <AIProgramPreviewStep
        program={program}
        constraints={constraints}
        onRegenerate={vi.fn()}
        successReplacePath={props.successReplacePath}
        onProgramCreated={props.onProgramCreated}
      />,
    )
    return result
  }

  it("navigates to /library by default after create", async () => {
    await mockSupabaseSuccess("prog-lib")

    await renderAuthenticated()

    await userEvent.click(screen.getByRole("button", { name: /create program/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/library", { replace: true })
    })
  })

  it("navigates to successReplacePath and calls onProgramCreated when provided", async () => {
    await mockSupabaseSuccess("prog-home")
    const onProgramCreated = vi.fn()

    await renderAuthenticated({
      successReplacePath: "/",
      onProgramCreated,
    })

    await userEvent.click(screen.getByRole("button", { name: /create program/i }))

    await waitFor(() => {
      expect(onProgramCreated).toHaveBeenCalledWith("prog-home")
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true })
    })
  })
})
