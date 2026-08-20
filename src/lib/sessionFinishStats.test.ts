import { describe, it, expect } from "vitest"
import { sessionProgress } from "@/lib/sessionFinishStats"
import type { SessionSetRow } from "@/lib/sessionSetRow"
import type { SetLogPayloadReps } from "@/lib/syncService"
import type {
  ExerciseBlockWithExercises,
  SetLog,
  WorkoutExercise,
} from "@/types/database"

function makeQueued(
  overrides: Partial<SetLogPayloadReps> = {},
): SetLogPayloadReps {
  return {
    sessionId: "local-1",
    exerciseId: "ex-1",
    exerciseNameSnapshot: "Push",
    setNumber: 1,
    repsLogged: "10",
    weightLogged: 0,
    estimatedOneRM: 0,
    wasPr: false,
    loggedAt: 1,
    ...overrides,
  }
}

function makeSetLog(overrides: Partial<SetLog> = {}): SetLog {
  return {
    id: "log-1",
    session_id: "s1",
    exercise_id: "e1",
    block_exercise_id: null,
    workout_exercise_id: null,
    exercise_name_snapshot: "Push",
    set_number: 1,
    reps_logged: "10",
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
    ...overrides,
  }
}

function makeBlock(
  overrides: Partial<ExerciseBlockWithExercises> = {},
): ExerciseBlockWithExercises {
  return {
    id: "blk-cindy",
    workout_day_id: "day-1",
    label: "Cindy",
    rounds: 1,
    rest_seconds: 0,
    transition_seconds: 0,
    mode: "amrap",
    cap_seconds: 1200,
    sort_order: 0,
    created_at: "2026-01-01",
    exercises: [
      {
        id: "be-1",
        block_id: "blk-cindy",
        exercise_id: "e1",
        name_snapshot: "Pull-up",
        muscle_snapshot: "back",
        emoji_snapshot: "🏋️",
        position: 0,
        per_round: [],
        exercise: null,
      },
      {
        id: "be-2",
        block_id: "blk-cindy",
        exercise_id: "e2",
        name_snapshot: "Push-up",
        muscle_snapshot: "chest",
        emoji_snapshot: "💪",
        position: 1,
        per_round: [],
        exercise: null,
      },
    ],
    ...overrides,
  }
}

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

function hold(done: boolean): SessionSetRow {
  return {
    kind: "duration",
    targetSeconds: 45,
    weight: "0",
    done,
    timerStartedAt: null,
  }
}

describe("sessionProgress", () => {
  it("counts AMRAP setsDone as unique logged cells, not rounds × exercises", () => {
    const cindy = makeBlock()
    const progress = sessionProgress({
      exercises: [],
      setsData: {},
      blocks: [cindy],
      completedBlockIds: new Set([cindy.id]),
      persistedLogs: [],
      queuedPayloads: [
        makeQueued({ blockExerciseId: "be-1", setNumber: 1, loggedAt: 1 }),
        makeQueued({
          blockExerciseId: "be-2",
          setNumber: 1,
          exerciseId: "ex-2",
          loggedAt: 2,
        }),
        makeQueued({ blockExerciseId: "be-1", setNumber: 2, loggedAt: 3 }),
        makeQueued({
          blockExerciseId: "be-2",
          setNumber: 2,
          exerciseId: "ex-2",
          loggedAt: 4,
        }),
        makeQueued({ blockExerciseId: "be-1", setNumber: 3, loggedAt: 5 }),
      ],
    })
    expect(progress.setsDone).toBe(5)
    expect(cindy.rounds * cindy.exercises.length).toBe(2)
  })

  it("counts done solo rows toward setsDone", () => {
    const progress = sessionProgress({
      exercises: [solo({ id: "a" })],
      setsData: {
        a: [
          { kind: "reps", done: true, reps: "10", weight: "0" },
          { kind: "reps", done: false, reps: "10", weight: "0" },
        ],
      },
      blocks: [],
      completedBlockIds: new Set(),
      persistedLogs: [],
      queuedPayloads: [],
    })
    expect(progress.setsDone).toBe(1)
  })

  it("dedupes block cells across persisted logs and the offline queue", () => {
    const progress = sessionProgress({
      exercises: [],
      setsData: {},
      blocks: [makeBlock()],
      completedBlockIds: new Set(),
      persistedLogs: [
        makeSetLog({
          id: "log-be-1",
          block_exercise_id: "be-1",
          set_number: 1,
        }),
      ],
      queuedPayloads: [
        makeQueued({ blockExerciseId: "be-1", setNumber: 1, loggedAt: 1 }),
        makeQueued({
          blockExerciseId: "be-2",
          setNumber: 1,
          exerciseId: "ex-2",
          loggedAt: 2,
        }),
      ],
    })
    expect(progress.setsDone).toBe(2)
  })

  it("marks unfinished circuit as skipped even when every solo set is done", () => {
    const plank = solo({ id: "plank" })
    const progress = sessionProgress({
      exercises: [plank],
      setsData: { plank: [hold(true)] },
      blocks: [makeBlock()],
      completedBlockIds: new Set(),
      persistedLogs: [],
      queuedPayloads: [],
    })
    expect(progress.hasSkipped).toBe(true)
  })

  it("is not skipped when every solo set is done and no circuit is incomplete", () => {
    const plank = solo({ id: "plank" })
    const progress = sessionProgress({
      exercises: [plank],
      setsData: { plank: [hold(true)] },
      blocks: [],
      completedBlockIds: new Set(),
      persistedLogs: [],
      queuedPayloads: [],
    })
    expect(progress.hasSkipped).toBe(false)
  })

  it("is skipped when a solo set is left undone", () => {
    const plank = solo({ id: "plank" })
    const progress = sessionProgress({
      exercises: [plank],
      setsData: { plank: [hold(true), hold(false)] },
      blocks: [],
      completedBlockIds: new Set(),
      persistedLogs: [],
      queuedPayloads: [],
    })
    expect(progress.hasSkipped).toBe(true)
  })

  it("counts totalSlots as solos plus blocks", () => {
    const progress = sessionProgress({
      exercises: [solo({ id: "a" })],
      setsData: {},
      blocks: [makeBlock()],
      completedBlockIds: new Set(),
      persistedLogs: [],
      queuedPayloads: [],
    })
    expect(progress.totalSlots).toBe(2)
  })

  it("counts slotsCompleted as finished solos plus completed circuits", () => {
    const plank = solo({ id: "plank" })
    const cindy = makeBlock()
    const progress = sessionProgress({
      exercises: [plank],
      setsData: { plank: [hold(true)] },
      blocks: [cindy],
      completedBlockIds: new Set([cindy.id]),
      persistedLogs: [],
      queuedPayloads: [],
    })
    expect(progress.slotsCompleted).toBe(2)
  })
})
