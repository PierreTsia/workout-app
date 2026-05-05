import { describe, expect, it } from "vitest"
import {
  assembleResolutionResults,
  type ResolveBatchRow,
} from "./assembleResolution"

function makeRow(overrides: Partial<ResolveBatchRow> = {}): ResolveBatchRow {
  return {
    query_idx: 0,
    query_text: "bench press",
    exercise_id: "11111111-1111-4111-8111-111111111111",
    name: "Développé couché",
    name_en: "Bench press",
    muscle_group: "Pectoraux",
    equipment: "barbell",
    measurement_type: "reps",
    default_duration_seconds: null,
    score: 0.85,
    ...overrides,
  }
}

describe("assembleResolutionResults", () => {
  it("returns an empty array when no queries were provided", () => {
    expect(assembleResolutionResults([], [])).toEqual([])
  })

  it("when top-1 clearly beats top-2 (gap >> threshold), keeps only the winner in matches", () => {
    // Two candidates returned by RPC for the same query, top-1 score 1.0,
    // top-2 score 0.5 → gap 0.5, well above default threshold 0.10.
    // Status is "matched" and the agent should not see the runner-up:
    // it'd just be noise that nudges the model to second-guess.
    const queries = ["bench press"]
    const rows = [
      makeRow({ exercise_id: "11111111-1111-4111-8111-111111111111", score: 1.0 }),
      makeRow({ exercise_id: "22222222-2222-4222-8222-222222222222", score: 0.5 }),
    ]

    const results = assembleResolutionResults(queries, rows)

    expect(results[0].status).toBe("matched")
    expect(results[0].matches).toHaveLength(1)
    expect(results[0].matches[0].id).toBe("11111111-1111-4111-8111-111111111111")
  })

  it("when top-1 and top-2 are close (gap < threshold), marks the query 'ambiguous' and returns both", () => {
    // top-1 = 0.80, top-2 = 0.75 → gap 0.05 < 0.10 → ambiguous;
    // the agent needs both to either disambiguate from context or ask the user.
    const queries = ["press"]
    const rows = [
      makeRow({ exercise_id: "11111111-1111-4111-8111-111111111111", score: 0.8 }),
      makeRow({ exercise_id: "22222222-2222-4222-8222-222222222222", score: 0.75 }),
    ]

    const results = assembleResolutionResults(queries, rows)

    expect(results[0].status).toBe("ambiguous")
    expect(results[0].matches.map((m) => m.id)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ])
  })

  it("when ambiguous, includes all rows the RPC returned (up to top-3) so the agent can pick", () => {
    // Three close candidates — verifies we don't accidentally cap at top-2
    // when the RPC gave us three. The SQL already enforces LIMIT 3 per query.
    const queries = ["press"]
    const rows = [
      makeRow({ exercise_id: "11111111-1111-4111-8111-111111111111", score: 0.8 }),
      makeRow({ exercise_id: "22222222-2222-4222-8222-222222222222", score: 0.75 }),
      makeRow({ exercise_id: "33333333-3333-4333-8333-333333333333", score: 0.72 }),
    ]

    const results = assembleResolutionResults(queries, rows)

    expect(results[0].status).toBe("ambiguous")
    expect(results[0].matches).toHaveLength(3)
  })

  it("derives weight_convention from each match's equipment (not from the table — it isn't a column)", () => {
    // Single sanity check that we correctly invoke formatWeightConvention.
    // Exhaustive equipment→convention coverage lives in lib/format.test.ts (T73).
    const queries = ["dumbbell row"]
    const rows = [makeRow({ equipment: "dumbbell" })]

    const results = assembleResolutionResults(queries, rows)

    expect(results[0].matches[0].weight_convention).toBe("per_hand")
    expect(results[0].matches[0].equipment).toBe("dumbbell") // raw column still passed through
  })

  it("preserves INPUT order even when the RPC returns rows for query_idx out of order", () => {
    // The Tech Plan flagged this footgun: the SQL emits rows ordered first by
    // the FOR loop iteration, then by the inner ORDER BY — but a future schema
    // change (e.g. wrapping in a CTE + final ORDER BY) could shuffle them.
    // The helper must rely on query_idx, NOT row arrival order.
    const queries = ["bench", "squat"]
    const rows = [
      // Rows for the SECOND query (idx 1) arrive first
      makeRow({
        query_idx: 1,
        query_text: "squat",
        exercise_id: "22222222-2222-4222-8222-222222222222",
        name: "Squat",
        score: 0.9,
      }),
      // Then the row for the FIRST query (idx 0)
      makeRow({
        query_idx: 0,
        query_text: "bench",
        exercise_id: "11111111-1111-4111-8111-111111111111",
        name: "Bench",
        score: 0.9,
      }),
    ]

    const results = assembleResolutionResults(queries, rows)

    expect(results.map((r) => r.query)).toEqual(["bench", "squat"])
    expect(results[0].matches[0].id).toBe("11111111-1111-4111-8111-111111111111")
    expect(results[1].matches[0].id).toBe("22222222-2222-4222-8222-222222222222")
  })

  it("when the original query was empty/whitespace, marks it 'empty_query' even though the RPC returned no rows", () => {
    // The SQL CONTINUEs on whitespace queries → zero rows for that query_idx,
    // same shape as no_match. The helper must distinguish based on the ORIGINAL
    // query string so the agent gets a useful error category, not a false "no_match".
    const queries = ["   "]
    const rows: ResolveBatchRow[] = []

    const results = assembleResolutionResults(queries, rows)

    expect(results[0].status).toBe("empty_query")
    expect(results[0].matches).toEqual([])
  })

  it("when the RPC returned no rows for a non-empty query, marks it 'no_match' with empty matches", () => {
    const queries = ["xqzkblargh"]
    const rows: ResolveBatchRow[] = []

    const results = assembleResolutionResults(queries, rows)

    expect(results[0].status).toBe("no_match")
    expect(results[0].matches).toEqual([])
  })

  it("flags a single-row response as 'matched' and returns just that match", () => {
    const queries = ["bench press"]
    const rows = [makeRow()]

    const results = assembleResolutionResults(queries, rows)

    expect(results).toHaveLength(1)
    expect(results[0].query).toBe("bench press")
    expect(results[0].status).toBe("matched")
    expect(results[0].matches).toHaveLength(1)
    expect(results[0].matches[0].id).toBe("11111111-1111-4111-8111-111111111111")
  })
})
