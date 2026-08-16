import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { annotateAmrapRuns, type AmrapScoreCell } from "./amrapScore.ts"
import {
  annotateHistoryAmrap,
  attachAmrapHistory,
  groupSessionHistory,
  historyGroupKey,
  type BlockMeta,
  type HistoryBlockRun,
  type HistorySetLog,
} from "./sessionHistoryGrouping.ts"

const CINDY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const FP_20 = "amrap|1200|ex-1:5:0,ex-2:10:0,ex-3:15:0"

function leftover(
  sessionId: string,
  setNumber: number,
  reps: string,
  name = "pompes",
): AmrapScoreCell {
  return {
    session_id: sessionId,
    set_number: setNumber,
    reps_logged: reps,
    duration_seconds: null,
    logged_at: "2026-08-15T10:19:00.000Z",
    exercise_name: name,
  }
}

function cindyRun(
  sessionId: string,
  blockId: string,
  startedAt: string,
  over: Partial<HistoryBlockRun> = {},
): HistoryBlockRun {
  return {
    session_id: sessionId,
    block_id: blockId,
    finished_at: `${startedAt.slice(0, 11)}10:20:00.000Z`,
    mode: "amrap",
    started_at: startedAt,
    template_fingerprint: FP_20,
    benchmark_circuit_id: CINDY_ID,
    ...over,
  }
}

Deno.test("T195: two finished Cindy days share one catalog identity and the same PB", () => {
  const runs = [
    cindyRun("s1", "block-tuesday", "2026-08-01T10:00:00.000Z"),
    cindyRun("s2", "block-next-month", "2026-08-15T10:00:00.000Z"),
  ]

  assertEquals(historyGroupKey(runs[0]), CINDY_ID)
  assertEquals(historyGroupKey(runs[1]), CINDY_ID)
  assertEquals(historyGroupKey(runs[0]), historyGroupKey(runs[1]))

  const views = annotateHistoryAmrap(runs, [
    leftover("s1", 26, "8"),
    leftover("s2", 28, "3"),
  ])

  const byId = Object.fromEntries(views.map((v) => [v.sessionId, v]))
  assertEquals(byId.s2.score, { fullRounds: 27, leftover: 3, leftoverName: "pompes" })
  assertEquals(byId.s2.isPb, true)
  assertEquals(byId.s2.deltaRounds, 2)
  assertEquals(byId.s1.isPb, false)
  assertEquals(byId.s1.deltaRounds, null)
  // Existing annotate stays the score/PB engine — we only change the grouping key.
  const naive = annotateAmrapRuns(
    runs.map((r) => ({
      session_id: r.session_id,
      started_at: r.started_at ?? r.session_id,
      finished_at: r.finished_at,
      template_fingerprint: r.template_fingerprint ?? r.block_id,
    })),
    [leftover("s1", 26, "8"), leftover("s2", 28, "3")],
  )
  assertEquals(naive.find((v) => v.sessionId === "s2")?.isPb, true)
})

Deno.test("T195: jetable AMRAP history still groups by block_id", () => {
  const runs: HistoryBlockRun[] = [
    cindyRun("s1", "jetable-a", "2026-08-01T10:00:00.000Z", {
      benchmark_circuit_id: null,
    }),
    cindyRun("s2", "jetable-b", "2026-08-15T10:00:00.000Z", {
      benchmark_circuit_id: null,
    }),
  ]

  assertEquals(historyGroupKey(runs[0]), "jetable-a")
  assertEquals(historyGroupKey(runs[1]), "jetable-b")

  const views = annotateHistoryAmrap(runs, [
    leftover("s1", 26, "8"),
    leftover("s2", 28, "3"),
  ])
  const byId = Object.fromEntries(views.map((v) => [v.sessionId, v]))
  assertEquals(byId.s1.isPb, false)
  assertEquals(byId.s2.isPb, false)
  assertEquals(byId.s2.deltaRounds, null)
  assertEquals(byId.s2.score, { fullRounds: 27, leftover: 3, leftoverName: "pompes" })
})

function historyLog(over: Partial<HistorySetLog> = {}): HistorySetLog {
  return {
    id: crypto.randomUUID(),
    exercise_id: "ex",
    block_exercise_id: "be1",
    exercise_name_snapshot: "pompes",
    set_number: 28,
    reps_logged: "3",
    duration_seconds: null,
    weight_logged: 0,
    was_pr: false,
    logged_at: "2026-08-15T10:19:00Z",
    ...over,
  }
}

Deno.test("T195: attachAmrapHistory stamps shared Cindy PB onto different-day block_ids", () => {
  const metaTue: BlockMeta = {
    blockId: "block-tuesday",
    label: "Cindy",
    position: 0,
    emoji: null,
    blockSortOrder: 0,
    mode: "amrap",
  }
  const metaNext: BlockMeta = { ...metaTue, blockId: "block-next-month" }
  const tue = groupSessionHistory(
    [historyLog({ block_exercise_id: "be-tue", set_number: 26, reps_logged: "8" })],
    new Map([["be-tue", metaTue]]),
  )
  const next = groupSessionHistory(
    [historyLog({ block_exercise_id: "be-next", set_number: 28, reps_logged: "3" })],
    new Map([["be-next", metaNext]]),
  )
  const runs = [
    cindyRun("s1", "block-tuesday", "2026-08-01T10:00:00.000Z"),
    cindyRun("s2", "block-next-month", "2026-08-15T10:00:00.000Z"),
  ]

  const attached = attachAmrapHistory(
    [
      { sessionId: "s1", items: tue },
      { sessionId: "s2", items: next },
    ],
    runs,
  )

  const s1 = attached[0].items[0]
  const s2 = attached[1].items[0]
  if (s1.kind !== "block" || s2.kind !== "block") throw new Error("expected block")
  assertEquals(s2.amrapScore, { fullRounds: 27, leftover: 3, leftoverName: "pompes" })
  assertEquals(s2.isPb, true)
  assertEquals(s2.deltaRounds, 2)
  assertEquals(s1.isPb, false)
  assertEquals(s1.deltaRounds, null)
})

Deno.test("T195: Tours Circuit stays unannotated (no CCT, no 27+3, no PB)", () => {
  const meta: BlockMeta = {
    blockId: "tours-1",
    label: "Finisher",
    position: 0,
    emoji: null,
    blockSortOrder: 0,
    mode: "rounds",
  }
  const items = groupSessionHistory(
    [
      historyLog({
        block_exercise_id: "be-tours",
        set_number: 1,
        reps_logged: "10",
        exercise_name_snapshot: "Push-up",
      }),
    ],
    new Map([["be-tours", meta]]),
  )
  const [bundle] = attachAmrapHistory([{ sessionId: "s1", items }], [])
  const block = bundle.items[0]
  if (block.kind !== "block") throw new Error("expected block")
  assertEquals(block.amrapScore, undefined)
  assertEquals(block.isPb, undefined)
  assertEquals(block.deltaRounds, undefined)
})
