import { describe, expect, it } from "vitest"
import {
  needsCircuitFork,
  persistCircuitFork,
  type CircuitForkCatalog,
  type CircuitForkWriter,
} from "./circuitFork"
import type { BenchmarkCircuitRx } from "@/types/database"
import type { PerRoundCell } from "@/types/database"

const CINDY_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const USER_ID = "user-1"

const CINDY_RX: BenchmarkCircuitRx = {
  mode: "amrap",
  cap_seconds: 1200,
  exercises: [
    { exercise_id: "ex-pull", amount: 5, weight: 0 },
    { exercise_id: "ex-push", amount: 10, weight: 0 },
    { exercise_id: "ex-squat", amount: 15, weight: 0 },
  ],
}

function cells(amount: number): PerRoundCell[] {
  return [{ amount, weight: 0 }]
}

function pendingFromRx(
  rx: BenchmarkCircuitRx,
  capSeconds: number | null = rx.cap_seconds,
) {
  return {
    mode: rx.mode,
    cap_seconds: capSeconds,
    exercises: rx.exercises.map((ex) => ({
      exercise_id: ex.exercise_id,
      per_round: cells(ex.amount),
    })),
  }
}

describe("needsCircuitFork", () => {
  it("requires a fork when a non-owned Cindy seed changes cap 20 → 10", () => {
    expect(
      needsCircuitFork({
        benchmarkCircuitId: CINDY_ID,
        catalogOwnerId: null,
        currentUserId: USER_ID,
        catalogRx: CINDY_RX,
        pending: pendingFromRx(CINDY_RX, 600),
      }),
    ).toBe(true)
  })

  it("does not fork when the pending template still matches the catalog Rx", () => {
    expect(
      needsCircuitFork({
        benchmarkCircuitId: CINDY_ID,
        catalogOwnerId: null,
        currentUserId: USER_ID,
        catalogRx: CINDY_RX,
        pending: pendingFromRx(CINDY_RX),
      }),
    ).toBe(false)
  })

  it("does not insert another row when the catalog owner is the current user", () => {
    expect(
      needsCircuitFork({
        benchmarkCircuitId: "fork-1",
        catalogOwnerId: USER_ID,
        currentUserId: USER_ID,
        catalogRx: CINDY_RX,
        pending: pendingFromRx(CINDY_RX, 600),
      }),
    ).toBe(false)
  })

  it("does not fork a jetable block with no catalog id", () => {
    expect(
      needsCircuitFork({
        benchmarkCircuitId: null,
        catalogOwnerId: null,
        currentUserId: USER_ID,
        catalogRx: CINDY_RX,
        pending: pendingFromRx(CINDY_RX, 600),
      }),
    ).toBe(false)
  })

  it("does not treat leftover or missed session reps as a fork — only pending template vs catalog Rx", () => {
    expect(
      needsCircuitFork({
        benchmarkCircuitId: CINDY_ID,
        catalogOwnerId: null,
        currentUserId: USER_ID,
        catalogRx: CINDY_RX,
        pending: pendingFromRx(CINDY_RX),
      }),
    ).toBe(false)
  })
})

function makeCindyCatalog(): CircuitForkCatalog {
  return {
    id: CINDY_ID,
    owner_id: null,
    aliases: ["holland", "tom holland"],
    tagline_fr: "Le WOD de Tom Holland. 20 min.",
    tagline_en: "Tom Holland’s WOD. 20 min.",
    story_fr: null,
    story_en: null,
    reference: { name: "Tom Holland", score: "27" },
    rx: CINDY_RX,
  }
}

function makeWriter() {
  const inserts: unknown[] = []
  const retargets: { blockId: string; forkedId: string }[] = []
  const tables = new Set<string>()
  const writer: CircuitForkWriter = {
    insertFork: async (row) => {
      inserts.push(row)
      tables.add("benchmark_circuits")
      return { id: "fork-new" }
    },
    retargetBlock: async (blockId, forkedId) => {
      retargets.push({ blockId, forkedId })
      tables.add("exercise_blocks")
    },
  }
  return { writer, inserts, retargets, tables }
}

describe("persistCircuitFork", () => {
  it("inserts a private mutated row and retargets the day block without rewriting the seed or block_runs", async () => {
    const { writer, inserts, retargets, tables } = makeWriter()
    const pending = pendingFromRx(CINDY_RX, 600)

    const result = await persistCircuitFork(writer, {
      catalog: makeCindyCatalog(),
      currentUserId: USER_ID,
      pending,
      blockId: "block-monday",
    })

    expect(result).toEqual({ forkedId: "fork-new" })
    expect(inserts).toEqual([
      {
        slug: null,
        owner_id: USER_ID,
        forked_from: CINDY_ID,
        aliases: [],
        tagline_fr: "Le WOD de Tom Holland. 20 min.",
        tagline_en: "Tom Holland’s WOD. 20 min.",
        story_fr: null,
        story_en: null,
        reference: { name: "Tom Holland", score: "27" },
        rx: {
          mode: "amrap",
          cap_seconds: 600,
          exercises: [
            { exercise_id: "ex-pull", amount: 5, weight: 0 },
            { exercise_id: "ex-push", amount: 10, weight: 0 },
            { exercise_id: "ex-squat", amount: 15, weight: 0 },
          ],
        },
      },
    ])
    expect(retargets).toEqual([{ blockId: "block-monday", forkedId: "fork-new" }])
    expect([...tables]).toEqual(["benchmark_circuits", "exercise_blocks"])
    expect(tables.has("block_runs")).toBe(false)
  })

  it("leaves a Monday block_runs row stamped cindy after the day block FK is retargeted", async () => {
    const dayBlock = { id: "block-monday", benchmark_circuit_id: CINDY_ID }
    const mondayRun = {
      id: "run-monday",
      block_id: "block-monday",
      benchmark_circuit_id: CINDY_ID,
    }
    const writer: CircuitForkWriter = {
      insertFork: async () => ({ id: "fork-new" }),
      retargetBlock: async (blockId, forkedId) => {
        if (dayBlock.id === blockId) {
          dayBlock.benchmark_circuit_id = forkedId
        }
      },
    }

    await persistCircuitFork(writer, {
      catalog: makeCindyCatalog(),
      currentUserId: USER_ID,
      pending: pendingFromRx(CINDY_RX, 600),
      blockId: dayBlock.id,
    })

    expect(dayBlock.benchmark_circuit_id).toBe("fork-new")
    expect(mondayRun.benchmark_circuit_id).toBe(CINDY_ID)
  })
})
