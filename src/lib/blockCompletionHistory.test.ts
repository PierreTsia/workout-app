import { describe, it, expect } from "vitest"
import {
  annotateRuns,
  completionTrend,
  completionTrendSeries,
  computeBlockRuns,
  isRunComplete,
  runCompletionSeconds,
  runFingerprint,
  type BlockRunCellRow,
} from "./blockCompletionHistory"

/** A full R-round × exercises grid (one cell per exercise per round). */
function makeGrid(rounds: number, exerciseIds: string[]): BlockRunCellRow[] {
  return Array.from({ length: rounds }, (_, r) =>
    exerciseIds.map((id) => makeCell({ block_exercise_id: id, set_number: r + 1 })),
  ).flat()
}

function makeCell(overrides: Partial<BlockRunCellRow> = {}): BlockRunCellRow {
  return {
    session_id: "s1",
    block_exercise_id: "be1",
    set_number: 1,
    reps_logged: "10",
    duration_seconds: null,
    weight_logged: 20,
    logged_at: "2026-06-15T10:00:00.000Z",
    ...overrides,
  }
}

describe("runCompletionSeconds", () => {
  it("derives completion time from the first to the last logged_at", () => {
    const cells = [
      makeCell({ logged_at: "2026-06-15T10:00:00.000Z" }),
      makeCell({ logged_at: "2026-06-15T10:02:00.000Z" }),
      makeCell({ logged_at: "2026-06-15T10:04:32.000Z" }),
    ]

    expect(runCompletionSeconds(cells)).toBe(272)
  })

  it("is 0 for a single-cell run", () => {
    expect(runCompletionSeconds([makeCell()])).toBe(0)
  })
})

describe("runFingerprint", () => {
  it("is identical for two runs with the same exercises, rounds, reps and weight, regardless of row order", () => {
    const a = [
      makeCell({ block_exercise_id: "be1", set_number: 1, reps_logged: "10", weight_logged: 20 }),
      makeCell({ block_exercise_id: "be2", set_number: 1, reps_logged: "12", weight_logged: 0 }),
      makeCell({ block_exercise_id: "be1", set_number: 2, reps_logged: "8", weight_logged: 22 }),
    ]
    const shuffled = [a[2], a[0], a[1]]

    expect(runFingerprint(shuffled)).toBe(runFingerprint(a))
  })

  it("differs when the weight on a cell changes (added load is a different circuit)", () => {
    const base = [makeCell({ weight_logged: 20 })]
    const heavier = [makeCell({ weight_logged: 22.5 })]

    expect(runFingerprint(heavier)).not.toBe(runFingerprint(base))
  })

  it("differs when reps or duration change", () => {
    const reps = [makeCell({ reps_logged: "10", duration_seconds: null })]
    const fewer = [makeCell({ reps_logged: "8", duration_seconds: null })]
    const held = [makeCell({ reps_logged: null, duration_seconds: 30 })]

    expect(runFingerprint(fewer)).not.toBe(runFingerprint(reps))
    expect(runFingerprint(held)).not.toBe(runFingerprint(reps))
  })

  it("differs when a round is added", () => {
    const threeRounds = [
      makeCell({ set_number: 1 }),
      makeCell({ set_number: 2 }),
      makeCell({ set_number: 3 }),
    ]
    const fourRounds = [...threeRounds, makeCell({ set_number: 4 })]

    expect(runFingerprint(fourRounds)).not.toBe(runFingerprint(threeRounds))
  })
})

describe("isRunComplete", () => {
  it("is true when every exercise is logged in every round (full rectangle)", () => {
    expect(isRunComplete(makeGrid(3, ["be1", "be2"]))).toBe(true)
  })

  it("is false when the last round is missing a cell (abandoned mid-round)", () => {
    const ragged = makeGrid(3, ["be1", "be2"]).filter(
      (c) => !(c.set_number === 3 && c.block_exercise_id === "be2"),
    )
    expect(isRunComplete(ragged)).toBe(false)
  })

  it("is true for a clean shorter run (rounds 1..3 fully logged)", () => {
    expect(isRunComplete(makeGrid(3, ["be1", "be2", "be3"]))).toBe(true)
  })

  it("is false when rounds are not contiguous (round 2 skipped)", () => {
    const gappy = [
      makeCell({ block_exercise_id: "be1", set_number: 1 }),
      makeCell({ block_exercise_id: "be1", set_number: 3 }),
    ]
    expect(isRunComplete(gappy)).toBe(false)
  })
})

/** A full grid of `rounds` rounds for one session, spanning `seconds` wall-clock. */
function makeRun(
  sessionId: string,
  startISO: string,
  seconds: number,
  rounds = 2,
  exerciseIds = ["be1", "be2"],
): BlockRunCellRow[] {
  const grid = makeGrid(rounds, exerciseIds).map((c) => ({ ...c, session_id: sessionId }))
  const start = new Date(startISO).getTime()
  return grid.map((c, i) => ({
    ...c,
    // first cell at start, last cell at start + seconds; middle cells in between
    logged_at: new Date(start + (i / (grid.length - 1)) * seconds * 1000).toISOString(),
  }))
}

