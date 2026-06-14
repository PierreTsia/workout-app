import { describe, it, expect } from "vitest"
import {
  countBlockSetsDone,
  countSessionSlots,
  countSoloSetsDone,
} from "@/lib/sessionFinishStats"
import type { SetLog, WorkoutExercise } from "@/types/database"

const solo = (id: string): WorkoutExercise =>
  ({
    id,
    exercise_id: `ex-${id}`,
    workout_day_id: "day-1",
    name_snapshot: "Push",
    muscle_snapshot: "chest",
    emoji_snapshot: "💪",
    sets: 2,
    reps: 10,
    weight: 0,
    rest_seconds: 60,
    sort_order: 0,
    max_weight_reached: false,
    created_at: "2026-01-01",
  }) as WorkoutExercise

describe("sessionFinishStats", () => {
  it("counts solo sets from setsData", () => {
    expect(
      countSoloSetsDone([solo("a")], {
        a: [
          { done: true, reps: "10", weight: "0" },
          { done: false, reps: "10", weight: "0" },
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
      countSessionSlots([solo("a")], [
        {
          id: "blk-1",
          workout_day_id: "day-1",
          label: null,
          rounds: 2,
          rest_seconds: 0,
          transition_seconds: 0,
          sort_order: 1,
          created_at: "2026-01-01",
          exercises: [],
        },
      ]),
    ).toBe(2)
  })
})
