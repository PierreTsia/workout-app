import { describe, it, expect } from "vitest"
import {
  blockSetNumber,
  blockCellKey,
  buildBlockSetLogPayload,
  loggedBlockCells,
} from "@/lib/blockSetLog"
import type { BlockExerciseWithExercise, Exercise, SetLog } from "@/types/database"

const exercise = (over: Partial<Exercise> = {}): Exercise => ({
  id: "ex-1",
  name: "Push-ups",
  muscle_group: "chest",
  emoji: "💪",
  is_system: true,
  created_at: "2026-01-01",
  youtube_url: null,
  instructions: null,
  image_url: null,
  equipment: "bodyweight",
  difficulty_level: null,
  name_en: null,
  source: null,
  secondary_muscles: null,
  reviewed_at: null,
  reviewed_by: null,
  ...over,
})

const blockExercise = (
  over: Partial<BlockExerciseWithExercise> = {},
): BlockExerciseWithExercise => ({
  id: "be-A",
  block_id: "blk-1",
  exercise_id: "ex-1",
  name_snapshot: "Push-ups",
  muscle_snapshot: "chest",
  emoji_snapshot: "💪",
  position: 0,
  per_round: [
    { amount: 20, weight: 0 },
    { amount: 15, weight: 0 },
  ],
  exercise: exercise(),
  ...over,
})

const setLog = (over: Partial<SetLog> = {}): SetLog => ({
  id: "sl-1",
  session_id: "sess-1",
  exercise_id: "ex-1",
  block_exercise_id: null,
  workout_exercise_id: null,
  exercise_name_snapshot: "Push-ups",
  set_number: 1,
  reps_logged: "20",
  duration_seconds: null,
  weight_logged: 0,
  estimated_1rm: null,
  was_pr: false,
  logged_at: "2026-01-01T00:00:00Z",
  rir: null,
  rest_seconds: null,
  prescribed_reps: null,
  prescribed_weight: null,
  prescribed_sets: null,
  prescribed_duration_seconds: null,
  ...over,
})

describe("blockSetNumber / blockCellKey", () => {
  it("maps a 0-based round to a 1-based set_number", () => {
    expect(blockSetNumber(0)).toBe(1)
    expect(blockSetNumber(2)).toBe(3)
  })

  it("keys a cell by block_exercise_id and set_number", () => {
    expect(blockCellKey("be-A", 1)).toBe("be-A#1")
  })
})

