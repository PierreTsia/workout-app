import type { ReactNode } from "react"
import { describe, expect, it, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { createStore, Provider as JotaiProvider, useAtom } from "jotai"
import { sessionAtom, defaultSessionState, type SessionState } from "@/store/atoms"
import type { WorkoutExercise } from "@/types/database"
import { usePruneSessionSetsToExerciseList } from "./usePruneSessionSetsToExerciseList"

const ROW_A: WorkoutExercise = {
  id: "workout-ex-a",
  workout_day_id: "day-a",
  exercise_id: "lib-1",
  name_snapshot: "Bench",
  muscle_snapshot: "Chest",
  emoji_snapshot: "🏋️",
  sets: 3,
  reps: "10",
  weight: "60",
  rest_seconds: 90,
  sort_order: 0,
  target_duration_seconds: null,
  rep_range_min: 8,
  rep_range_max: 12,
  set_range_min: 2,
  set_range_max: 5,
  weight_increment: null,
  max_weight_reached: false,
}

const BASE_SESSION: SessionState = {
  ...defaultSessionState,
  currentDayId: "day-a",
  activeDayId: "day-a",
  isActive: true,
  startedAt: Date.now(),
  setsData: {
    "workout-ex-a": [
      { kind: "reps", reps: "10", weight: "60", done: true },
    ],
    "workout-ex-b": [
      { kind: "reps", reps: "8", weight: "50", done: true },
    ],
  },
}

function createTestStore(initial: SessionState) {
  const store = createStore()
  store.set(sessionAtom, initial)
  return store
}

describe("usePruneSessionSetsToExerciseList", () => {
  let store: ReturnType<typeof createTestStore>

  beforeEach(() => {
    store = createTestStore(BASE_SESSION)
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <JotaiProvider store={store}>{children}</JotaiProvider>
  )

  it("does not remove setsData while exercises are loading (empty list)", () => {
    renderHook(
      () => {
        const [, setSession] = useAtom(sessionAtom)
        usePruneSessionSetsToExerciseList([], true, setSession)
      },
      { wrapper },
    )

    expect(store.get(sessionAtom).setsData["workout-ex-a"]).toBeDefined()
    expect(store.get(sessionAtom).setsData["workout-ex-b"]).toBeDefined()
  })

  it("after load completes, prunes setsData to ids present in the exercise list", () => {
    const { rerender } = renderHook(
      ({
        exercises,
        exercisesLoading,
      }: {
        exercises: WorkoutExercise[]
        exercisesLoading: boolean
      }) => {
        const [, setSession] = useAtom(sessionAtom)
        usePruneSessionSetsToExerciseList(exercises, exercisesLoading, setSession)
      },
      {
        wrapper,
        initialProps: {
          exercises: [] as WorkoutExercise[],
          exercisesLoading: true,
        },
      },
    )

    expect(store.get(sessionAtom).setsData["workout-ex-a"]).toBeDefined()
    expect(store.get(sessionAtom).setsData["workout-ex-b"]).toBeDefined()

    act(() => {
      rerender({ exercises: [ROW_A], exercisesLoading: false })
    })

    expect(store.get(sessionAtom).setsData["workout-ex-a"]).toBeDefined()
    expect(store.get(sessionAtom).setsData["workout-ex-b"]).toBeUndefined()
  })
})