describe("computeBlockRuns", () => {
  it("groups cells by session into runs, newest-first, carrying time, fingerprint and completeness", () => {
    const older = makeRun("s1", "2026-06-01T10:00:00.000Z", 300)
    const newer = makeRun("s2", "2026-06-08T10:00:00.000Z", 240)

    const runs = computeBlockRuns([...older, ...newer])

    expect(runs.map((r) => r.sessionId)).toEqual(["s2", "s1"])
    expect(runs[0].completionSeconds).toBe(240)
    expect(runs[1].completionSeconds).toBe(300)
    expect(runs.every((r) => r.isComplete)).toBe(true)
    expect(runs[0].fingerprint).toBe(runs[1].fingerprint)
  })
})

describe("annotateRuns", () => {
  const byId = (views: ReturnType<typeof annotateRuns>, id: string) =>
    views.find((v) => v.run.sessionId === id)!

  it("computes the delta against the previous complete run of the same shape (negative = faster)", () => {
    const older = makeRun("s1", "2026-06-01T10:00:00.000Z", 300)
    const newer = makeRun("s2", "2026-06-08T10:00:00.000Z", 240)

    const views = annotateRuns(computeBlockRuns([...older, ...newer]))

    expect(byId(views, "s2").deltaSeconds).toBe(-60)
    expect(byId(views, "s1").deltaSeconds).toBeNull()
  })

  it("flags a shape change and withholds the delta when the previous run had a different prescription", () => {
    const shapeA = makeRun("s1", "2026-06-01T10:00:00.000Z", 300)
    const shapeB = makeRun("s2", "2026-06-08T10:00:00.000Z", 240).map((c) => ({
      ...c,
      weight_logged: 25,
    }))

    const views = annotateRuns(computeBlockRuns([...shapeA, ...shapeB]))

    expect(byId(views, "s2").shapeChanged).toBe(true)
    expect(byId(views, "s2").deltaSeconds).toBeNull()
    expect(byId(views, "s1").shapeChanged).toBe(false)
  })

  it("never anchors a delta on an incomplete run", () => {
    const first = makeRun("s1", "2026-06-01T10:00:00.000Z", 300)
    const abandoned = makeRun("s2", "2026-06-08T10:00:00.000Z", 999).filter(
      (c) => !(c.set_number === 2 && c.block_exercise_id === "be2"),
    )
    const third = makeRun("s3", "2026-06-15T10:00:00.000Z", 240)

    const views = annotateRuns(computeBlockRuns([...first, ...abandoned, ...third]))

    expect(byId(views, "s3").deltaSeconds).toBe(-60)
    expect(byId(views, "s2").deltaSeconds).toBeNull()
  })

  it("marks the fastest complete run per fingerprint group as PB, but not a lone run", () => {
    const slower = makeRun("s1", "2026-06-01T10:00:00.000Z", 300)
    const faster = makeRun("s2", "2026-06-08T10:00:00.000Z", 240)

    const views = annotateRuns(computeBlockRuns([...slower, ...faster]))
    expect(byId(views, "s2").isPb).toBe(true)
    expect(byId(views, "s1").isPb).toBe(false)

    const solo = annotateRuns(
      computeBlockRuns(makeRun("only", "2026-06-01T10:00:00.000Z", 300)),
    )
    expect(solo[0].isPb).toBe(false)
  })
})

describe("completionTrendSeries", () => {
  const viewsFor = (...runs: BlockRunCellRow[][]) =>
    annotateRuns(computeBlockRuns(runs.flat()))

  it("returns the completion times of the most-recent shape's complete runs, oldest first", () => {
    const views = viewsFor(
      makeRun("s1", "2026-06-01T10:00:00.000Z", 300),
      makeRun("s2", "2026-06-08T10:00:00.000Z", 270),
      makeRun("s3", "2026-06-15T10:00:00.000Z", 240),
    )

    expect(completionTrendSeries(views)).toEqual([300, 270, 240])
  })

  it("is empty when the most-recent shape has fewer than two complete runs", () => {
    const shapeB = makeRun("s3", "2026-06-20T10:00:00.000Z", 200).map((c) => ({
      ...c,
      weight_logged: 25,
    }))
    const views = viewsFor(
      makeRun("s1", "2026-06-01T10:00:00.000Z", 300),
      makeRun("s2", "2026-06-08T10:00:00.000Z", 270),
      shapeB,
    )

    expect(completionTrendSeries(views)).toEqual([])
  })
})

describe("completionTrend", () => {
  const viewsFor = (...runs: BlockRunCellRow[][]) =>
    annotateRuns(computeBlockRuns(runs.flat()))

  it("returns seconds and run dates aligned, oldest first, for the most-recent shape", () => {
    const views = viewsFor(
      makeRun("s1", "2026-06-01T10:00:00.000Z", 300),
      makeRun("s2", "2026-06-08T10:00:00.000Z", 270),
      makeRun("s3", "2026-06-15T10:00:00.000Z", 240),
    )

    expect(completionTrend(views)).toEqual({
      seconds: [300, 270, 240],
      dates: [
        "2026-06-01T10:00:00.000Z",
        "2026-06-08T10:00:00.000Z",
        "2026-06-15T10:00:00.000Z",
      ],
    })
  })

  it("is empty (both arrays) when there is nothing comparable to plot", () => {
    const views = viewsFor(makeRun("only", "2026-06-01T10:00:00.000Z", 300))
    expect(completionTrend(views)).toEqual({ seconds: [], dates: [] })
  })
})
