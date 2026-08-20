import { describe, expect, it } from "vitest"
import type { DayItem, ExerciseBlockWithExercises } from "@/types/database"
import type {
  BlockHistoryGroup,
  SessionHistoryItem,
  SoloHistoryGroup,
} from "@/lib/sessionHistoryGrouping"
import { sessionCoverage } from "./sessionCoverage"

function makeLiveBlock(
  id: string,
  catalogId: string | null,
  sort_order: number,
): DayItem {
  const block: ExerciseBlockWithExercises = {
    id,
    workout_day_id: "day-1",
    label: id,
    rounds: 1,
    rest_seconds: 0,
    transition_seconds: 0,
    mode: "amrap",
    cap_seconds: 600,
    benchmark_circuit_id: catalogId,
    sort_order,
    created_at: "2026-01-01T00:00:00.000Z",
    exercises: [],
  }
  return { kind: "block", sort_order, block }
}

function makeLoggedCircuit(
  key: string,
  catalogId: string | null,
): BlockHistoryGroup {
  return {
    kind: "block",
    key,
    label: key,
    sortOrder: 0,
    rounds: [],
    exerciseCount: 5,
    mode: "amrap",
    benchmarkCircuitId: catalogId,
  }
}

function makeLoggedSolo(exerciseId: string): SoloHistoryGroup {
  return {
    kind: "solo",
    key: exerciseId,
    exercise: null,
    exercise_name_snapshot: exerciseId,
    sets: [],
  }
}

const PANTHEON: DayItem[] = [
  makeLiveBlock("block-theseus", "cat-theseus", 0),
  makeLiveBlock("block-zeus", "cat-zeus", 1),
  makeLiveBlock("block-heracles", "cat-heracles", 2),
  makeLiveBlock("block-ares", "cat-ares", 3),
]

describe("sessionCoverage", () => {
  it("counts Theseus as one sequence item against four live catalog Circuits", () => {
    const logged: SessionHistoryItem[] = [
      makeLoggedCircuit("block-theseus", "cat-theseus"),
    ]
    const runs = new Map([
      ["block-theseus", { benchmarkCircuitId: "cat-theseus" }],
    ])

    expect(sessionCoverage(logged, runs, PANTHEON)).toEqual({
      comparable: true,
      equal: false,
      loggedItems: 1,
      programItems: 4,
    })
  })

  it("treats identical catalog Circuit sets as equal", () => {
    const logged: SessionHistoryItem[] = [
      makeLoggedCircuit("block-theseus", "cat-theseus"),
      makeLoggedCircuit("block-zeus", "cat-zeus"),
      makeLoggedCircuit("block-heracles", "cat-heracles"),
      makeLoggedCircuit("block-ares", "cat-ares"),
    ]
    const matchingRuns = new Map([
      ["block-theseus", { benchmarkCircuitId: "cat-theseus" }],
      ["block-zeus", { benchmarkCircuitId: "cat-zeus" }],
      ["block-heracles", { benchmarkCircuitId: "cat-heracles" }],
      ["block-ares", { benchmarkCircuitId: "cat-ares" }],
    ])

    expect(sessionCoverage(logged, matchingRuns, PANTHEON)).toEqual({
      comparable: true,
      equal: true,
    })
  })

  it("is not comparable when a logged Circuit has no catalog id", () => {
    const logged: SessionHistoryItem[] = [
      makeLoggedCircuit("block-jetable", null),
    ]
    const runs = new Map([["block-jetable", { benchmarkCircuitId: null }]])

    expect(sessionCoverage(logged, runs, PANTHEON)).toEqual({
      comparable: false,
    })
  })

  it("is not comparable when a live Circuit is jetable", () => {
    const logged: SessionHistoryItem[] = [
      makeLoggedCircuit("block-theseus", "cat-theseus"),
    ]
    const runs = new Map([
      ["block-theseus", { benchmarkCircuitId: "cat-theseus" }],
    ])
    const day: DayItem[] = [
      makeLiveBlock("block-theseus", "cat-theseus", 0),
      makeLiveBlock("block-custom", null, 1),
    ]

    expect(sessionCoverage(logged, runs, day)).toEqual({ comparable: false })
  })

  it("treats wipe-shaped solos against catalog Circuits as a comparable mismatch", () => {
    const logged: SessionHistoryItem[] = [
      makeLoggedSolo("ex-row"),
      makeLoggedSolo("ex-dip"),
      makeLoggedSolo("ex-hang"),
    ]

    expect(sessionCoverage(logged, new Map(), PANTHEON)).toEqual({
      comparable: true,
      equal: false,
      loggedItems: 3,
      programItems: 4,
    })
  })
})
