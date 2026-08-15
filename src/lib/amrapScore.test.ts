import { describe, expect, it } from "vitest"
import {
  annotateRuns,
  computeBlockRuns,
  type BlockRunCellRow,
} from "./blockCompletionHistory"
import {
  amrapScore,
  annotateAmrapRuns,
  type AmrapHistoryRun,
  type AmrapScoreCell,
} from "./amrapScore"

function makeCell(overrides: Partial<AmrapScoreCell> = {}): AmrapScoreCell {
  return {
    session_id: "s1",
    set_number: 1,
    reps_logged: "10",
    duration_seconds: null,
    logged_at: "2026-08-15T10:00:00.000Z",
    exercise_name: "push-ups",
    ...overrides,
  }
}

const CINDY = ["push-ups", "sit-ups", "air squats"] as const

/** `rounds` full Cindy rectangles, then a leftover cell on the first station. */
function makeCindyPlusLeftover(
  fullRounds: number,
  leftover: number,
  leftoverName: string = CINDY[0],
): AmrapScoreCell[] {
  const full = Array.from({ length: fullRounds }, (_, r) =>
    CINDY.map((name, i) =>
      makeCell({
        set_number: r + 1,
        exercise_name: name,
        reps_logged: String(5 + i * 5),
        logged_at: new Date(Date.parse("2026-08-15T10:00:00.000Z") + (r * 3 + i) * 1000).toISOString(),
      }),
    ),
  ).flat()
  return [
    ...full,
    makeCell({
      set_number: fullRounds + 1,
      exercise_name: leftoverName,
      reps_logged: String(leftover),
      logged_at: new Date(
        Date.parse("2026-08-15T10:00:00.000Z") + fullRounds * 3 * 1000,
      ).toISOString(),
    }),
  ]
}

describe("amrapScore", () => {
  it("derives 27+3 and the leftover movement from a finished ragged last round", () => {
    const cells = makeCindyPlusLeftover(27, 3, "pompes")

    expect(
      amrapScore({ finished_at: "2026-08-15T10:20:00.000Z" }, cells),
    ).toEqual({
      fullRounds: 27,
      leftover: 3,
      leftoverName: "pompes",
    })
  })

  it("returns no score when finished_at is missing (session finish without Terminer)", () => {
    const cells = makeCindyPlusLeftover(14, 0)

    expect(amrapScore({ finished_at: null }, cells)).toBeNull()
  })
})

function makeRun(
  sessionId: string,
  startedAt: string,
  fingerprint: string,
  finishedAt: string | null = `${startedAt.slice(0, 11)}10:20:00.000Z`,
): AmrapHistoryRun {
  return {
    session_id: sessionId,
    started_at: startedAt,
    finished_at: finishedAt,
    template_fingerprint: fingerprint,
  }
}

const FP_20 = "amrap|1200|ex-1:5:0,ex-2:10:0,ex-3:15:0"

function cellsFor(
  sessionId: string,
  fullRounds: number,
  leftover: number,
): AmrapScoreCell[] {
  return makeCindyPlusLeftover(fullRounds, leftover).map((c) => ({
    ...c,
    session_id: sessionId,
  }))
}

