import { describe, expect, it } from "vitest"
import { pierreRegulars, rankRegulars, regularsFromSnapshot } from "./regulars"
import type { ProfileSnapshot, SessionFact, SetFact } from "./types"

function makeSession(overrides: Partial<SessionFact> = {}): SessionFact {
  return {
    id: "s1",
    started_at: "2026-08-20T10:00:00.000Z",
    finished_at: "2026-08-20T11:00:00.000Z",
    active_duration_ms: 40 * 60_000,
    program_id: null,
    has_catalog_circuit: false,
    ...overrides,
  }
}

function makeSet(overrides: Partial<SetFact> = {}): SetFact {
  return {
    session_id: "s1",
    exercise_id: "squat",
    was_pr: false,
    rir: null,
    weight_logged: 100,
    reps: "5",
    duration_seconds: null,
    block_exercise_id: null,
    ...overrides,
  }
}

function snapshot(sessions: SessionFact[], sets: SetFact[]): ProfileSnapshot {
  return { sessions, sets }
}

const WEEK = { from: "2026-08-15", to: "2026-08-21", timeZone: "UTC" }

describe("rankRegulars", () => {
  it("ranks by numeric reps descending, duration-only last", () => {
    const ranked = rankRegulars([
      { name: "Walk", reps: 80 },
      { name: "Plank", reps: null },
      { name: "Pull-up", reps: 400 },
    ])
    expect(ranked.map((row) => row.name)).toEqual(["Pull-up", "Walk", "Plank"])
  })
})

describe("pierreRegulars", () => {
  it("follows the window: fewer moves on 7d, Pull-up leads 100d", () => {
    const week = rankRegulars(pierreRegulars("7"))
    const hundred = rankRegulars(pierreRegulars("100"))
    expect(week).toHaveLength(5)
    expect(week[0]?.name).toBe("Squat")
    expect(week[0]?.reps).toBe(48)
    expect(hundred).toHaveLength(8)
    expect(hundred[0]?.name).toBe("Pull-up")
    expect(hundred[0]?.reps).toBe(400)
  })
})

