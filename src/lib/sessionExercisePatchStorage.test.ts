import { afterEach, describe, expect, it } from "vitest"
import { emptyPreSessionPatch } from "@/types/preSessionOverrides"
import type { WorkoutExercise } from "@/types/database"
import {
  clearSessionExercisePatchStorage,
  loadSessionExercisePatch,
  saveSessionExercisePatch,
} from "./sessionExercisePatchStorage"

const row = (id: string): WorkoutExercise => ({
  id,
  workout_day_id: "d",
  exercise_id: "e",
  name_snapshot: "N",
  muscle_snapshot: "M",
  emoji_snapshot: "🏋️",
  sets: 3,
  reps: "10",
  weight: "0",
  rest_seconds: 60,
  sort_order: 0,
  rep_range_min: 8,
  rep_range_max: 12,
  set_range_min: 2,
  set_range_max: 5,
  weight_increment: null,
  max_weight_reached: false,
})

describe("sessionExercisePatchStorage", () => {
  afterEach(() => {
    clearSessionExercisePatchStorage()
  })

  it("returns null when envelope keys do not match", () => {
    const p = emptyPreSessionPatch()
    p.addedRows.push(row("new"))
    saveSessionExercisePatch("day-a", 100, p)
    expect(loadSessionExercisePatch("day-b", 100)).toBeNull()
    expect(loadSessionExercisePatch("day-a", 101)).toBeNull()
  })

  it("loads patch when day and startedAt match", () => {
    const p = emptyPreSessionPatch()
    p.addedRows.push(row("synth"))
    saveSessionExercisePatch("day-1", 42, p)
    const loaded = loadSessionExercisePatch("day-1", 42)
    expect(loaded?.addedRows).toHaveLength(1)
    expect(loaded?.addedRows[0]?.id).toBe("synth")
  })
})
