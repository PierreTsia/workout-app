import { describe, expect, it } from "vitest"
import { fetchExercisesByIds } from "./catalogLookup"

const ID_BENCH = "11111111-1111-4111-8111-111111111111"
const ID_OHP = "22222222-2222-4222-8222-222222222222"
const ID_MISSING = "99999999-9999-4999-8999-999999999999"

interface CatalogRow {
  id: string
  name: string
  muscle_group: string
  emoji: string | null
  equipment: string
  measurement_type: "reps" | "duration" | null
  default_duration_seconds: number | null
}

interface FakeSupabaseConfig {
  rows: CatalogRow[]
  error?: string
}

function makeFakeSupabase(config: FakeSupabaseConfig) {
  const calls: { table: string; columns: string; column: string; values: string[] }[] = []
  return {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            in(column: string, values: string[]) {
              calls.push({ table, columns, column, values: [...values] })
              if (config.error) {
                return Promise.resolve({ data: null, error: { message: config.error } })
              }
              const valueSet = new Set(values)
              const matched = config.rows.filter((r) => valueSet.has(r.id))
              return Promise.resolve({ data: matched, error: null })
            },
          }
        },
      }
    },
    _calls: calls,
  }
}

describe("fetchExercisesByIds", () => {
  it("returns the catalog rows mapped to CatalogExerciseForProgram on the happy path", async () => {
    const supabase = makeFakeSupabase({
      rows: [
        {
          id: ID_BENCH,
          name: "Bench Press",
          muscle_group: "chest",
          emoji: "🏋️",
          equipment: "barbell",
          measurement_type: "reps",
          default_duration_seconds: null,
        },
        {
          id: ID_OHP,
          name: "Overhead Press",
          muscle_group: "shoulders",
          emoji: null,
          equipment: "barbell",
          measurement_type: "reps",
          default_duration_seconds: null,
        },
      ],
    })

    const result = await fetchExercisesByIds(supabase as never, [ID_BENCH, ID_OHP])

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(2)
    expect(result.data.map((e) => e.id).sort()).toEqual([ID_BENCH, ID_OHP].sort())
    const bench = result.data.find((e) => e.id === ID_BENCH)
    expect(bench).toMatchObject({
      name: "Bench Press",
      muscle_group: "chest",
      emoji: "🏋️",
      equipment: "barbell",
      measurement_type: "reps",
      default_duration_seconds: null,
    })
  })

  it("dedupes the input ids before querying supabase", async () => {
    const supabase = makeFakeSupabase({
      rows: [
        {
          id: ID_BENCH,
          name: "Bench Press",
          muscle_group: "chest",
          emoji: null,
          equipment: "barbell",
          measurement_type: "reps",
          default_duration_seconds: null,
        },
      ],
    })

    await fetchExercisesByIds(supabase as never, [ID_BENCH, ID_BENCH, ID_BENCH])

    expect(supabase._calls).toHaveLength(1)
    expect(supabase._calls[0].values).toEqual([ID_BENCH])
  })

  it("returns a structured error naming the missing ids when supabase returns fewer rows than requested", async () => {
    const supabase = makeFakeSupabase({
      rows: [
        {
          id: ID_BENCH,
          name: "Bench Press",
          muscle_group: "chest",
          emoji: null,
          equipment: "barbell",
          measurement_type: "reps",
          default_duration_seconds: null,
        },
      ],
    })

    const result = await fetchExercisesByIds(supabase as never, [ID_BENCH, ID_MISSING])

    expect(result.error).not.toBeNull()
    expect(result.error).toContain("Unknown or inaccessible exercise_id")
    expect(result.error).toContain(ID_MISSING)
    expect(result.error).not.toContain(ID_BENCH)
    expect(result.data).toEqual([])
  })

  it("propagates the supabase error message verbatim when the underlying query fails", async () => {
    const supabase = makeFakeSupabase({ rows: [], error: "PostgREST connection refused" })

    const result = await fetchExercisesByIds(supabase as never, [ID_BENCH])

    expect(result.error).toBe("PostgREST connection refused")
    expect(result.data).toEqual([])
  })

  it("normalises measurement_type 'duration' and parses default_duration_seconds to a finite number", async () => {
    const supabase = makeFakeSupabase({
      rows: [
        {
          id: ID_BENCH,
          name: "Plank",
          muscle_group: "core",
          emoji: "🧘",
          equipment: "bodyweight",
          measurement_type: "duration",
          default_duration_seconds: 45,
        },
      ],
    })

    const result = await fetchExercisesByIds(supabase as never, [ID_BENCH])

    expect(result.error).toBeNull()
    expect(result.data[0]).toMatchObject({
      measurement_type: "duration",
      default_duration_seconds: 45,
    })
  })
})
