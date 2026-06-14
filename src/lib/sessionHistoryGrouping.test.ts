import { describe, expect, it } from "vitest"
import {
  buildBlockMetaMap,
  groupSessionHistory,
  type BlockExerciseMetaRow,
  type BlockMeta,
} from "@/lib/sessionHistoryGrouping"
import type { SetLog } from "@/types/database"

const log = (over: Partial<SetLog> = {}): SetLog => ({
  id: crypto.randomUUID(),
  session_id: "s1",
  exercise_id: "ex",
  block_exercise_id: null,
  exercise_name_snapshot: "Squat",
  set_number: 1,
  reps_logged: "10",
  duration_seconds: null,
  weight_logged: 100,
  estimated_1rm: null,
  was_pr: false,
  logged_at: "2026-06-13T10:00:00Z",
  rir: null,
  rest_seconds: null,
  ...over,
})

const meta = (over: Partial<BlockMeta> = {}): BlockMeta => ({
  blockId: "blk1",
  label: "Bras",
  position: 0,
  emoji: "💪",
  blockSortOrder: 0,
  ...over,
})

describe("buildBlockMetaMap", () => {
  it("maps rows by block_exercise id and drops rows with no parent block", () => {
    const rows: BlockExerciseMetaRow[] = [
      {
        id: "be1",
        block_id: "blk1",
        emoji_snapshot: "💪",
        position: 1,
        block: { id: "blk1", label: "Bras", rounds: 3, sort_order: 2 },
      },
      {
        id: "be2",
        block_id: "blk1",
        emoji_snapshot: null,
        position: 0,
        block: null,
      },
    ]
    const map = buildBlockMetaMap(rows)
    expect(map.size).toBe(1)
    expect(map.get("be1")).toEqual({
      blockId: "blk1",
      label: "Bras",
      position: 1,
      emoji: "💪",
      blockSortOrder: 2,
    })
  })
})

describe("groupSessionHistory", () => {
  it("keeps solo-only sessions as consecutive-name groups", () => {
    const logs = [
      log({ exercise_name_snapshot: "Bench", set_number: 1 }),
      log({ exercise_name_snapshot: "Bench", set_number: 2 }),
      log({ exercise_name_snapshot: "Row", set_number: 1 }),
    ]
    const items = groupSessionHistory(logs, new Map())
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ kind: "solo", name: "Bench" })
    expect((items[0] as { sets: SetLog[] }).sets).toHaveLength(2)
    expect(items[1]).toMatchObject({ kind: "solo", name: "Row" })
  })

  it("groups block cells into one circuit, round-major, ordered by position", () => {
    const metaById = new Map<string, BlockMeta>([
      ["beA", meta({ position: 0 })],
      ["beB", meta({ position: 1 })],
    ])
    const logs = [
      log({ block_exercise_id: "beB", exercise_name_snapshot: "Curl B", set_number: 1, weight_logged: 15 }),
      log({ block_exercise_id: "beA", exercise_name_snapshot: "Curl A", set_number: 1, weight_logged: 20 }),
      log({ block_exercise_id: "beA", exercise_name_snapshot: "Curl A", set_number: 2, weight_logged: 22 }),
      log({ block_exercise_id: "beB", exercise_name_snapshot: "Curl B", set_number: 2, weight_logged: 17 }),
    ]
    const items = groupSessionHistory(logs, metaById)
    expect(items).toHaveLength(1)
    const block = items[0]
    expect(block.kind).toBe("block")
    if (block.kind !== "block") throw new Error("expected block")
    expect(block.label).toBe("Bras")
    expect(block.exerciseCount).toBe(2)
    expect(block.rounds.map((r) => r.round)).toEqual([1, 2])
    // position 0 (A) before position 1 (B) within each round
    expect(block.rounds[0].cells.map((c) => c.name)).toEqual(["Curl A", "Curl B"])
    expect(block.rounds[1].cells.map((c) => c.log.weight_logged)).toEqual([22, 17])
  })

  it("treats a block log with missing meta as a solo (orphan fallback)", () => {
    const logs = [log({ block_exercise_id: "ghost", exercise_name_snapshot: "Deleted circuit exo" })]
    const items = groupSessionHistory(logs, new Map())
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ kind: "solo", name: "Deleted circuit exo" })
  })

  it("renders circuits before solos, circuits ordered by day sort_order", () => {
    const metaById = new Map<string, BlockMeta>([
      ["beEarly", meta({ blockId: "blkEarly", position: 0, blockSortOrder: 0, label: "Early" })],
      ["beLate", meta({ blockId: "blkLate", position: 0, blockSortOrder: 5, label: "Late" })],
    ])
    const logs = [
      log({ exercise_name_snapshot: "Solo squat" }),
      log({ block_exercise_id: "beLate" }),
      log({ block_exercise_id: "beEarly" }),
    ]
    const items = groupSessionHistory(logs, metaById)
    expect(items.map((i) => (i.kind === "block" ? i.label : i.name))).toEqual([
      "Early",
      "Late",
      "Solo squat",
    ])
  })
})
