import { describe, it, expect } from "vitest"
import source from "./WorkoutPage.tsx?raw"

describe("WorkoutPage done-day recap", () => {
  it("does not import ExerciseListPreview or summarizeSessionLogs", () => {
    expect(source).not.toMatch(/\bExerciseListPreview\b/)
    expect(source).not.toMatch(/\bsummarizeSessionLogs\b/)
    expect(source).not.toMatch(/\btemplateToPreviewItems\b/)
    expect(source).toMatch(/\bLastSessionRecap\b/)
  })
})
