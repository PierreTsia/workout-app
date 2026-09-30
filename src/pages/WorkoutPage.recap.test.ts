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

describe("WorkoutPage live session start", () => {
  it("wipes leftover PR flags when a live session starts (#533)", () => {
    // #571 split `startSession` into a guard + `commitStartSession`; the
    // isActive/beginLiveSession commit now lives in the latter.
    const startIdx = source.indexOf("const commitStartSession = useCallback")
    const endIdx = source.indexOf("\n  function handleNewSession", startIdx)
    expect(startIdx).toBeGreaterThan(-1)
    expect(endIdx).toBeGreaterThan(startIdx)

    const commitStartSession = source.slice(startIdx, endIdx)
    expect(commitStartSession).toMatch(/isActive:\s*true[\s\S]*\bbeginLiveSession\(/)
  })
})
