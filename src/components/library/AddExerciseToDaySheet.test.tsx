import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import type { Exercise } from "@/types/database"
import type { Program } from "@/types/onboarding"
import { AddExerciseToDaySheet } from "./AddExerciseToDaySheet"

const EXERCISE: Exercise = {
  id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  name: "Squat",
  muscle_group: "legs",
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

const PROG: Program = {
  id: "prog-1",
  user_id: "u1",
  name: "Strength A",
  template_id: null,
  is_active: true,
  archived_at: null,
  created_at: "2025-01-01T00:00:00Z",
}

const mockMutateAsync = vi.fn().mockResolvedValue(undefined)

vi.mock("@/hooks/useBuilderMutations", () => ({
  useAddExerciseToDay: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}))

const mockUseUserPrograms = vi.fn()
vi.mock("@/hooks/useUserPrograms", () => ({
  useUserPrograms: () => mockUseUserPrograms(),
}))

const mockUseWorkoutDays = vi.fn()
vi.mock("@/hooks/useWorkoutDays", () => ({
  useWorkoutDays: (programId: string | null) => mockUseWorkoutDays(programId),
}))

const mockEq = vi.fn()
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: (...args: unknown[]) => mockEq(...args),
      })),
    })),
  },
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}))

describe("AddExerciseToDaySheet", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseUserPrograms.mockReturnValue({
      data: [PROG],
      isLoading: false,
    })
    mockUseWorkoutDays.mockImplementation((programId: string | null) => {
      if (!programId) {
        return { data: [], isLoading: false }
      }
      return {
        data: [
          {
            id: "day-1",
            user_id: "u1",
            program_id: programId,
            label: "Leg day",
            emoji: "🦵",
            sort_order: 0,
            created_at: "2025-01-01T00:00:00Z",
            saved_at: null,
          },
        ],
        isLoading: false,
      }
    })
    mockEq.mockResolvedValue({ data: [{ sort_order: 2 }], error: null })
  })

  it("shows empty state when user has no programs", () => {
    mockUseUserPrograms.mockReturnValue({ data: [], isLoading: false })
    renderWithProviders(
      <AddExerciseToDaySheet exercise={EXERCISE} open onOpenChange={vi.fn()} />,
    )
    expect(
      screen.getByText(/You have no programs yet/i),
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /New Program/i })).toHaveAttribute(
      "href",
      "/create-program",
    )
  })

  it("adds exercise with sortOrder after max existing sort_order", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    renderWithProviders(
      <AddExerciseToDaySheet exercise={EXERCISE} open onOpenChange={onOpenChange} />,
    )

    await user.click(screen.getByRole("button", { name: "Strength A" }))
    await user.click(screen.getByRole("button", { name: /Leg day/i }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        dayId: "day-1",
        exercise: EXERCISE,
        sortOrder: 3,
      })
    })
    expect(toastSuccess).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("shows builder link when program has no days", async () => {
    const user = userEvent.setup()
    mockUseWorkoutDays.mockReturnValue({ data: [], isLoading: false })

    renderWithProviders(
      <AddExerciseToDaySheet exercise={EXERCISE} open onOpenChange={vi.fn()} />,
    )

    await user.click(screen.getByRole("button", { name: "Strength A" }))
    expect(screen.getByText(/no days yet/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Open builder/i })).toHaveAttribute(
      "href",
      "/builder/prog-1",
    )
  })
})
