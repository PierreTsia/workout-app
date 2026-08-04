import { describe, expect, it } from "vitest"
import {
  buildBlockMetaMap,
  groupSessionHistory,
  type BlockExerciseMetaRow,
  type BlockMeta,
  type HistorySetLog,
  type SoloHistoryGroup,
} from "./sessionHistoryGrouping"

const log = (over: Partial<HistorySetLog> = {}): HistorySetLog => ({
  id: crypto.randomUUID(),
  exercise_id: "ex",
  block_exercise_id: null,
  exercise_name_snapshot: "Squat",
  set_number: 1,
  reps_logged: "10",
  duration_seconds: null,
  weight_logged: 100,
  was_pr: false,
  logged_at: "2026-06-13T10:00:00Z",
  ...over,
})

const at = (minutes: number) =>
  new Date(Date.UTC(2026, 5, 13, 10, minutes)).toISOString()

const meta = (over: Partial<BlockMeta> = {}): BlockMeta => ({
  blockId: "blk1",
  label: "Bras",
  position: 0,
  emoji: "💪",
  blockSortOrder: 0,
  ...over,
})

describe("buildBlockMetaMap (T166)", () => {
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

describe("groupSessionHistory (T166)", () => {
  it("groups block cells into one Circuit, round-major, ordered by position", () => {
    const metaById = new Map<string, BlockMeta>([
      ["beA", meta({ position: 0 })],
      ["beB", meta({ position: 1 })],
    ])
    const logs = [
      log({
        block_exercise_id: "beB",
        exercise_name_snapshot: "Curl B",
        set_number: 1,
        weight_logged: 15,
      }),
      log({
        block_exercise_id: "beA",
        exercise_name_snapshot: "Curl A",
        set_number: 1,
        weight_logged: 20,
      }),
      log({
        block_exercise_id: "beA",
        exercise_name_snapshot: "Curl A",
        set_number: 2,
        weight_logged: 22,
      }),
      log({
        block_exercise_id: "beB",
        exercise_name_snapshot: "Curl B",
        set_number: 2,
        weight_logged: 17,
      }),
    ]
    const items = groupSessionHistory(logs, metaById)
    expect(items).toHaveLength(1)
    const block = items[0]
    expect(block.kind).toBe("block")
    if (block.kind !== "block") throw new Error("expected block")
    expect(block.label).toBe("Bras")
    expect(block.exerciseCount).toBe(2)
    expect(block.rounds.map((r) => r.round)).toEqual([1, 2])
    expect(block.rounds[0].cells.map((c) => c.exercise_name_snapshot)).toEqual([
      "Curl A",
      "Curl B",
    ])
  })

  it("keeps the same exercise twice in a Circuit as distinct cells", () => {
    const metaById = new Map<string, BlockMeta>([
      ["beA", meta({ position: 0, blockId: "blk1" })],
      ["beA2", meta({ position: 1, blockId: "blk1", label: "Finisher" })],
    ])
    const logs = [
      log({
        block_exercise_id: "beA",
        exercise_id: "pushup",
        exercise_name_snapshot: "Push-up",
        set_number: 1,
      }),
      log({
        block_exercise_id: "beA2",
        exercise_id: "pushup",
        exercise_name_snapshot: "Push-up",
        set_number: 1,
      }),
    ]
    const items = groupSessionHistory(logs, metaById)
    expect(items).toHaveLength(1)
    if (items[0].kind !== "block") throw new Error("expected block")
    expect(items[0].rounds[0].cells).toHaveLength(2)
    expect(items[0].rounds[0].cells.map((c) => c.blockExerciseId)).toEqual([
      "beA",
      "beA2",
    ])
  })

  it("treats a block log with missing meta as a solo (orphan fallback)", () => {
    const logs = [
      log({
        block_exercise_id: "ghost",
        exercise_name_snapshot: "Deleted circuit exo",
      }),
    ]
    const items = groupSessionHistory(logs, new Map())
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      kind: "solo",
      exercise_name_snapshot: "Deleted circuit exo",
    })
  })

  it("renders Circuits before solos; solo-only sessions stay solo-only", () => {
    const metaById = new Map<string, BlockMeta>([
      ["be1", meta({ blockSortOrder: 0, label: "Finisher" })],
    ])
    const mixed = groupSessionHistory(
      [
        log({ exercise_name_snapshot: "Solo squat", logged_at: at(0) }),
        log({ block_exercise_id: "be1", exercise_name_snapshot: "Push-up", logged_at: at(1) }),
      ],
      metaById,
    )
    expect(mixed.map((i) => i.kind)).toEqual(["block", "solo"])

    const solosOnly = groupSessionHistory(
      [log({ exercise_name_snapshot: "Solo squat" }), log({ exercise_id: "row", exercise_name_snapshot: "Row" })],
      new Map(),
    )
    expect(solosOnly.every((i) => i.kind === "solo")).toBe(true)
    expect((solosOnly[0] as SoloHistoryGroup).sets.length).toBeGreaterThan(0)
  })
})
