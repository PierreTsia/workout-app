import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  buildWorkoutExerciseInsertRowsForDay,
  dayEmojiForProgramDayIndex,
  type CatalogExerciseForProgram,
  type GeneratedExerciseForProgram,
} from "./programPersistence.ts"

function ge(ex: CatalogExerciseForProgram, sets: number, reps: string, restSeconds: number): GeneratedExerciseForProgram {
  return { exercise: ex, sets, reps, restSeconds, isCompound: false }
}

Deno.test("dayEmojiForProgramDayIndex wraps", () => {
  assertEquals(dayEmojiForProgramDayIndex(0), "💪")
  assertEquals(dayEmojiForProgramDayIndex(6), "💪")
})

Deno.test("buildWorkoutExerciseInsertRowsForDay barbell reps row", () => {
  const ex: CatalogExerciseForProgram = {
    id: "ex-1",
    name: "Bench",
    muscle_group: "Pectoraux",
    emoji: "🏋️",
    equipment: "barbell",
    measurement_type: "reps",
    default_duration_seconds: null,
  }
  const rows = buildWorkoutExerciseInsertRowsForDay("day-1", [ge(ex, 4, "10", 90)])
  assertEquals(rows.length, 1)
  assertEquals(rows[0].exercise_id, "ex-1")
  assertEquals(rows[0].reps, "10")
  assertEquals(rows[0].max_weight_reached, false)
  assertEquals(rows[0].rep_range_min, 8)
  assertEquals(rows[0].rep_range_max, 12)
})

Deno.test("buildWorkoutExerciseInsertRowsForDay bodyweight max_weight_reached", () => {
  const ex: CatalogExerciseForProgram = {
    id: "ex-bw",
    name: "Push-up",
    muscle_group: "Pectoraux",
    emoji: null,
    equipment: "bodyweight",
    measurement_type: "reps",
    default_duration_seconds: null,
  }
  const rows = buildWorkoutExerciseInsertRowsForDay("day-1", [ge(ex, 3, "12", 60)])
  assertEquals(rows[0].max_weight_reached, true)
})
