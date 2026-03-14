import { vi, describe, it, expect } from "vitest"
import { renderHookWithProviders } from "@/test/utils"
import { useExerciseFromLibrary } from "./useExerciseFromLibrary"
import type { Exercise } from "@/types/database"

const mockExercises: Exercise[] = [
  {
    id: "ex-1",
    name: "Bench Press",
    muscle_group: "Chest",
    emoji: "🏋️",
    is_system: true,
    created_at: "2024-01-01T00:00:00Z",
    youtube_url: null,
    instructions: null,
    image_url: null,
    equipment: "barbell",
    difficulty_level: null,
    name_en: "Bench Press",
    source: "wger:73",
    secondary_muscles: null,
    reviewed_at: null,
    reviewed_by: null,
  },
  {
    id: "ex-2",
    name: "Squat",
    muscle_group: "Legs",
    emoji: "🦵",
    is_system: true,
    created_at: "2024-01-01T00:00:00Z",
    youtube_url: null,
    instructions: null,
    image_url: null,
    equipment: "barbell",
    difficulty_level: null,
    name_en: "Squat",
    source: "wger:99",
    secondary_muscles: null,
    reviewed_at: null,
    reviewed_by: null,
  },
]

vi.mock("@/hooks/useExerciseById", () => ({
  useExerciseById: vi.fn(),
}))

import { useExerciseById } from "@/hooks/useExerciseById"
const mockUseExerciseById = vi.mocked(useExerciseById)

describe("useExerciseFromLibrary", () => {
  it("returns matching exercise when fetched by id", () => {
    mockUseExerciseById.mockReturnValue({
      data: mockExercises[0],
      isLoading: false,
    } as ReturnType<typeof useExerciseById>)

    const { result } = renderHookWithProviders(() =>
      useExerciseFromLibrary("ex-1"),
    )

    expect(result.current.data).toEqual(mockExercises[0])
    expect(result.current.isLoading).toBe(false)
  })

  it("returns undefined for nonexistent ID", () => {
    mockUseExerciseById.mockReturnValue({
      data: null,
      isLoading: false,
    } as ReturnType<typeof useExerciseById>)

    const { result } = renderHookWithProviders(() =>
      useExerciseFromLibrary("ex-999"),
    )

    expect(result.current.data).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
  })

  it("returns undefined while loading", () => {
    mockUseExerciseById.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useExerciseById>)

    const { result } = renderHookWithProviders(() =>
      useExerciseFromLibrary("ex-1"),
    )

    expect(result.current.data).toBeUndefined()
    expect(result.current.isLoading).toBe(true)
  })
})
