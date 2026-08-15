import { describe, it, expect } from "vitest"
import {
  countBlockSetsDone,
  countSessionSlots,
  countSoloSetsDone,
  sessionHasSkippedSets,
} from "@/lib/sessionFinishStats"
import type { SetLog, WorkoutExercise } from "@/types/database"

const solo = (overrides: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  id: "x",
  workout_day_id: "day-1",
  exercise_id: "e",
  name_snapshot: "Push",
  muscle_snapshot: "chest",
  emoji_snapshot: "💪",
  sets: 2,
  reps: "10",
  weight: "0",
  rest_seconds: 60,
  sort_order: 0,
  rep_range_min: 8,
  rep_range_max: 12,
  set_range_min: 2,
  set_range_max: 5,
  weight_increment: null,
  max_weight_reached: false,
  template_updated_at: "2020-01-01T00:00:00Z",
  ...overrides,
})

describe("sessionFinishStats", () => {
  it("counts solo sets from setsData", () => {
    expect(
      countSoloSetsDone([solo({ id: "a" })], {
        a: [
          { kind: "reps", done: true, reps: "10", weight: "0" },
          { kind: "reps", done: false, reps: "10", weight: "0" },
        ],
      }),
    ).toBe(1)
  })

  it("dedupes block cells across persisted logs and the offline queue", () => {
    const logs = [
      {
        block_exercise_id: "be-1",
        set_number: 1,
      },
    ] as SetLog[]
    const queued = [
      {
        sessionId: "local-1",
        exerciseId: "ex-1",
        blockExerciseId: "be-1",
        setNumber: 1,
        exerciseNameSnapshot: "Push",
        repsLogged: "10",
        weightLogged: 0,
        estimatedOneRM: 0,
        wasPr: false,
        loggedAt: 1,
      },
      {
        sessionId: "local-1",
        exerciseId: "ex-2",
        blockExerciseId: "be-2",
        setNumber: 1,
        exerciseNameSnapshot: "Pull",
        repsLogged: "10",
        weightLogged: 0,
        estimatedOneRM: 0,
        wasPr: false,
        loggedAt: 2,
      },
    ]
    expect(countBlockSetsDone(logs, queued)).toBe(2)
  })

  it("counts session slots as solos plus blocks", () => {
    expect(
      countSessionSlots([solo({ id: "a" })], [
        {
          id: "blk-1",
          workout_day_id: "day-1",
          label: null,
          rounds: 2,
          rest_seconds: 0,
          transition_seconds: 0,
          mode: "rounds",
          cap_seconds: null,
          sort_order: 1,
          created_at: "2026-01-01",
          exercises: [],
        },
      ]),
    ).toBe(2)
  })

  // Repro: circuit → plank → circuit. All solo plank sets done, trailing
  // Finisher never started → sessions.has_skipped_sets must be true.
  it("is true when all solo sets are done but a circuit remains incomplete", () => {
    const plank = solo({ id: "plank" })
    expect(
      sessionHasSkippedSets(
        [plank],
        {
          plank: [
            {
              kind: "duration",
              targetSeconds: 45,
              weight: "0",
              done: true,
              timerStartedAt: null,
            },
            {
              kind: "duration",
              targetSeconds: 45,
              weight: "0",
              done: true,
              timerStartedAt: null,
            },
            {
              kind: "duration",
              targetSeconds: 45,
              weight: "0",
              done: true,
              timerStartedAt: null,
            },
          ],
        },
        1,
      ),
    ).toBe(true)
  })

  it("is false when every solo set is done and no circuit is incomplete", () => {
    const plank = solo({ id: "plank" })
    expect(
      sessionHasSkippedSets(
        [plank],
        {
          plank: [
            {
              kind: "duration",
              targetSeconds: 45,
              weight: "0",
              done: true,
              timerStartedAt: null,
            },
          ],
        },
        0,
      ),
    ).toBe(false)
  })

  it("is true when a solo set is left undone", () => {
    const plank = solo({ id: "plank" })
    expect(
      sessionHasSkippedSets(
        [plank],
        {
          plank: [
            {
              kind: "duration",
              targetSeconds: 45,
              weight: "0",
              done: true,
              timerStartedAt: null,
            },
            {
              kind: "duration",
              targetSeconds: 45,
              weight: "0",
              done: false,
              timerStartedAt: null,
            },
          ],
        },
        0,
      ),
    ).toBe(true)
  })
})
