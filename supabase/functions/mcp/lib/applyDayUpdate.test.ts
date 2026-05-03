import { describe, expect, it } from "vitest"
import { applyDayUpdate } from "./applyDayUpdate"
import type { CatalogExerciseForProgram } from "./programPersistence"
import type { ParsedExercise } from "./createProgramValidation"

const ID_BENCH = "11111111-1111-4111-8111-111111111111"
const ID_PUSHUP = "22222222-2222-4222-8222-222222222222"
const ID_OFF = "99999999-9999-4999-8999-999999999999"
const DAY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const USER_ID = "uuuuuuuu-uuuu-4uuu-8uuu-uuuuuuuuuuuu"

const BENCH: CatalogExerciseForProgram = {
  id: ID_BENCH,
  name: "Bench Press",
  muscle_group: "chest",
  emoji: null,
  equipment: "barbell",
  measurement_type: "reps",
  default_duration_seconds: null,
}

const PUSHUP: CatalogExerciseForProgram = {
  id: ID_PUSHUP,
  name: "Push-up",
  muscle_group: "chest",
  emoji: null,
  equipment: "bodyweight",
  measurement_type: "reps",
  default_duration_seconds: null,
}

interface CallEntry {
  table: string
  op: "delete" | "insert"
  details: unknown
}

interface MockSupabaseConfig {
  /** Indexed by call order. If a call's index is in this map, return the error. */
  errorAt?: Map<number, string>
}

function makeMockSupabase(config: MockSupabaseConfig = {}) {
  const calls: CallEntry[] = []
  const errorAt = config.errorAt ?? new Map<number, string>()

  function maybeError() {
    const idx = calls.length - 1
    const message = errorAt.get(idx)
    return message ? { message } : null
  }

  return {
    calls,
    from(table: string) {
      return {
        delete() {
          return {
            eq(col: string, val: unknown) {
              calls.push({ table, op: "delete", details: { col, val } })
              return Promise.resolve({ data: null, error: maybeError() })
            },
          }
        },
        insert(payload: unknown) {
          calls.push({ table, op: "insert", details: { payload } })
          return Promise.resolve({ data: null, error: maybeError() })
        },
      }
    },
  }
}

const benchObject: ParsedExercise = {
  kind: "object",
  exerciseId: ID_BENCH,
  sets: 4,
  reps: "8",
  weightKg: 80,
  restSeconds: 120,
  targetDurationSeconds: null,
}

const pushupBare: ParsedExercise = { kind: "bare", exerciseId: ID_PUSHUP }

describe("applyDayUpdate", () => {
  it("deletes existing exercises for the day, then inserts the new rows built from parsedExercises", async () => {
    const supabase = makeMockSupabase()
    const catalog = new Map([
      [ID_BENCH, BENCH],
      [ID_PUSHUP, PUSHUP],
    ])

    const result = await applyDayUpdate(
      supabase as never,
      DAY_ID,
      [benchObject, pushupBare],
      catalog,
      USER_ID,
    )

    expect(result).toEqual({ ok: true, inserted_count: 2 })
    expect(supabase.calls).toHaveLength(2)
    expect(supabase.calls[0]).toMatchObject({
      table: "workout_exercises",
      op: "delete",
      details: { col: "workout_day_id", val: DAY_ID },
    })
    expect(supabase.calls[1].table).toBe("workout_exercises")
    expect(supabase.calls[1].op).toBe("insert")
    const inserted = (supabase.calls[1].details as { payload: unknown[] }).payload
    expect(inserted).toHaveLength(2)
    expect(inserted[0]).toMatchObject({
      workout_day_id: DAY_ID,
      exercise_id: ID_BENCH,
      sets: 4,
      reps: "8",
      weight: "80",
      sort_order: 0,
    })
    expect(inserted[1]).toMatchObject({
      workout_day_id: DAY_ID,
      exercise_id: ID_PUSHUP,
      sort_order: 1,
    })
  })

  it("returns a structured error and does NOT touch the database when an exerciseId is missing from the catalog", async () => {
    const supabase = makeMockSupabase()
    const catalog = new Map([[ID_BENCH, BENCH]])

    const orphanObject: ParsedExercise = { ...benchObject, exerciseId: ID_OFF }

    const result = await applyDayUpdate(
      supabase as never,
      DAY_ID,
      [orphanObject],
      catalog,
      USER_ID,
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("Catalog miss")
      expect(result.error).toContain(ID_OFF)
    }
    expect(supabase.calls).toEqual([])
  })

  it("propagates the supabase error message and skips the INSERT when the DELETE fails", async () => {
    const supabase = makeMockSupabase({ errorAt: new Map([[0, "DELETE blew up"]]) })
    const catalog = new Map([[ID_BENCH, BENCH]])

    const result = await applyDayUpdate(
      supabase as never,
      DAY_ID,
      [benchObject],
      catalog,
      USER_ID,
    )

    expect(result).toEqual({ ok: false, error: "DELETE blew up" })
    expect(supabase.calls).toHaveLength(1)
    expect(supabase.calls[0].op).toBe("delete")
  })

  it("propagates the supabase error message when the INSERT fails (after the DELETE succeeded)", async () => {
    const supabase = makeMockSupabase({ errorAt: new Map([[1, "INSERT exploded"]]) })
    const catalog = new Map([[ID_BENCH, BENCH]])

    const result = await applyDayUpdate(
      supabase as never,
      DAY_ID,
      [benchObject],
      catalog,
      USER_ID,
    )

    expect(result).toEqual({ ok: false, error: "INSERT exploded" })
    expect(supabase.calls).toHaveLength(2)
  })
})
