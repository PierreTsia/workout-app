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
    name_en: "Bench Press",
    source: "wger:73",
    secondary_muscles: null,
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
    name_en: "Squat",
    source: "wger:99",
    secondary_muscles: null,
  },
]

vi.mock("@/hooks/useExerciseLibrary", () => ({
  useExerciseLibrary: vi.fn(),
}))

import { useExerciseLibrary } from "@/hooks/useExerciseLibrary"
const mockUseExerciseLibrary = vi.mocked(useExerciseLibrary)

describe("useExerciseFromLibrary", () => {
  it("returns matching exercise when library is cached", () => {
    mockUseExerciseLibrary.mockReturnValue({
      data: mockExercises,
      isLoading: false,
    } as ReturnType<typeof useExerciseLibrary>)

    const { result } = renderHookWithProviders(() =>
      useExerciseFromLibrary("ex-1"),
    )

    expect(result.current.data).toEqual(mockExercises[0])
    expect(result.current.isLoading).toBe(false)
  })

  it("returns undefined for nonexistent ID", () => {
    mockUseExerciseLibrary.mockReturnValue({
      data: mockExercises,
      isLoading: false,
    } as ReturnType<typeof useExerciseLibrary>)

    const { result } = renderHookWithProviders(() =>
      useExerciseFromLibrary("ex-999"),
    )

    expect(result.current.data).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
  })

  it("returns undefined while loading", () => {
    mockUseExerciseLibrary.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useExerciseLibrary>)

    const { result } = renderHookWithProviders(() =>
      useExerciseFromLibrary("ex-1"),
    )

    expect(result.current.data).toBeUndefined()
    expect(result.current.isLoading).toBe(true)
  })
})
