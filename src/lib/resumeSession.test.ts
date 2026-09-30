import { describe, it, expect, vi } from "vitest"
import { getDefaultStore } from "jotai"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

import {
  resumeOrphanSession,
  hydrateSetsDataFromLogs,
  completedBlockIdsFromRuns,
  type OrphanSession,
} from "./resumeSession"
import { peekSessionRealId } from "@/lib/syncService"
import { sessionAtom } from "@/store/atoms"
import type { SetLog, WorkoutExercise } from "@/types/database"

const makeOrphan = (
  overrides: Partial<OrphanSession> = {},
): OrphanSession => ({
  id: "orphan-uuid",
  workout_day_id: "day-1",
  workout_label_snapshot: "Push",
  started_at: "2026-10-01T10:00:00.000Z",
  cycle_id: "cycle-1",
  ...overrides,
})

const makeExercise = (
  overrides: Partial<WorkoutExercise> = {},
): WorkoutExercise => ({
  id: "slot-1",
  workout_day_id: "day-1",
  exercise_id: "ex-1",
  name_snapshot: "Bench",
  muscle_snapshot: "chest",
  emoji_snapshot: "🏋️",
  sets: 3,
  reps: "10",
  weight: "60",
  rest_seconds: 90,
  sort_order: 0,
  template_updated_at: "2026-09-01T00:00:00.000Z",
  ...overrides,
})

const makeLog = (overrides: Partial<SetLog> = {}): SetLog => ({
  id: "log-1",
  session_id: "orphan-uuid",
  exercise_id: "ex-1",
  block_exercise_id: null,
  workout_exercise_id: "slot-1",
  exercise_name_snapshot: "Bench",
  set_number: 1,
  reps_logged: "8",
  duration_seconds: null,
  weight_logged: 62.5,
  estimated_1rm: null,
  was_pr: false,
  logged_at: "2026-10-01T10:05:00.000Z",
  rir: 2,
  rest_seconds: null,
  prescribed_reps: null,
  prescribed_weight: null,
  prescribed_sets: null,
  prescribed_duration_seconds: null,
  ...overrides,
})

describe("resumeOrphanSession", () => {
  it("seeds sessionMeta so the orphan's real id is preserved", () => {
    const orphan = makeOrphan()

    resumeOrphanSession(orphan, "user-1")

    const startedAt = Date.parse(orphan.started_at)
    expect(peekSessionRealId("user-1", `local-${startedAt}`)).toBe(
      "orphan-uuid",
    )
  })

  it("activates sessionAtom on the orphan's day and cycle", () => {
    const orphan = makeOrphan()

    resumeOrphanSession(orphan, "user-1")

    const session = getDefaultStore().get(sessionAtom)
    expect(session.isActive).toBe(true)
    expect(session.startedAt).toBe(Date.parse(orphan.started_at))
    expect(session.currentDayId).toBe("day-1")
    expect(session.activeDayId).toBe("day-1")
    expect(session.cycleId).toBe("cycle-1")
  })
})

describe("hydrateSetsDataFromLogs", () => {
  it("marks already-logged solo sets done with reps, weight and rir", () => {
    const result = hydrateSetsDataFromLogs(
      [makeExercise()],
      [makeLog()],
      new Map(),
    )

    expect(result["slot-1"]).toEqual([
      { kind: "reps", reps: "8", weight: "62.5", done: true, rir: 2 },
    ])
  })

  it("maps a duration log to a done duration row with loggedSeconds", () => {
    const log = makeLog({
      reps_logged: null,
      duration_seconds: 45,
      rir: null,
    })

    const result = hydrateSetsDataFromLogs([makeExercise()], [log], new Map())

    expect(result["slot-1"]).toEqual([
      {
        kind: "duration",
        targetSeconds: 30,
        weight: "62.5",
        done: true,
        timerStartedAt: null,
        loggedSeconds: 45,
      },
    ])
  })

  it("omits slots with no logs", () => {
    const result = hydrateSetsDataFromLogs(
      [makeExercise(), makeExercise({ id: "slot-2", exercise_id: "ex-2" })],
      [makeLog()],
      new Map(),
    )

    expect(result["slot-2"]).toBeUndefined()
    expect(Object.keys(result)).toEqual(["slot-1"])
  })

  it("ignores block logs", () => {
    const blockLog = makeLog({
      workout_exercise_id: null,
      block_exercise_id: "be-1",
    })

    const result = hydrateSetsDataFromLogs(
      [makeExercise()],
      [blockLog],
      new Map(),
    )

    expect(result).toEqual({})
  })
})

describe("completedBlockIdsFromRuns", () => {
  it("returns only the ids of finished block runs", () => {
    expect(
      completedBlockIdsFromRuns([
        { block_id: "b1", finished_at: "2026-10-01T10:00:00.000Z" },
        { block_id: "b2", finished_at: null },
      ]),
    ).toEqual(["b1"])
  })
})
