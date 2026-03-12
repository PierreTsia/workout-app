import { describe, it, expect, vi } from "vitest"
import { getExerciseImageUrl } from "./storage"

vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co")

describe("getExerciseImageUrl", () => {
  it("builds correct URL from relative path", () => {
    expect(getExerciseImageUrl("bench-press.webp")).toBe(
      "https://test.supabase.co/storage/v1/object/public/exercise-media/bench-press.webp",
    )
  })

  it("handles empty string", () => {
    expect(getExerciseImageUrl("")).toBe(
      "https://test.supabase.co/storage/v1/object/public/exercise-media/",
    )
  })

  it("handles paths with special characters", () => {
    expect(getExerciseImageUrl("legs/front squat (barbell).webp")).toBe(
      "https://test.supabase.co/storage/v1/object/public/exercise-media/legs/front squat (barbell).webp",
    )
  })
})
