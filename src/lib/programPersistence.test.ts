import { describe, expect, it } from "vitest"
import type { Exercise } from "@/types/database"
import type { GeneratedExercise } from "@/types/generator"
import {
  AI_PROGRAM_DAY_EMOJIS,
  buildWorkoutExerciseInsertRowsForDay,
  dayEmojiForProgramDayIndex,
  parseRepsBounds,
  type WorkoutExerciseProgramInsertRow,
} from "./programPersistence"
import fixtures from "../../supabase/functions/mcp/lib/programPersistence_fixtures.json"

interface FixtureExercise {
  id: string
  name: string
  muscle_group: string
  emoji: string | null
  equipment: string
  measurement_type: "reps" | "duration" | null
  default_duration_seconds: number | null
}

interface FixtureInput {
  sets: number
  reps: string
  restSeconds: number
  isCompound: boolean
  weightKg?: number
  repRangeMin?: number
  repRangeMax?: number
  setRangeMin?: number
  setRangeMax?: number
  targetDurationSeconds?: number
}

interface FixtureCase {
  name: string
  exercise: FixtureExercise
  input: FixtureInput
  expectedRow: Omit<WorkoutExerciseProgramInsertRow, "workout_day_id" | "sort_order">
}

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

function inflateFixtureExercise(fix: FixtureExercise): Exercise {
  return fakeExercise({
    id: fix.id,
    name: fix.name,
    muscle_group: fix.muscle_group,
    emoji: fix.emoji ?? "🏋️",
    equipment: fix.equipment,
    measurement_type: fix.measurement_type ?? undefined,
    default_duration_seconds: fix.default_duration_seconds,
  })
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

describe("buildWorkoutExerciseInsertRowsForDay (data-driven via shared fixtures)", () => {
  const dayId = "day-uuid-1"

  it.each(fixtures as FixtureCase[])("$name", (fixture) => {
    const ex = inflateFixtureExercise(fixture.exercise)
    const generated: GeneratedExercise = {
      exercise: ex,
      ...fixture.input,
    }

    const rows = buildWorkoutExerciseInsertRowsForDay(dayId, [generated])

    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      workout_day_id: dayId,
      sort_order: 0,
      ...fixture.expectedRow,
    })
  })
})

describe("buildWorkoutExerciseInsertRowsForDay (multi-row scenarios — not fixture-friendly)", () => {
  const dayId = "day-uuid-1"

  it("assigns sort_order by index for multiple exercises in the same day", () => {
    const a = fakeExercise({ id: "a", name: "A", measurement_type: "reps" })
    const b = fakeExercise({ id: "b", name: "B", measurement_type: "reps" })
    const rows = buildWorkoutExerciseInsertRowsForDay(dayId, [
      ge(a, 3, "10", 60),
      ge(b, 3, "10", 60),
    ])
    expect(rows.map((r) => r.sort_order)).toEqual([0, 1])
  })
})

describe("parseRepsBounds", () => {
  it("parses a single integer 'N' as min === max === N", () => {
    expect(parseRepsBounds("8")).toEqual({ min: 8, max: 8 })
  })

  it("parses a range 'N-M' as { min: N, max: M } when M >= N", () => {
    expect(parseRepsBounds("8-12")).toEqual({ min: 8, max: 12 })
  })

  it("parses 'N-N' (degenerate range) as { min: N, max: N }", () => {
    expect(parseRepsBounds("10-10")).toEqual({ min: 10, max: 10 })
  })

  it("parses '0' (used by duration exercises) without throwing", () => {
    expect(parseRepsBounds("0")).toEqual({ min: 0, max: 0 })
  })

  it("throws on a non-numeric string ('AMRAP', 'abc', etc.)", () => {
    expect(() => parseRepsBounds("AMRAP")).toThrow(/Invalid reps format/)
    expect(() => parseRepsBounds("abc")).toThrow(/Invalid reps format/)
  })

  it("throws on a malformed range with trailing dash ('8-')", () => {
    expect(() => parseRepsBounds("8-")).toThrow(/Invalid reps format/)
  })

  it("throws on a malformed range with leading dash ('-8')", () => {
    expect(() => parseRepsBounds("-8")).toThrow(/Invalid reps format/)
  })

  it("throws on an inverted range where max < min ('12-8')", () => {
    expect(() => parseRepsBounds("12-8")).toThrow(/Max .* < min/)
  })

  it("throws on the empty string", () => {
    expect(() => parseRepsBounds("")).toThrow(/Invalid reps format/)
  })
})
