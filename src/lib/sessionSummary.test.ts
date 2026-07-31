import { describe, expect, it } from "vitest"
import source from "./sessionSummary.ts?raw"
import { summarizeSessionLogs, templateToPreviewItems } from "./sessionSummary"
import { resolveExerciseName } from "./catalogLabels"
import type {
  ExerciseLabelFields,
  SetLogWithExercise,
  WorkoutExerciseWithLabel,
} from "@/types/database"

const catalogRow = (
  overrides: Partial<ExerciseLabelFields> = {},
): ExerciseLabelFields => ({
  id: "ex-1",
  name: "Développé couché",
  name_en: "Bench Press",
  muscle_group: "Pectoraux",
  equipment: "barbell",
  emoji: "🏋️",
  ...overrides,
})

const makeLog = (
  overrides: Partial<SetLogWithExercise> &
    Pick<
      SetLogWithExercise,
      "exercise_id" | "exercise_name_snapshot" | "set_number" | "weight_logged"
    > & { reps_logged?: string | null; duration_seconds?: number | null },
): SetLogWithExercise => ({
  id: "log-1",
  session_id: "sess-1",
  block_exercise_id: null,
  estimated_1rm: null,
  was_pr: false,
  logged_at: "2026-03-20T10:00:00Z",
  rir: null,
  rest_seconds: null,
  reps_logged: null,
  duration_seconds: null,
  exercise: null,
  ...overrides,
})

const makeExercise = (
  overrides: Partial<WorkoutExerciseWithLabel> &
    Pick<WorkoutExerciseWithLabel, "id" | "exercise_id">,
): WorkoutExerciseWithLabel => ({
  workout_day_id: "day-1",
  name_snapshot: "Test Exercise",
  muscle_snapshot: "chest",
  emoji_snapshot: "💪",
  sets: 3,
  reps: "12",
  weight: "60",
  rest_seconds: 90,
  sort_order: 0,
  target_duration_seconds: null,
  rep_range_min: 8,
  rep_range_max: 12,
  set_range_min: 2,
  set_range_max: 5,
  weight_increment: null,
  max_weight_reached: false,
  template_updated_at: "2020-01-01T00:00:00Z",
  exercise: null,
  ...overrides,
})

describe("purity", () => {
  // These builders feed a recap that has to read in the user's language, but
  // they must not know which language that is: the same built item is rendered
  // by a component that resolves the label. An i18next import here would bake
  // the name back in.
  it.each(["react", "i18next"])("does not import %s", (module) => {
    expect(source).not.toMatch(new RegExp(`from\\s+["']${module}`))
  })
})

describe("summarizeSessionLogs", () => {
  it("groups logs by exercise and counts actual sets", () => {
    const logs = [
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
    const logs = [
      makeLog({ exercise_id: "ex-1", exercise_name_snapshot: "Squat", set_number: 1, reps_logged: "12", weight_logged: 100 }),
      makeLog({ exercise_id: "ex-1", exercise_name_snapshot: "Squat", set_number: 2, reps_logged: "12", weight_logged: 100 }),
    ]
    const template = [makeExercise({ id: "we-1", exercise_id: "ex-1", sort_order: 0 })]

    const result = summarizeSessionLogs(logs, template)

    expect(result[0].reps).toBe("12")
  })

  it("preserves template sort order", () => {
    const logs = [
      makeLog({ exercise_id: "ex-b", exercise_name_snapshot: "B Exercise", set_number: 1, reps_logged: "10", weight_logged: 40 }),
      makeLog({ exercise_id: "ex-a", exercise_name_snapshot: "A Exercise", set_number: 1, reps_logged: "10", weight_logged: 60 }),
    ]
    const template = [
      makeExercise({ id: "we-a", exercise_id: "ex-a", sort_order: 0 }),
      makeExercise({ id: "we-b", exercise_id: "ex-b", sort_order: 1 }),
    ]

    const result = summarizeSessionLogs(logs, template)

    expect(result.map((i) => i.exercise_name_snapshot)).toEqual([
      "A Exercise",
      "B Exercise",
    ])
  })

  it("falls back to a default emoji when exercise is not in template", () => {
    const logs = [
      makeLog({ exercise_id: "ex-new", exercise_name_snapshot: "Added Mid-Session", set_number: 1, reps_logged: "10", weight_logged: 20 }),
    ]

    const result = summarizeSessionLogs(logs, [])

    expect(result[0].emoji).toBe("🏋️")
    expect(result[0].exercise_name_snapshot).toBe("Added Mid-Session")
  })

  // One built item, two locales, two names: proof that nothing was baked at
  // build time.
  it("hands the recap a source that resolves in either language", () => {
    const logs = [
      makeLog({
        exercise_id: "ex-1",
        exercise_name_snapshot: "Développé couché",
        set_number: 1,
        reps_logged: "10",
        weight_logged: 80,
        exercise: catalogRow(),
      }),
    ]

    const [item] = summarizeSessionLogs(logs, [])

    expect(resolveExerciseName(item, "en")).toBe("Bench Press")
    expect(resolveExerciseName(item, "fr")).toBe("Développé couché")
  })

  it("keeps the frozen snapshot when the catalog row is gone", () => {
    const logs = [
      makeLog({
        exercise_id: "ex-gone",
        exercise_name_snapshot: "Exercice supprimé",
        set_number: 1,
        reps_logged: "10",
        weight_logged: 80,
      }),
    ]

    const [item] = summarizeSessionLogs(logs, [])

    expect(resolveExerciseName(item, "en")).toBe("Exercice supprimé")
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
      exercise: null,
      name_snapshot: "Bench",
      sets: 3,
      reps: "10",
      maxWeight: 80,
    })
  })

  it("displays formatted duration instead of reps for duration exercises", () => {
    const exercises = [
      makeExercise({
        id: "we-dur",
        exercise_id: "ex-dur",
        name_snapshot: "Plank",
        emoji_snapshot: "🔥",
        sets: 4,
        reps: "0",
        weight: "0",
        target_duration_seconds: 30,
      }),
    ]

    const result = templateToPreviewItems(exercises)

    expect(result).toHaveLength(1)
    expect(result[0].reps).toBe("30s")
    expect(result[0].sets).toBe(4)
  })

  it("displays reps normally when target_duration_seconds is null", () => {
    const exercises = [
      makeExercise({
        id: "we-reps",
        exercise_id: "ex-reps",
        name_snapshot: "Crunches",
        sets: 4,
        reps: "12",
        target_duration_seconds: null,
      }),
    ]

    const result = templateToPreviewItems(exercises)

    expect(result[0].reps).toBe("12")
  })

  it("hands the recap a source that resolves in either language", () => {
    const exercises = [
      makeExercise({
        id: "we-1",
        exercise_id: "ex-1",
        name_snapshot: "Développé couché",
        exercise: catalogRow(),
      }),
    ]

    const [item] = templateToPreviewItems(exercises)

    expect(resolveExerciseName(item, "en")).toBe("Bench Press")
    expect(resolveExerciseName(item, "fr")).toBe("Développé couché")
  })
})
