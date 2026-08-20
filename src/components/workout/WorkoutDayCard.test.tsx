import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders, mockQueryResult } from "@/test/utils"
import type {
  BlockExerciseWithExercise,
  ExerciseBlockWithExercises,
  WorkoutDay,
  WorkoutExerciseWithExercise,
} from "@/types/database"
import { WorkoutDayCard } from "./WorkoutDayCard"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

const useWorkoutExercises = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/useWorkoutExercises", () => ({ useWorkoutExercises }))

const useExerciseBlocks = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/useExerciseBlocks", () => ({ useExerciseBlocks }))

const useLastSessionForDay = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/useLastSessionForDay", () => ({ useLastSessionForDay }))

vi.mock("@/hooks/useAggregatedMuscles", () => ({
  useAggregatedMuscles: () => [],
}))

vi.mock("@/components/body-map/BodyMap", () => ({
  BodyMap: () => null,
}))

const day: WorkoutDay = {
  id: "day-1",
  user_id: "user-1",
  program_id: "prog-1",
  label: "Upper",
  emoji: "💪",
  sort_order: 0,
  created_at: "1970-01-01T00:00:00Z",
  saved_at: null,
}

function makeStation(
  blockId: string,
  position: number,
): BlockExerciseWithExercise {
  return {
    id: `${blockId}-be-${position}`,
    block_id: blockId,
    exercise_id: `ex-${blockId}-${position}`,
    name_snapshot: `Station ${position}`,
    muscle_snapshot: "full",
    emoji_snapshot: "🔥",
    position,
    per_round: [{ amount: 10, weight: 0 }],
    exercise: null,
  }
}

function makeCircuit(index: number): ExerciseBlockWithExercises {
  const id = `block-${index}`
  return {
    id,
    workout_day_id: "day-1",
    label: `Circuit ${index}`,
    rounds: 1,
    rest_seconds: 0,
    transition_seconds: 0,
    mode: "amrap",
    cap_seconds: 600,
    sort_order: index,
    created_at: "1970-01-01T00:00:00Z",
    exercises: [0, 1, 2].map((position) => makeStation(id, position)),
  }
}

function makeSolo(
  overrides: Partial<WorkoutExerciseWithExercise> = {},
): WorkoutExerciseWithExercise {
  return {
    id: "solo-1",
    workout_day_id: "day-1",
    exercise_id: "ex-solo",
    name_snapshot: "Squat",
    muscle_snapshot: "legs",
    emoji_snapshot: "🦵",
    sets: 3,
    reps: "10",
    weight: "60",
    rest_seconds: 90,
    sort_order: 0,
    template_updated_at: "1970-01-01T00:00:00Z",
    exercise: null,
    ...overrides,
  }
}

function stubDay({
  solos = [],
  blocks = [],
}: {
  solos?: WorkoutExerciseWithExercise[]
  blocks?: ExerciseBlockWithExercises[]
} = {}) {
  useWorkoutExercises.mockReturnValue(mockQueryResult(solos))
  useExerciseBlocks.mockReturnValue(mockQueryResult(blocks))
  useLastSessionForDay.mockReturnValue(
    mockQueryResult({
      id: "sess-1",
      started_at: "2026-08-20T10:00:00Z",
      finished_at: "2026-08-20T10:11:00Z",
      active_duration_ms: 11 * 60_000,
      total_sets_done: 12,
      has_skipped_sets: false,
    }),
  )
}

function fourCircuits() {
  return Array.from({ length: 4 }, (_, i) => makeCircuit(i))
}

function renderCard(isCycleDone: boolean) {
  return renderWithProviders(
    <WorkoutDayCard
      day={day}
      isActive
      isCycleDone={isCycleDone}
      shouldFetch
    />,
  )
}

describe("WorkoutDayCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows a Circuits badge for four 3-station Circuits, not flattened exercise count", () => {
    stubDay({ blocks: fourCircuits() })
    renderCard(true)

    expect(screen.getByText("4 Circuits")).toBeInTheDocument()
    expect(screen.queryByText("12 exercises")).not.toBeInTheDocument()
  })

  it("does not show last-session duration or set count on a done-in-cycle card", () => {
    stubDay({ blocks: fourCircuits() })
    renderCard(true)

    expect(screen.queryByText("11 min")).not.toBeInTheDocument()
    expect(screen.queryByText("12 sets")).not.toBeInTheDocument()
  })

  it("does not fetch last-session data for a done-in-cycle card", () => {
    stubDay({ blocks: fourCircuits() })
    renderCard(true)

    expect(useLastSessionForDay).toHaveBeenCalledWith(null)
  })

  it("does not show the last-session date on a done-in-cycle card", () => {
    stubDay({ blocks: fourCircuits() })
    renderCard(true)

    expect(screen.queryByText(/Last:/)).not.toBeInTheDocument()
  })

  it("still shows estimated sets on a day not yet done in the cycle", () => {
    stubDay({
      solos: [
        makeSolo({ id: "solo-1", sets: 3 }),
        makeSolo({ id: "solo-2", sets: 3, sort_order: 1 }),
      ],
    })
    renderCard(false)

    expect(screen.getByText("~6 sets")).toBeInTheDocument()
  })

  it("keeps the muted last-session date on a day not yet done in the cycle", () => {
    stubDay({
      solos: [makeSolo()],
    })
    renderCard(false)

    expect(screen.getByText(/Last:/)).toBeInTheDocument()
    expect(useLastSessionForDay).toHaveBeenCalledWith("day-1")
  })

  it("reuses exercise count copy for a solos-only day", () => {
    stubDay({
      solos: Array.from({ length: 6 }, (_, i) =>
        makeSolo({ id: `solo-${i}`, sort_order: i }),
      ),
    })
    renderCard(true)

    expect(screen.getByText("6 exercises")).toBeInTheDocument()
  })

  it("shows mixed Circuit and exercise counts on one badge", () => {
    stubDay({
      solos: [
        makeSolo({ id: "solo-1" }),
        makeSolo({ id: "solo-2", sort_order: 1 }),
        makeSolo({ id: "solo-3", sort_order: 2 }),
      ],
      blocks: [makeCircuit(0), makeCircuit(1)],
    })
    renderCard(true)

    expect(screen.getByText("2 Circuits · 3 exercises")).toBeInTheDocument()
  })
})