describe("regularsFromSnapshot", () => {
  it("keeps an exercise only when it appears in two sessions in the window", () => {
    const rows = regularsFromSnapshot(
      snapshot(
        [
          makeSession({ id: "once" }),
          makeSession({
            id: "habit-a",
            started_at: "2026-08-18T10:00:00.000Z",
            finished_at: "2026-08-18T11:00:00.000Z",
          }),
          makeSession({
            id: "habit-b",
            started_at: "2026-08-19T10:00:00.000Z",
            finished_at: "2026-08-19T11:00:00.000Z",
          }),
        ],
        [
          makeSet({ session_id: "once", exercise_id: "bench", reps: "40" }),
          makeSet({ session_id: "habit-a", exercise_id: "squat", reps: "8" }),
          makeSet({ session_id: "habit-b", exercise_id: "squat", reps: "10" }),
        ],
      ),
      WEEK,
    )

    expect(rows.map((row) => row.name)).toEqual(["squat"])
    expect(rows[0]?.reps).toBe(18)
  })

  it("lets Cindy pull-ups rank from circuit station logs", () => {
    const rows = regularsFromSnapshot(
      snapshot(
        [
          makeSession({
            id: "cindy-a",
            has_catalog_circuit: true,
            started_at: "2026-08-16T10:00:00.000Z",
            finished_at: "2026-08-16T10:20:00.000Z",
          }),
          makeSession({
            id: "cindy-b",
            has_catalog_circuit: true,
            started_at: "2026-08-20T10:00:00.000Z",
            finished_at: "2026-08-20T10:20:00.000Z",
          }),
        ],
        [
          makeSet({
            session_id: "cindy-a",
            exercise_id: "pull-up",
            reps: "5",
            block_exercise_id: "station-pull",
            weight_logged: 0,
          }),
          makeSet({
            session_id: "cindy-b",
            exercise_id: "pull-up",
            reps: "6",
            block_exercise_id: "station-pull",
            weight_logged: 0,
          }),
        ],
      ),
      WEEK,
    )

    expect(rows).toEqual([
      { name: "pull-up", reps: 11, evolution: { kind: "reps", n: 1 } },
    ])
  })

  it("ranks 7d and 100d differently from the same snapshot", () => {
    const data = snapshot(
      [
        makeSession({
          id: "old-a",
          started_at: "2026-05-20T10:00:00.000Z",
          finished_at: "2026-05-20T11:00:00.000Z",
        }),
        makeSession({
          id: "old-b",
          started_at: "2026-05-22T10:00:00.000Z",
          finished_at: "2026-05-22T11:00:00.000Z",
        }),
        makeSession({
          id: "week-a",
          started_at: "2026-08-18T10:00:00.000Z",
          finished_at: "2026-08-18T11:00:00.000Z",
        }),
        makeSession({
          id: "week-b",
          started_at: "2026-08-20T10:00:00.000Z",
          finished_at: "2026-08-20T11:00:00.000Z",
        }),
      ],
      [
        makeSet({ session_id: "week-a", exercise_id: "squat", reps: "24" }),
        makeSet({ session_id: "week-b", exercise_id: "squat", reps: "24" }),
        makeSet({ session_id: "old-a", exercise_id: "pull-up", reps: "200" }),
        makeSet({ session_id: "old-b", exercise_id: "pull-up", reps: "200" }),
      ],
    )

    const week = regularsFromSnapshot(data, WEEK)
    const hundred = regularsFromSnapshot(data, {
      from: "2026-05-14",
      to: "2026-08-21",
      timeZone: "UTC",
    })

    expect(week.map((row) => [row.name, row.reps])).toEqual([["squat", 48]])
    expect(hundred.map((row) => [row.name, row.reps])).toEqual([
      ["pull-up", 400],
      ["squat", 48],
    ])
  })

  it("caps the list at eight regulars", () => {
    const sessions = ["a", "b"].map((id, i) =>
      makeSession({
        id,
        started_at: `2026-08-1${8 + i}T10:00:00.000Z`,
        finished_at: `2026-08-1${8 + i}T11:00:00.000Z`,
      }),
    )
    const sets = Array.from({ length: 9 }, (_, i) => i).flatMap((i) => [
      makeSet({ session_id: "a", exercise_id: `ex-${i}`, reps: String(100 - i) }),
      makeSet({ session_id: "b", exercise_id: `ex-${i}`, reps: "1" }),
    ])

    const rows = regularsFromSnapshot(snapshot(sessions, sets), WEEK)

    expect(rows).toHaveLength(8)
    expect(rows[0]?.name).toBe("ex-0")
    expect(rows[7]?.name).toBe("ex-7")
    expect(rows.some((row) => row.name === "ex-8")).toBe(false)
  })

  it("breaks a reps tie on the later session finish in the window", () => {
    const rows = regularsFromSnapshot(
      snapshot(
        [
          makeSession({
            id: "early-a",
            started_at: "2026-08-16T10:00:00.000Z",
            finished_at: "2026-08-16T11:00:00.000Z",
          }),
          makeSession({
            id: "early-b",
            started_at: "2026-08-17T10:00:00.000Z",
            finished_at: "2026-08-17T11:00:00.000Z",
          }),
          makeSession({
            id: "late-a",
            started_at: "2026-08-20T10:00:00.000Z",
            finished_at: "2026-08-20T11:00:00.000Z",
          }),
          makeSession({
            id: "late-b",
            started_at: "2026-08-21T10:00:00.000Z",
            finished_at: "2026-08-21T11:00:00.000Z",
          }),
        ],
        [
          makeSet({ session_id: "early-a", exercise_id: "row", reps: "10" }),
          makeSet({ session_id: "early-b", exercise_id: "row", reps: "10" }),
          makeSet({ session_id: "late-a", exercise_id: "deadlift", reps: "10" }),
          makeSet({ session_id: "late-b", exercise_id: "deadlift", reps: "10" }),
        ],
      ),
      WEEK,
    )

    expect(rows.map((row) => row.name)).toEqual(["deadlift", "row"])
    expect(rows.every((row) => row.reps === 20)).toBe(true)
  })

  it("ranks duration-only regulars after numeric reps", () => {
    const rows = regularsFromSnapshot(
      snapshot(
        [
          makeSession({ id: "a" }),
          makeSession({
            id: "b",
            started_at: "2026-08-19T10:00:00.000Z",
            finished_at: "2026-08-19T11:00:00.000Z",
          }),
        ],
        [
          makeSet({
            session_id: "a",
            exercise_id: "plank",
            reps: null,
            duration_seconds: 60,
            weight_logged: 0,
          }),
          makeSet({
            session_id: "b",
            exercise_id: "plank",
            reps: null,
            duration_seconds: 70,
            weight_logged: 0,
          }),
          makeSet({ session_id: "a", exercise_id: "pull-up", reps: "8" }),
          makeSet({ session_id: "b", exercise_id: "pull-up", reps: "8" }),
        ],
      ),
      WEEK,
    )

    expect(rows.map((row) => [row.name, row.reps])).toEqual([
      ["pull-up", 16],
      ["plank", null],
    ])
  })

  it("shows last-session load vs the previous session of the same move", () => {
    const rows = regularsFromSnapshot(
      snapshot(
        [
          makeSession({
            id: "prev",
            started_at: "2026-08-16T10:00:00.000Z",
            finished_at: "2026-08-16T11:00:00.000Z",
          }),
          makeSession({
            id: "last",
            started_at: "2026-08-20T10:00:00.000Z",
            finished_at: "2026-08-20T11:00:00.000Z",
          }),
        ],
        [
          makeSet({ session_id: "prev", exercise_id: "squat", weight_logged: 100, reps: "5" }),
          makeSet({ session_id: "last", exercise_id: "squat", weight_logged: 102, reps: "5" }),
        ],
      ),
      WEEK,
    )

    expect(rows).toEqual([
      { name: "squat", reps: 10, evolution: { kind: "weight", kg: 2 } },
    ])
  })

  it("uses heaviest set of each session, not session volume", () => {
    const rows = regularsFromSnapshot(
      snapshot(
        [
          makeSession({
            id: "prev",
            started_at: "2026-08-16T10:00:00.000Z",
            finished_at: "2026-08-16T11:00:00.000Z",
          }),
          makeSession({
            id: "last",
            started_at: "2026-08-20T10:00:00.000Z",
            finished_at: "2026-08-20T11:00:00.000Z",
          }),
        ],
        [
          makeSet({ session_id: "prev", exercise_id: "bench", weight_logged: 80, reps: "8" }),
          makeSet({ session_id: "prev", exercise_id: "bench", weight_logged: 90, reps: "5" }),
          makeSet({ session_id: "last", exercise_id: "bench", weight_logged: 85, reps: "8" }),
          makeSet({ session_id: "last", exercise_id: "bench", weight_logged: 92.5, reps: "3" }),
        ],
      ),
      WEEK,
    )

    expect(rows[0]?.evolution).toEqual({ kind: "weight", kg: 2.5 })
  })

  it("omits a flat or incomparable last-vs-prev charge", () => {
    const rows = regularsFromSnapshot(
      snapshot(
        [
          makeSession({
            id: "prev",
            started_at: "2026-08-16T10:00:00.000Z",
            finished_at: "2026-08-16T11:00:00.000Z",
          }),
          makeSession({
            id: "last",
            started_at: "2026-08-20T10:00:00.000Z",
            finished_at: "2026-08-20T11:00:00.000Z",
          }),
        ],
        [
          makeSet({ session_id: "prev", exercise_id: "row", weight_logged: 40, reps: "10" }),
          makeSet({ session_id: "last", exercise_id: "row", weight_logged: 40, reps: "10" }),
          makeSet({
            session_id: "prev",
            exercise_id: "lunge",
            weight_logged: 20,
            reps: "12",
          }),
          makeSet({
            session_id: "last",
            exercise_id: "lunge",
            weight_logged: 0,
            reps: "14",
          }),
        ],
      ),
      WEEK,
    )

    expect(rows.find((row) => row.name === "row")?.evolution).toBeUndefined()
    expect(rows.find((row) => row.name === "lunge")?.evolution).toBeUndefined()
  })
})