describe("buildBlockSetLogPayload", () => {
  it("builds a reps payload for a reps exercise, tagged with the block cell", () => {
    const payload = buildBlockSetLogPayload({
      sessionId: "sess-1",
      blockExercise: blockExercise(),
      round: 1,
      now: 1000,
    })

    expect(payload).toEqual({
      sessionId: "sess-1",
      exerciseId: "ex-1",
      blockExerciseId: "be-A",
      exerciseNameSnapshot: "Push-ups",
      setNumber: 2,
      repsLogged: "15",
      weightLogged: 0,
      estimatedOneRM: 0,
      wasPr: false,
      loggedAt: 1000,
    })
  })

  it("builds a duration payload for a duration exercise", () => {
    const payload = buildBlockSetLogPayload({
      sessionId: "sess-1",
      blockExercise: blockExercise({
        per_round: [{ amount: 45, weight: 10 }],
        exercise: exercise({ measurement_type: "duration" }),
      }),
      round: 0,
      now: 2000,
    })

    expect(payload).toEqual({
      sessionId: "sess-1",
      exerciseId: "ex-1",
      blockExerciseId: "be-A",
      exerciseNameSnapshot: "Push-ups",
      setNumber: 1,
      durationSeconds: 45,
      weightLogged: 10,
      wasPr: false,
      loggedAt: 2000,
    })
  })

  it("writes leftover actual instead of the prescribed amount", () => {
    const payload = buildBlockSetLogPayload({
      sessionId: "sess-1",
      blockExercise: blockExercise({ per_round: [{ amount: 20, weight: 0 }] }),
      round: 7,
      now: 1000,
      mode: "amrap",
      actual: 3,
    })

    expect(payload).toEqual({
      sessionId: "sess-1",
      exerciseId: "ex-1",
      blockExerciseId: "be-A",
      exerciseNameSnapshot: "Push-ups",
      setNumber: 8,
      repsLogged: "3",
      weightLogged: 0,
      estimatedOneRM: 0,
      wasPr: false,
      loggedAt: 1000,
    })
  })

  it("treats a missing measurement_type as reps", () => {
    const payload = buildBlockSetLogPayload({
      sessionId: "sess-1",
      blockExercise: blockExercise({ exercise: exercise({ measurement_type: undefined }) }),
      round: 0,
      now: 1000,
    })

    expect(payload).toHaveProperty("repsLogged", "20")
    expect(payload).not.toHaveProperty("durationSeconds")
  })

  it("sets wasPr when a weighted Circuit station beats prior scores", () => {
    // Epley(180, 5) = 210 — beats a prior best of 200.
    const payload = buildBlockSetLogPayload({
      sessionId: "sess-2",
      blockExercise: blockExercise({
        id: "be-deadlift",
        exercise_id: "ex-deadlift",
        name_snapshot: "Deadlift",
        per_round: [{ amount: 5, weight: 180 }],
        exercise: exercise({
          id: "ex-deadlift",
          name: "Deadlift",
          equipment: "barbell",
          measurement_type: "reps",
        }),
      }),
      round: 0,
      now: 1000,
      pr: {
        historicalBest: 200,
        sessionBest: 0,
        hasPriorSession: true,
        historyFetched: true,
      },
    })

    expect(payload.wasPr).toBe(true)
  })

  it("sets wasPr when a duration Circuit station beats the prior best", () => {
    const payload = buildBlockSetLogPayload({
      sessionId: "sess-2",
      blockExercise: blockExercise({
        id: "be-plank",
        exercise_id: "ex-plank",
        name_snapshot: "Plank",
        per_round: [{ amount: 90, weight: 0 }],
        exercise: exercise({
          id: "ex-plank",
          name: "Plank",
          equipment: "bodyweight",
          measurement_type: "duration",
        }),
      }),
      round: 0,
      now: 2000,
      pr: {
        historicalBest: 60,
        sessionBest: 0,
        hasPriorSession: true,
        historyFetched: true,
      },
    })

    expect(payload.wasPr).toBe(true)
  })

  it("keys Profil PR on catalog exercise_id, not which Circuit the station sits in", () => {
    const deadliftStation = (blockExerciseId: string) =>
      blockExercise({
        id: blockExerciseId,
        exercise_id: "ex-deadlift",
        name_snapshot: "Deadlift",
        per_round: [{ amount: 5, weight: 180 }],
        exercise: exercise({
          id: "ex-deadlift",
          name: "Deadlift",
          equipment: "barbell",
          measurement_type: "reps",
        }),
      })
    const prior = {
      historicalBest: 200,
      sessionBest: 0,
      hasPriorSession: true,
      historyFetched: true,
    }

    const jetable = buildBlockSetLogPayload({
      sessionId: "sess-2",
      blockExercise: deadliftStation("be-jetable"),
      round: 0,
      now: 1000,
      pr: prior,
    })
    const catalog = buildBlockSetLogPayload({
      sessionId: "sess-2",
      blockExercise: deadliftStation("be-cindy"),
      round: 0,
      now: 1000,
      pr: prior,
    })

    expect(jetable.exerciseId).toBe("ex-deadlift")
    expect(catalog.exerciseId).toBe("ex-deadlift")
    expect(jetable.blockExerciseId).not.toBe(catalog.blockExerciseId)
    expect(jetable.wasPr).toBe(true)
    expect(catalog.wasPr).toBe(true)
  })
})

describe("loggedBlockCells", () => {
  it("collects only block rows, keyed by block_exercise_id and set_number", () => {
    const cells = loggedBlockCells([
      setLog({ block_exercise_id: "be-A", set_number: 1 }),
      setLog({ block_exercise_id: "be-A", set_number: 2 }),
      setLog({ block_exercise_id: "be-B", set_number: 1 }),
      setLog({ block_exercise_id: null, set_number: 1 }),
    ])

    expect(cells).toEqual(new Set(["be-A#1", "be-A#2", "be-B#1"]))
  })
})
