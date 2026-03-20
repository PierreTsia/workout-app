import { describe, expect, it } from "vitest"
import { summarizeSessionLogs, templateToPreviewItems } from "./sessionSummary"
import type { SetLog, WorkoutExercise } from "@/types/database"

const makeLog = (
  overrides: Partial<SetLog> & Pick<SetLog, "exercise_id" | "exercise_name_snapshot" | "set_number" | "reps_logged" | "weight_logged">,
): SetLog => ({
  id: "log-1",
  session_id: "sess-1",
  estimated_1rm: null,
  was_pr: false,
  logged_at: "2026-03-20T10:00:00Z",
  rir: null,
  ...overrides,
})

const makeExercise = (
  overrides: Partial<WorkoutExercise> & Pick<WorkoutExercise, "id" | "exercise_id">,
): WorkoutExercise => ({
  workout_day_id: "day-1",
  name_snapshot: "Test Exercise",
  muscle_snapshot: "chest",
  emoji_snapshot: "💪",
  sets: 3,
  reps: "12",
  weight: "60",
  rest_seconds: 90,
  sort_order: 0,
  ...overrides,
})

describe("summarizeSessionLogs", () => {
  it("groups logs by exercise and counts actual sets", () => {
    const logs: SetLog[] = [
      makeLog({ exercise_id: "ex-1", exercise_name_snapshot: "Bench Press", set_number: 1, reps_logged: "10", weight_logged: 80 }),
      makeLog({ exercise_id: "ex-1", exercise_name_snapshot: "Bench Press", set_number: 2, reps_logged: "10", weight_logged: 80 }),
      makeLog({ exercise_id: "ex-1", exercise_name_snapshot: "Bench Press", set_number: 3, reps_logged: "8", weight_logged: 85 }),
      makeLog({ exercise_id: "ex-1", exercise_name_snapshot: "Bench Press", set_number: 4, reps_logged: "8", weight_logged: 85 }),
    ]
    const template = [makeExercise({ id: "we-1", exercise_id: "ex-1", emoji_snapshot: "🏋️", sort_order: 0 })]

    const result = summarizeSessionLogs(logs, template)

    expect(result).toHaveLength(1)
    expect(result[0].sets).toBe(4)
    expect(result[0].reps).toBe("8–10")
    expect(result[0].maxWeight).toBe(85)
    expect(result[0].emoji).toBe("🏋️")
  })

  it("uses uniform reps when all sets have the same value", () => {
    const logs: SetLog[] = [
      makeLog({ exercise_id: "ex-1", exercise_name_snapshot: "Squat", set_number: 1, reps_logged: "12", weight_logged: 100 }),
      makeLog({ exercise_id: "ex-1", exercise_name_snapshot: "Squat", set_number: 2, reps_logged: "12", weight_logged: 100 }),
    ]
    const template = [makeExercise({ id: "we-1", exercise_id: "ex-1", sort_order: 0 })]

    const result = summarizeSessionLogs(logs, template)

    expect(result[0].reps).toBe("12")
  })

  it("preserves template sort order", () => {
    const logs: SetLog[] = [
      makeLog({ exercise_id: "ex-b", exercise_name_snapshot: "B Exercise", set_number: 1, reps_logged: "10", weight_logged: 40 }),
      makeLog({ exercise_id: "ex-a", exercise_name_snapshot: "A Exercise", set_number: 1, reps_logged: "10", weight_logged: 60 }),
    ]
    const template = [
      makeExercise({ id: "we-a", exercise_id: "ex-a", sort_order: 0 }),
      makeExercise({ id: "we-b", exercise_id: "ex-b", sort_order: 1 }),
    ]

    const result = summarizeSessionLogs(logs, template)

    expect(result[0].name).toBe("A Exercise")
    expect(result[1].name).toBe("B Exercise")
  })

  it("falls back to a default emoji when exercise is not in template", () => {
    const logs: SetLog[] = [
      makeLog({ exercise_id: "ex-new", exercise_name_snapshot: "Added Mid-Session", set_number: 1, reps_logged: "10", weight_logged: 20 }),
    ]

    const result = summarizeSessionLogs(logs, [])

    expect(result[0].emoji).toBe("🏋️")
    expect(result[0].name).toBe("Added Mid-Session")
  })
})

describe("templateToPreviewItems", () => {
  it("maps template exercises to preview items", () => {
    const exercises = [
      makeExercise({ id: "we-1", exercise_id: "ex-1", name_snapshot: "Bench", emoji_snapshot: "🏋️", sets: 3, reps: "10", weight: "80" }),
    ]

    const result = templateToPreviewItems(exercises)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: "we-1",
      emoji: "🏋️",
      name: "Bench",
      sets: 3,
      reps: "10",
      maxWeight: 80,
    })
  })
})
