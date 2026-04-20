import { describe, expect, it } from "vitest"
import type { Exercise } from "@/types/database"
import type { GeneratedExercise } from "@/types/generator"
import {
  AI_PROGRAM_DAY_EMOJIS,
  buildWorkoutExerciseInsertRowsForDay,
  dayEmojiForProgramDayIndex,
} from "./programPersistence"

function fakeExercise(overrides: Partial<Exercise> & Pick<Exercise, "id" | "name">): Exercise {
  return {
    id: overrides.id,
    name: overrides.name,
    muscle_group: overrides.muscle_group ?? "Pectoraux",
    emoji: overrides.emoji ?? "🏋️",
    is_system: true,
    created_at: "",
    youtube_url: null,
    instructions: null,
    image_url: null,
    equipment: overrides.equipment ?? "barbell",
    difficulty_level: "intermediate",
    name_en: null,
    source: null,
    secondary_muscles: null,
    reviewed_at: null,
    reviewed_by: null,
    measurement_type: overrides.measurement_type,
    default_duration_seconds: overrides.default_duration_seconds,
  }
}

function ge(ex: Exercise, sets: number, reps: string, restSeconds: number): GeneratedExercise {
  return {
    exercise: ex,
    sets,
    reps,
    restSeconds,
    isCompound: false,
  }
}

describe("dayEmojiForProgramDayIndex", () => {
  it("returns first emoji for index 0", () => {
    expect(dayEmojiForProgramDayIndex(0)).toBe(AI_PROGRAM_DAY_EMOJIS[0])
  })

  it("wraps modulo emoji count", () => {
    expect(dayEmojiForProgramDayIndex(AI_PROGRAM_DAY_EMOJIS.length)).toBe(
      AI_PROGRAM_DAY_EMOJIS[0],
    )
  })
})

describe("buildWorkoutExerciseInsertRowsForDay", () => {
  const dayId = "day-uuid-1"

  it("builds rep-based barbell row with max_weight_reached false", () => {
    const ex = fakeExercise({
      id: "ex-1",
      name: "Bench",
      equipment: "barbell",
      measurement_type: "reps",
    })
    const rows = buildWorkoutExerciseInsertRowsForDay(dayId, [ge(ex, 4, "10", 90)])

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      workout_day_id: dayId,
      exercise_id: "ex-1",
      name_snapshot: "Bench",
      reps: "10",
      sets: 4,
      weight: "0",
      rest_seconds: 90,
      sort_order: 0,
      target_duration_seconds: null,
      rep_range_min: 8,
      rep_range_max: 12,
      set_range_min: 3,
      set_range_max: 6,
      max_weight_reached: false,
      duration_range_min_seconds: null,
      duration_range_max_seconds: null,
      duration_increment_seconds: null,
    })
  })

  it("sets max_weight_reached true for bodyweight", () => {
    const ex = fakeExercise({
      id: "ex-bw",
      name: "Push-up",
      equipment: "bodyweight",
      measurement_type: "reps",
    })
    const rows = buildWorkoutExerciseInsertRowsForDay(dayId, [ge(ex, 3, "12", 60)])
    expect(rows[0].max_weight_reached).toBe(true)
  })

  it("handles duration exercise with default 30s when default_duration_seconds null", () => {
    const ex = fakeExercise({
      id: "ex-pl",
      name: "Plank",
      equipment: "bodyweight",
      measurement_type: "duration",
      default_duration_seconds: null,
    })
    const rows = buildWorkoutExerciseInsertRowsForDay(dayId, [ge(ex, 3, "0", 60)])
    expect(rows[0]).toMatchObject({
      reps: "0",
      target_duration_seconds: 30,
      duration_range_min_seconds: 20,
      duration_range_max_seconds: 45,
      duration_increment_seconds: 5,
    })
  })

  it("uses exercise default_duration_seconds when set", () => {
    const ex = fakeExercise({
      id: "ex-h",
      name: "Hang",
      equipment: "bodyweight",
      measurement_type: "duration",
      default_duration_seconds: 45,
    })
    const rows = buildWorkoutExerciseInsertRowsForDay(dayId, [ge(ex, 2, "0", 90)])
    expect(rows[0].target_duration_seconds).toBe(45)
    expect(rows[0].duration_range_min_seconds).toBe(35)
    expect(rows[0].duration_range_max_seconds).toBe(60)
  })

  it("uses rep_range 8–12 when reps string does not parse to a finite integer", () => {
    const ex = fakeExercise({
      id: "ex-x",
      name: "Weird",
      equipment: "dumbbell",
      measurement_type: "reps",
    })
    const rows = buildWorkoutExerciseInsertRowsForDay(dayId, [ge(ex, 3, "AMRAP", 60)])
    expect(rows[0].rep_range_min).toBe(8)
    expect(rows[0].rep_range_max).toBe(12)
  })

  it("assigns sort_order by index", () => {
    const a = fakeExercise({ id: "a", name: "A", measurement_type: "reps" })
    const b = fakeExercise({ id: "b", name: "B", measurement_type: "reps" })
    const rows = buildWorkoutExerciseInsertRowsForDay(dayId, [
      ge(a, 3, "10", 60),
      ge(b, 3, "10", 60),
    ])
    expect(rows.map((r) => r.sort_order)).toEqual([0, 1])
  })
})
