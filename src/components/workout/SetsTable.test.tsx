import { describe, expect, it, vi } from "vitest"
import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { sessionAtom, type SessionState } from "@/store/atoms"
import type { WorkoutExercise } from "@/types/database"
import { SetsTable } from "./SetsTable"

const enqueueSetLogMock = vi.fn()

vi.mock("@/lib/syncService", () => ({
  enqueueSetLog: (...args: unknown[]) => enqueueSetLogMock(...args),
}))

vi.mock("@/hooks/useBest1RM", () => ({
  useBest1RM: () => ({ data: 0, isSuccess: true }),
}))

vi.mock("@/hooks/useWeightUnit", () => ({
  useWeightUnit: () => ({ unit: "kg", toKg: (value: number) => value }),
}))

const EXERCISE: WorkoutExercise = {
  id: "workout-ex-1",
  workout_day_id: "day-a",
  exercise_id: "library-ex-1",
  name_snapshot: "Bench Press",
  muscle_snapshot: "Chest",
  emoji_snapshot: "🏋️",
  sets: 3,
  reps: "10",
  weight: "60",
  rest_seconds: 90,
  sort_order: 0,
}

const BASE_SESSION: SessionState = {
  currentDayId: "day-b",
  activeDayId: "day-a",
  exerciseIndex: 0,
  setsData: {
    "workout-ex-1": [{ reps: "10", weight: "60", done: false }],
  },
  startedAt: Date.now(),
  isActive: true,
  totalSetsDone: 0,
  pausedAt: null,
  accumulatedPause: 0,
}

describe("SetsTable", () => {
  it("locks all controls when rendered as read-only", async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(
      <SetsTable exercise={EXERCISE} sessionId="session-1" isReadOnly />,
    )
    act(() => {
      store.set(sessionAtom, BASE_SESSION)
    })

    const repsInput = screen.getByDisplayValue("10")
    const weightInput = screen.getByDisplayValue("60")
    const checkbox = screen.getByRole("checkbox")
    const removeButton = screen.getByRole("button", { name: "Remove last set" })
    const addButton = screen.getByRole("button", { name: "Add set" })

    expect(repsInput).toBeDisabled()
    expect(weightInput).toBeDisabled()
    expect(checkbox).toBeDisabled()
    expect(removeButton).toBeDisabled()
    expect(addButton).toBeDisabled()

    await user.click(checkbox)

    const next = store.get(sessionAtom)
    expect(next.setsData["workout-ex-1"][0].done).toBe(false)
    expect(next.totalSetsDone).toBe(0)
    expect(enqueueSetLogMock).not.toHaveBeenCalled()
  })
})
