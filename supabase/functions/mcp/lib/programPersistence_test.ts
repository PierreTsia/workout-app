import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  buildWorkoutExerciseInsertRowsForDay,
  dayEmojiForProgramDayIndex,
  parseRepsBounds,
  type CatalogExerciseForProgram,
  type GeneratedExerciseForProgram,
  type WorkoutExerciseProgramInsertRow,
} from "./programPersistence.ts"
import fixtures from "./programPersistence_fixtures.json" with { type: "json" }

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

function inflateFixtureExercise(fix: FixtureExercise): CatalogExerciseForProgram {
  return {
    id: fix.id,
    name: fix.name,
    muscle_group: fix.muscle_group,
    emoji: fix.emoji,
    equipment: fix.equipment,
    measurement_type: fix.measurement_type,
    default_duration_seconds: fix.default_duration_seconds,
  }
}

function ge(ex: CatalogExerciseForProgram, sets: number, reps: string, restSeconds: number): GeneratedExerciseForProgram {
  return { exercise: ex, sets, reps, restSeconds, isCompound: false }
}

Deno.test("dayEmojiForProgramDayIndex wraps", () => {
  assertEquals(dayEmojiForProgramDayIndex(0), "💪")
  assertEquals(dayEmojiForProgramDayIndex(6), "💪")
})

for (const fixture of fixtures as FixtureCase[]) {
  Deno.test(`buildWorkoutExerciseInsertRowsForDay (fixture) — ${fixture.name}`, () => {
    const ex = inflateFixtureExercise(fixture.exercise)
    const generated: GeneratedExerciseForProgram = { exercise: ex, ...fixture.input }
    const rows = buildWorkoutExerciseInsertRowsForDay("day-uuid-1", [generated])
    assertEquals(rows.length, 1)
    assertEquals(rows[0], {
      workout_day_id: "day-uuid-1",
      sort_order: 0,
      ...fixture.expectedRow,
    })
  })
}

Deno.test("buildWorkoutExerciseInsertRowsForDay assigns sort_order by index (multi-row, not fixture-friendly)", () => {
  const a: CatalogExerciseForProgram = {
    id: "a",
    name: "A",
    muscle_group: "Pectoraux",
    emoji: "🏋️",
    equipment: "barbell",
    measurement_type: "reps",
    default_duration_seconds: null,
  }
  const b: CatalogExerciseForProgram = { ...a, id: "b", name: "B" }
  const rows = buildWorkoutExerciseInsertRowsForDay("day-uuid-1", [
    ge(a, 3, "10", 60),
    ge(b, 3, "10", 60),
  ])
  assertEquals(rows.map((r) => r.sort_order), [0, 1])
})

Deno.test("parseRepsBounds parses 'N' as min === max", () => {
  assertEquals(parseRepsBounds("8"), { min: 8, max: 8 })
})

Deno.test("parseRepsBounds parses 'N-M' when M >= N", () => {
  assertEquals(parseRepsBounds("8-12"), { min: 8, max: 12 })
})

Deno.test("parseRepsBounds parses 'N-N' (degenerate range)", () => {
  assertEquals(parseRepsBounds("10-10"), { min: 10, max: 10 })
})

Deno.test("parseRepsBounds parses '0' (used by duration exercises)", () => {
  assertEquals(parseRepsBounds("0"), { min: 0, max: 0 })
})

Deno.test("parseRepsBounds throws on non-numeric strings", () => {
  assertThrows(() => parseRepsBounds("AMRAP"), Error, "Invalid reps format")
  assertThrows(() => parseRepsBounds("abc"), Error, "Invalid reps format")
})

Deno.test("parseRepsBounds throws on malformed range with trailing dash", () => {
  assertThrows(() => parseRepsBounds("8-"), Error, "Invalid reps format")
})

Deno.test("parseRepsBounds throws on malformed range with leading dash", () => {
  assertThrows(() => parseRepsBounds("-8"), Error, "Invalid reps format")
})

Deno.test("parseRepsBounds throws on inverted range (max < min)", () => {
  assertThrows(() => parseRepsBounds("12-8"), Error)
})

Deno.test("parseRepsBounds throws on the empty string", () => {
  assertThrows(() => parseRepsBounds(""), Error, "Invalid reps format")
})
