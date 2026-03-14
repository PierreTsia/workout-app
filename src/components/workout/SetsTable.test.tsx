import { describe, expect, it, vi, beforeEach } from "vitest"
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

vi.mock("@/components/workout/RirDrawer", () => ({
  RirDrawer: ({
    open,
    onConfirm,
  }: {
    open: boolean
    onConfirm: (rir: number) => void
  }) =>
    open ? (
      <div data-testid="rir-drawer">
        <button onClick={() => onConfirm(2)} data-testid="rir-confirm">
          Confirm RIR
        </button>
      </div>
    ) : null,
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
    "workout-ex-1": [
      { reps: "10", weight: "60", done: false },
      { reps: "10", weight: "60", done: false },
    ],
  },
  startedAt: Date.now(),
  isActive: true,
  totalSetsDone: 0,
  pausedAt: null,
  accumulatedPause: 0,
}

describe("SetsTable", () => {
  beforeEach(() => {
    enqueueSetLogMock.mockClear()
  })

  it("locks all controls when rendered as read-only", async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(
      <SetsTable exercise={EXERCISE} sessionId="session-1" isReadOnly />,
    )
    act(() => {
      store.set(sessionAtom, BASE_SESSION)
    })

    const repsInput = screen.getAllByDisplayValue("10")[0]
    const weightInput = screen.getAllByDisplayValue("60")[0]
    const checkboxes = screen.getAllByRole("checkbox")
    const removeButton = screen.getByRole("button", { name: "Remove last set" })
    const addButton = screen.getByRole("button", { name: "Add set" })

    expect(repsInput).toBeDisabled()
    expect(weightInput).toBeDisabled()
    expect(checkboxes[0]).toBeDisabled()
    expect(removeButton).toBeDisabled()
    expect(addButton).toBeDisabled()

    await user.click(checkboxes[0])

    const next = store.get(sessionAtom)
    expect(next.setsData["workout-ex-1"][0].done).toBe(false)
    expect(next.totalSetsDone).toBe(0)
    expect(enqueueSetLogMock).not.toHaveBeenCalled()
  })

  it("opens RIR drawer on checkbox tap and enqueues set log with rir on confirm", async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(
      <SetsTable exercise={EXERCISE} sessionId="session-1" isReadOnly={false} />,
    )
    act(() => {
      store.set(sessionAtom, BASE_SESSION)
    })

    const checkboxes = screen.getAllByRole("checkbox")
    await user.click(checkboxes[0])

    expect(screen.getByTestId("rir-drawer")).toBeInTheDocument()

    await user.click(screen.getByTestId("rir-confirm"))

    expect(enqueueSetLogMock).toHaveBeenCalledTimes(1)
    expect(enqueueSetLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        exerciseId: "library-ex-1",
        setNumber: 1,
        rir: 2,
      }),
    )

    const next = store.get(sessionAtom)
    expect(next.setsData["workout-ex-1"][0].done).toBe(true)
    expect(next.setsData["workout-ex-1"][0].rir).toBe(2)
    expect(next.totalSetsDone).toBe(1)
  })

  it("clears rir and done when unchecking a completed set", async () => {
    const user = userEvent.setup()
    const sessionWithDoneSet: SessionState = {
      ...BASE_SESSION,
      setsData: {
        "workout-ex-1": [
          { reps: "10", weight: "60", done: true, rir: 2 },
          { reps: "10", weight: "60", done: false },
        ],
      },
      totalSetsDone: 1,
    }

    const { store } = renderWithProviders(
      <SetsTable exercise={EXERCISE} sessionId="session-1" isReadOnly={false} />,
    )
    act(() => {
      store.set(sessionAtom, sessionWithDoneSet)
    })

    const checkboxes = screen.getAllByRole("checkbox")
    await user.click(checkboxes[0])

    const next = store.get(sessionAtom)
    expect(next.setsData["workout-ex-1"][0].done).toBe(false)
    expect(next.setsData["workout-ex-1"][0].rir).toBeUndefined()
    expect(next.totalSetsDone).toBe(0)
    expect(screen.queryByTestId("rir-drawer")).not.toBeInTheDocument()
  })

  it("applies intra-session suggestion to next set after RIR confirm", async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(
      <SetsTable exercise={EXERCISE} sessionId="session-1" isReadOnly={false} />,
    )
    act(() => {
      store.set(sessionAtom, BASE_SESSION)
    })

    const checkboxes = screen.getAllByRole("checkbox")
    await user.click(checkboxes[0])
    await user.click(screen.getByTestId("rir-confirm"))

    const next = store.get(sessionAtom)
    const set2 = next.setsData["workout-ex-1"][1]
    expect(set2.weight).toBe("60")
    expect(set2.reps).toBe("10")
  })
})
