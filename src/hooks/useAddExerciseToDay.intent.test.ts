import { vi, describe, it, expect, beforeEach } from "vitest"
import { act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import type { ExerciseListItem } from "@/types/database"
import { useAddExerciseToDay } from "./useBuilderMutations"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      insert: () => Promise.resolve({ error: null }),
    }),
  },
}))

function makeExercise(): ExerciseListItem {
  return {
    id: "ex-1",
    name: "Bench Press",
    name_en: "Bench Press",
    emoji: "🏋️",
    muscle_group: "Pectoraux",
    equipment: "barbell",
    image_url: null,
    difficulty_level: "intermediate",
    is_system: true,
    measurement_type: "reps",
    default_duration_seconds: null,
    secondary_muscles: ["Triceps"],
  }
}

describe("useAddExerciseToDay intent cache", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("invalidates programs-intent and program-intent after a Builder write", async () => {
    const { result, queryClient } = renderHookWithProviders(() =>
      useAddExerciseToDay(),
    )
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")

    await act(async () => {
      await result.current.mutateAsync({
        dayId: "day-1",
        exercise: makeExercise(),
        sortOrder: 0,
      })
    })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["programs-intent"] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["program-intent"] })
  })
})
