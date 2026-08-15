import { describe, expect, it } from "vitest"
import { resolveExerciseName } from "@/lib/catalogLabels"
import {
  buildBlockMetaMap,
  groupSessionHistory,
  type BlockExerciseMetaRow,
  type BlockMeta,
  type SoloHistoryGroup,
} from "@/lib/sessionHistoryGrouping"
import type { SetLogWithExercise } from "@/types/database"

const log = (over: Partial<SetLogWithExercise> = {}): SetLogWithExercise => ({
  id: crypto.randomUUID(),
  session_id: "s1",
  exercise_id: "ex",
  block_exercise_id: null,
  workout_exercise_id: null,
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
  prescribed_reps: null,
  prescribed_weight: null,
  prescribed_sets: null,
  prescribed_duration_seconds: null,
  exercise: null,
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
  mode: "rounds",
  benchmarkCircuitId: null,
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
        block: {
          id: "blk1",
          label: "Bras",
          rounds: 3,
          sort_order: 2,
          mode: "rounds",
          benchmark_circuit_id: null,
        },
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
      mode: "rounds",
      benchmarkCircuitId: null,
    })
  })
})

describe("groupSessionHistory", () => {
  it("groups solos by exercise_id", () => {
    const logs = [
      log({ exercise_id: "bench", set_number: 1, logged_at: at(0) }),
      log({ exercise_id: "bench", set_number: 2, logged_at: at(2) }),
      log({ exercise_id: "row", set_number: 1, logged_at: at(4) }),
    ]
    const items = groupSessionHistory(logs, new Map())
    expect(items).toHaveLength(2)
    expect(items.map((i) => i.key)).toEqual(["bench", "row"])
    expect((items[0] as SoloHistoryGroup).sets).toHaveLength(2)
  })

  it("keeps one group when a solo is revisited later in the session", () => {
    // Logs now arrive in logging order, so a user who comes back to add a set
    // interleaves them — consecutive-name grouping would show Bench twice.
    const logs = [
      log({ exercise_id: "bench", set_number: 1, logged_at: at(0) }),
      log({ exercise_id: "row", set_number: 1, logged_at: at(2) }),
      log({ exercise_id: "bench", set_number: 2, logged_at: at(4) }),
    ]
    const items = groupSessionHistory(logs, new Map())
    expect(items).toHaveLength(2)
    expect((items[0] as SoloHistoryGroup).sets.map((s) => s.set_number)).toEqual(
      [1, 2],
    )
  })

  it("keeps one group when the same exercise carries two different snapshots", () => {
    const logs = [
      log({ exercise_id: "squat", exercise_name_snapshot: "Squat", logged_at: at(0) }),
      log({
        exercise_id: "squat",
        exercise_name_snapshot: "Barbell Squat",
        logged_at: at(2),
      }),
    ]
    const items = groupSessionHistory(logs, new Map())
    expect(items).toHaveLength(1)
  })

  it("orders solo groups by their first log, not alphabetically", () => {
    const logs = [
      log({ exercise_id: "zzz", exercise_name_snapshot: "Zurcher", logged_at: at(0) }),
      log({ exercise_id: "aaa", exercise_name_snapshot: "Arnold", logged_at: at(5) }),
    ]
    const items = groupSessionHistory(logs, new Map())
    expect(items.map((i) => i.key)).toEqual(["zzz", "aaa"])
  })

  it("stays chronological when the caller hands over unsorted logs", () => {
    const logs = [
      log({ exercise_id: "row", logged_at: at(5) }),
      log({ exercise_id: "bench", logged_at: at(9), set_number: 2 }),
      log({
        exercise_id: "bench",
        logged_at: at(1),
        set_number: 1,
        exercise_name_snapshot: "Earliest",
      }),
    ]
    const [bench, row] = groupSessionHistory(logs, new Map()) as SoloHistoryGroup[]

    // Bench was trained first even though its earliest log arrives last.
    expect([bench.key, row.key]).toEqual(["bench", "row"])
    expect(bench.sets.map((s) => s.set_number)).toEqual([1, 2])
    // The group describes itself with its earliest log, not with whichever one
    // the caller happened to put first.
    expect(bench.exercise_name_snapshot).toBe("Earliest")
  })

  it("exposes the catalog row and the snapshot so the label resolves at render", () => {
    const embed = {
      id: "bench",
      name: "Développé couché",
      name_en: "Bench Press",
      muscle_group: "Pectoraux",
      equipment: "barbell",
      emoji: "🏋️",
    }
    const logs = [
      log({ exercise_id: "bench", exercise_name_snapshot: "Frozen", exercise: embed }),
    ]
    const [group] = groupSessionHistory(logs, new Map()) as SoloHistoryGroup[]

    expect(group.exercise).toEqual(embed)
    expect(group.exercise_name_snapshot).toBe("Frozen")
    expect(resolveExerciseName(group, "en")).toBe("Bench Press")
    expect(resolveExerciseName(group, "fr")).toBe("Développé couché")
  })

  it("falls back to the snapshot when the catalog row is gone", () => {
    const logs = [log({ exercise_name_snapshot: "Deleted exo", exercise: null })]
    const [group] = groupSessionHistory(logs, new Map()) as SoloHistoryGroup[]
    expect(resolveExerciseName(group, "en")).toBe("Deleted exo")
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
    expect(block.mode).toBe("rounds")
    expect(block.exerciseCount).toBe(2)
    expect(block.rounds.map((r) => r.round)).toEqual([1, 2])
    // position 0 (A) before position 1 (B) within each round
    expect(
      block.rounds[0].cells.map((c) => c.exercise_name_snapshot),
    ).toEqual(["Curl A", "Curl B"])
    expect(block.rounds[1].cells.map((c) => c.log.weight_logged)).toEqual([22, 17])
  })

  it("carries the catalog id so cindy days share one history sheet", () => {
    const metaById = new Map<string, BlockMeta>([
      ["beA", meta({ benchmarkCircuitId: "cindy-catalog" })],
    ])
    const logs = [log({ block_exercise_id: "beA" })]
    const [block] = groupSessionHistory(logs, metaById)
    if (block.kind !== "block") throw new Error("expected block")
    expect(block.benchmarkCircuitId).toBe("cindy-catalog")
  })

  it("carries the catalog row onto block cells too", () => {
    const metaById = new Map<string, BlockMeta>([["beA", meta()]])
    const embed = {
      id: "curl",
      name: "Curl biceps",
      name_en: "Biceps Curl",
      muscle_group: "Biceps",
      equipment: "dumbbell",
      emoji: "💪",
    }
    const logs = [log({ block_exercise_id: "beA", exercise: embed })]
    const [block] = groupSessionHistory(logs, metaById)
    if (block.kind !== "block") throw new Error("expected block")

    const [cell] = block.rounds[0].cells
    expect(resolveExerciseName(cell, "en")).toBe("Biceps Curl")
    expect(resolveExerciseName(cell, "fr")).toBe("Curl biceps")
  })

  it("treats a block log with missing meta as a solo (orphan fallback)", () => {
    const logs = [log({ block_exercise_id: "ghost", exercise_name_snapshot: "Deleted circuit exo" })]
    const items = groupSessionHistory(logs, new Map())
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      kind: "solo",
      exercise_name_snapshot: "Deleted circuit exo",
    })
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
    expect(
      items.map((i) => (i.kind === "block" ? i.label : i.exercise_name_snapshot)),
    ).toEqual([
      "Early",
      "Late",
      "Solo squat",
    ])
  })
})