describe("annotateAmrapRuns", () => {
  it("marks the max (fullRounds, leftover) as PB within a fingerprint, leftover as tie-break", () => {
    const views = annotateAmrapRuns(
      [
        makeRun("s1", "2026-08-01T10:00:00.000Z", FP_20),
        makeRun("s2", "2026-08-08T10:00:00.000Z", FP_20),
        makeRun("s3", "2026-08-15T10:00:00.000Z", FP_20),
      ],
      [
        ...cellsFor("s1", 25, 8),
        ...cellsFor("s2", 27, 3),
        ...cellsFor("s3", 27, 8),
      ],
    )

    const byId = Object.fromEntries(views.map((v) => [v.sessionId, v]))
    expect(byId.s3.isPb).toBe(true)
    expect(byId.s2.isPb).toBe(false)
    expect(byId.s1.isPb).toBe(false)
    expect(byId.s3.score).toEqual({
      fullRounds: 27,
      leftover: 8,
      leftoverName: "push-ups",
    })
  })

  it("excludes an unfinished run from the PB group even when its logs look better", () => {
    const views = annotateAmrapRuns(
      [
        makeRun("s1", "2026-08-01T10:00:00.000Z", FP_20),
        makeRun("s2", "2026-08-08T10:00:00.000Z", FP_20, null),
      ],
      [...cellsFor("s1", 25, 8), ...cellsFor("s2", 30, 0)],
    )

    const byId = Object.fromEntries(views.map((v) => [v.sessionId, v]))
    expect(byId.s2.isComplete).toBe(false)
    expect(byId.s2.isPb).toBe(false)
    expect(byId.s2.score).toBeNull()
    expect(byId.s1.isPb).toBe(false)
  })

  it("does not let a 10-min run steal the PB of a 20-min fingerprint", () => {
    const fp10 = "amrap|600|ex-1:5:0,ex-2:10:0,ex-3:15:0"
    const views = annotateAmrapRuns(
      [
        makeRun("a1", "2026-08-01T10:00:00.000Z", FP_20),
        makeRun("a2", "2026-08-08T10:00:00.000Z", FP_20),
        makeRun("a3", "2026-08-10T10:00:00.000Z", FP_20),
        makeRun("b1", "2026-08-15T10:00:00.000Z", fp10),
      ],
      [
        ...cellsFor("a1", 20, 0),
        ...cellsFor("a2", 22, 0),
        ...cellsFor("a3", 21, 0),
        ...cellsFor("b1", 40, 0),
      ],
    )

    const byId = Object.fromEntries(views.map((v) => [v.sessionId, v]))
    expect(byId.a2.isPb).toBe(true)
    expect(byId.b1.isPb).toBe(false)
    expect(byId.a2.fingerprint).not.toBe(byId.b1.fingerprint)
  })

  it("reports the delta in rounds against the previous complete run of the same fingerprint", () => {
    const views = annotateAmrapRuns(
      [
        makeRun("s1", "2026-08-01T10:00:00.000Z", FP_20),
        makeRun("s2", "2026-08-08T10:00:00.000Z", FP_20),
      ],
      [...cellsFor("s1", 25, 8), ...cellsFor("s2", 27, 3)],
    )

    const byId = Object.fromEntries(views.map((v) => [v.sessionId, v]))
    expect(byId.s2.deltaRounds).toBe(2)
    expect(byId.s1.deltaRounds).toBeNull()
  })

  it("does not invent a view from set_logs that have no block_run (Tours stays out)", () => {
    const views = annotateAmrapRuns(
      [makeRun("amrap", "2026-08-01T10:00:00.000Z", FP_20)],
      [...cellsFor("amrap", 27, 3), ...cellsFor("tours", 3, 0)],
    )

    expect(views.map((v) => v.sessionId)).toEqual(["amrap"])
  })

  it("withholds the delta across fingerprints and flags the cap/template change", () => {
    const fp10 = "amrap|600|ex-1:5:0,ex-2:10:0,ex-3:15:0"
    const views = annotateAmrapRuns(
      [
        makeRun("s1", "2026-08-01T10:00:00.000Z", FP_20),
        makeRun("s2", "2026-08-15T10:00:00.000Z", fp10),
      ],
      [...cellsFor("s1", 27, 3), ...cellsFor("s2", 14, 0)],
    )

    const byId = Object.fromEntries(views.map((v) => [v.sessionId, v]))
    expect(byId.s2.deltaRounds).toBeNull()
    expect(byId.s2.shapeChanged).toBe(true)
    expect(byId.s1.shapeChanged).toBe(false)
  })
})

function makeToursCell(
  overrides: Partial<BlockRunCellRow> = {},
): BlockRunCellRow {
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

/** Zeus-shaped 2×2 grid spanning `seconds` — the pre-T186 CCT fixture. */
function makeZeusRun(
  sessionId: string,
  startISO: string,
  seconds: number,
): BlockRunCellRow[] {
  const slots = [
    { be: "be1", round: 1 },
    { be: "be2", round: 1 },
    { be: "be1", round: 2 },
    { be: "be2", round: 2 },
  ]
  const start = Date.parse(startISO)
  return slots.map((slot, i) =>
    makeToursCell({
      session_id: sessionId,
      block_exercise_id: slot.be,
      set_number: slot.round,
      logged_at: new Date(
        start + (i / (slots.length - 1)) * seconds * 1000,
      ).toISOString(),
    }),
  )
}

describe("annotateRuns (Tours CCT, unchanged by T186)", () => {
  it("still derives Zeus completion times, faster-is-PB, and a negative delta", () => {
    const views = annotateRuns(
      computeBlockRuns([
        ...makeZeusRun("s1", "2026-06-01T10:00:00.000Z", 300),
        ...makeZeusRun("s2", "2026-06-08T10:00:00.000Z", 240),
      ]),
    )
    const byId = Object.fromEntries(views.map((v) => [v.run.sessionId, v]))

    expect(byId.s2.run.completionSeconds).toBe(240)
    expect(byId.s1.run.completionSeconds).toBe(300)
    expect(byId.s2.deltaSeconds).toBe(-60)
    expect(byId.s2.isPb).toBe(true)
    expect(byId.s1.isPb).toBe(false)
  })
})
