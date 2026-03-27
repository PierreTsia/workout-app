import type { ReactNode } from "react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { render, act, fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createStore, Provider as JotaiProvider } from "jotai"
import { I18nextProvider } from "react-i18next"
import { MemoryRouter } from "react-router-dom"
import { renderWithProviders, createTestI18n } from "@/test/utils"
import { sessionAtom, restAtom, type SessionState } from "@/store/atoms"
import type { Exercise, WorkoutExercise } from "@/types/database"
import type { ProgressionSuggestion } from "@/lib/progression"
import { SetsTable } from "./SetsTable"

const enqueueSetLogMock = vi.fn()

vi.mock("@/lib/syncService", () => ({
  enqueueSetLog: (...args: unknown[]) => enqueueSetLogMock(...args),
}))

vi.mock("@/hooks/useBest1RM", () => ({
  useBest1RM: () => ({ data: 0, isSuccess: true }),
}))

vi.mock("@/hooks/useWeightUnit", () => ({
  useWeightUnit: () => ({ unit: "kg", toKg: (value: number) => value, toDisplay: (kg: number) => kg }),
}))

let mockLibExercise: Exercise | undefined = undefined

vi.mock("@/hooks/useExerciseFromLibrary", () => ({
  useExerciseFromLibrary: () => ({ data: mockLibExercise }),
}))

let mockRirValue = 2

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
        <button onClick={() => onConfirm(mockRirValue)} data-testid="rir-confirm">
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
  target_duration_seconds: null,
  rep_range_min: 8,
  rep_range_max: 12,
  set_range_min: 2,
  set_range_max: 5,
  weight_increment: null,
  max_weight_reached: false,
}

const BASE_SESSION: SessionState = {
  currentDayId: "day-b",
  activeDayId: "day-a",
  exerciseIndex: 0,
  setsData: {
    "workout-ex-1": [
      { kind: "reps", reps: "10", weight: "60", done: false },
      { kind: "reps", reps: "10", weight: "60", done: false },
    ],
  },
  startedAt: Date.now(),
  isActive: true,
  cycleId: null,
  totalSetsDone: 0,
  pausedAt: null,
  accumulatedPause: 0,
}

describe("SetsTable", () => {
  beforeEach(() => {
    enqueueSetLogMock.mockClear()
    mockRirValue = 2
    mockLibExercise = undefined
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
          { kind: "reps", reps: "10", weight: "60", done: true, rir: 2 },
          { kind: "reps", reps: "10", weight: "60", done: false },
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
    expect(set2.kind).toBe("reps")
    if (set2.kind !== "reps") throw new Error("expected reps row")
    expect(set2.weight).toBe("60")
    expect(set2.reps).toBe("10")
  })

  it("increases next set weight when RIR is 4 (easy)", async () => {
    mockRirValue = 4
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
    expect(set2.kind).toBe("reps")
    if (set2.kind !== "reps") throw new Error("expected reps row")
    expect(set2.weight).toBe("62.5")
  })

  it("decreases next set weight when RIR is 0 (failure)", async () => {
    mockRirValue = 0
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
    expect(set2.kind).toBe("reps")
    if (set2.kind !== "reps") throw new Error("expected reps row")
    expect(set2.weight).toBe("57.5")
  })

  it("completes last set without crashing when there is no next set", async () => {
    const user = userEvent.setup()
    const singleSetSession: SessionState = {
      ...BASE_SESSION,
      setsData: {
        "workout-ex-1": [{ kind: "reps", reps: "10", weight: "60", done: false }],
      },
    }

    const { store } = renderWithProviders(
      <SetsTable exercise={EXERCISE} sessionId="session-1" isReadOnly={false} />,
    )
    act(() => {
      store.set(sessionAtom, singleSetSession)
    })

    const checkbox = screen.getByRole("checkbox")
    await user.click(checkbox)
    await user.click(screen.getByTestId("rir-confirm"))

    const next = store.get(sessionAtom)
    expect(next.setsData["workout-ex-1"][0].done).toBe(true)
    expect(next.setsData["workout-ex-1"][0].rir).toBe(2)
    expect(next.totalSetsDone).toBe(1)
  })

  it("starts rest timer after RIR confirm", async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(
      <SetsTable exercise={EXERCISE} sessionId="session-1" isReadOnly={false} />,
    )
    act(() => {
      store.set(sessionAtom, BASE_SESSION)
    })

    expect(store.get(restAtom)).toBeNull()

    const checkboxes = screen.getAllByRole("checkbox")
    await user.click(checkboxes[0])
    await user.click(screen.getByTestId("rir-confirm"))

    const rest = store.get(restAtom)
    expect(rest).not.toBeNull()
    expect(rest!.durationSeconds).toBe(90)
  })

  it("starts rest timer even when completing the last remaining set", async () => {
    const user = userEvent.setup()
    const oneLeftSession: SessionState = {
      ...BASE_SESSION,
      setsData: {
        "workout-ex-1": [
          { kind: "reps", reps: "10", weight: "60", done: true, rir: 2 },
          { kind: "reps", reps: "10", weight: "60", done: false },
        ],
      },
      totalSetsDone: 1,
    }

    const { store } = renderWithProviders(
      <SetsTable exercise={EXERCISE} sessionId="session-1" isReadOnly={false} />,
    )
    act(() => {
      store.set(sessionAtom, oneLeftSession)
      store.set(restAtom, null)
    })

    const checkboxes = screen.getAllByRole("checkbox")
    await user.click(checkboxes[1])
    await user.click(screen.getByTestId("rir-confirm"))

    const rest = store.get(restAtom)
    expect(rest).not.toBeNull()
    expect(rest!.durationSeconds).toBe(90)
    const next = store.get(sessionAtom)
    expect(next.setsData["workout-ex-1"].every((s) => s.done)).toBe(true)
  })

  it("shows 'kg/arm' label when equipment is dumbbell (#49)", () => {
    const { store } = renderWithProviders(
      <SetsTable exercise={EXERCISE} sessionId="session-1" isReadOnly={false} equipment="dumbbell" />,
    )
    act(() => {
      store.set(sessionAtom, BASE_SESSION)
    })

    expect(screen.getByText("kg/arm")).toBeInTheDocument()
  })

  it("shows '+kg' label when equipment is bodyweight (#50)", () => {
    const { store } = renderWithProviders(
      <SetsTable exercise={EXERCISE} sessionId="session-1" isReadOnly={false} equipment="bodyweight" />,
    )
    act(() => {
      store.set(sessionAtom, BASE_SESSION)
    })

    expect(screen.getByText("+kg")).toBeInTheDocument()
  })

  it("shows plain unit label for barbell equipment", () => {
    const { store } = renderWithProviders(
      <SetsTable exercise={EXERCISE} sessionId="session-1" isReadOnly={false} equipment="barbell" />,
    )
    act(() => {
      store.set(sessionAtom, BASE_SESSION)
    })

    expect(screen.getByText("kg")).toBeInTheDocument()
  })

  it("uses dumbbell increment (2kg) for RIR 4+ when equipment is dumbbell (#49)", async () => {
    mockRirValue = 4
    const user = userEvent.setup()
    const { store } = renderWithProviders(
      <SetsTable exercise={EXERCISE} sessionId="session-1" isReadOnly={false} equipment="dumbbell" />,
    )
    act(() => {
      store.set(sessionAtom, BASE_SESSION)
    })

    const checkboxes = screen.getAllByRole("checkbox")
    await user.click(checkboxes[0])
    await user.click(screen.getByTestId("rir-confirm"))

    const next = store.get(sessionAtom)
    const set2 = next.setsData["workout-ex-1"][1]
    expect(set2.kind).toBe("reps")
    if (set2.kind !== "reps") throw new Error("expected reps row")
    expect(set2.weight).toBe("62")
  })

  it("disables remove button when last set is completed", () => {
    const sessionWithLastDone: SessionState = {
      ...BASE_SESSION,
      setsData: {
        "workout-ex-1": [
          { kind: "reps", reps: "10", weight: "60", done: false },
          { kind: "reps", reps: "10", weight: "60", done: true, rir: 2 },
        ],
      },
      totalSetsDone: 1,
    }

    const { store } = renderWithProviders(
      <SetsTable exercise={EXERCISE} sessionId="session-1" isReadOnly={false} />,
    )
    act(() => {
      store.set(sessionAtom, sessionWithLastDone)
    })

    const removeButton = screen.getByRole("button", { name: "Remove last set" })
    expect(removeButton).toBeDisabled()
  })

  it("enables remove button when last set is not completed", async () => {
    const { store } = renderWithProviders(
      <SetsTable exercise={EXERCISE} sessionId="session-1" isReadOnly={false} />,
    )
    act(() => {
      store.set(sessionAtom, BASE_SESSION)
    })

    const removeButton = screen.getByRole("button", { name: "Remove last set" })
    expect(removeButton).not.toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Auto-apply progression suggestion tests
// ---------------------------------------------------------------------------

/**
 * Render SetsTable with the session atom pre-populated so that the auto-apply
 * useEffect fires with actual data on mount.
 */
function renderWithPreloadedSession(
  session: SessionState,
  props: {
    exercise?: WorkoutExercise
    sessionId?: string
    isReadOnly?: boolean
    equipment?: string
    suggestion?: ProgressionSuggestion | null
  } = {},
) {
  const store = createStore()
  store.set(sessionAtom, session)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  const i18nInstance = createTestI18n()

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <JotaiProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18nInstance}>
            <MemoryRouter>{children}</MemoryRouter>
          </I18nextProvider>
        </QueryClientProvider>
      </JotaiProvider>
    )
  }

  const result = render(
    <SetsTable
      exercise={props.exercise ?? EXERCISE}
      sessionId={props.sessionId ?? "s-1"}
      isReadOnly={props.isReadOnly ?? false}
      equipment={props.equipment}
      suggestion={props.suggestion}
    />,
    { wrapper: Wrapper },
  )

  return { ...result, store }
}

describe("SetsTable – auto-apply progression", () => {
  beforeEach(() => {
    enqueueSetLogMock.mockClear()
    mockLibExercise = undefined
  })

  it("auto-applies suggestion reps and weight to all undone sets", async () => {
    const suggestion: ProgressionSuggestion = {
      rule: "REPS_UP",
      reps: 12,
      weight: 65,
      sets: 2,
      reasonKey: "progression.repsUp",
      delta: "+1 rep",
      volumeType: "reps",
    }
    const { store } = renderWithPreloadedSession(BASE_SESSION, { suggestion })

    await waitFor(() => {
      const rows = store.get(sessionAtom).setsData["workout-ex-1"]
      expect(rows[0]).toMatchObject({ reps: "12", weight: "65" })
      expect(rows[1]).toMatchObject({ reps: "12", weight: "65" })
    })
  })

  it("is a no-op when suggestion already matches current sets", () => {
    const suggestion: ProgressionSuggestion = {
      rule: "REPS_UP",
      reps: 10,
      weight: 60,
      sets: 2,
      reasonKey: "progression.repsUp",
      delta: "+1 rep",
      volumeType: "reps",
    }
    const { store } = renderWithPreloadedSession(BASE_SESSION, { suggestion })

    const rows = store.get(sessionAtom).setsData["workout-ex-1"]
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ reps: "10", weight: "60" })
  })

  it("skips auto-apply when a set is already done", () => {
    const suggestion: ProgressionSuggestion = {
      rule: "REPS_UP",
      reps: 12,
      weight: 65,
      sets: 2,
      reasonKey: "progression.repsUp",
      delta: "+1 rep",
      volumeType: "reps",
    }
    const sessionWithDone: SessionState = {
      ...BASE_SESSION,
      setsData: {
        "workout-ex-1": [
          { kind: "reps", reps: "10", weight: "60", done: true, rir: 2 },
          { kind: "reps", reps: "10", weight: "60", done: false },
        ],
      },
      totalSetsDone: 1,
    }
    const { store } = renderWithPreloadedSession(sessionWithDone, { suggestion })

    const rows = store.get(sessionAtom).setsData["workout-ex-1"]
    expect(rows[0]).toMatchObject({ reps: "10", weight: "60" })
    expect(rows[1]).toMatchObject({ reps: "10", weight: "60" })
  })

  it("skips auto-apply when isReadOnly", () => {
    const suggestion: ProgressionSuggestion = {
      rule: "REPS_UP",
      reps: 12,
      weight: 65,
      sets: 2,
      reasonKey: "progression.repsUp",
      delta: "+1 rep",
      volumeType: "reps",
    }
    const { store } = renderWithPreloadedSession(BASE_SESSION, {
      suggestion,
      isReadOnly: true,
    })

    const rows = store.get(sessionAtom).setsData["workout-ex-1"]
    expect(rows[0]).toMatchObject({ reps: "10", weight: "60" })
  })

  it("skips auto-apply for duration exercises", () => {
    mockLibExercise = DURATION_LIB_EXERCISE
    const suggestion: ProgressionSuggestion = {
      rule: "REPS_UP",
      reps: 12,
      weight: 65,
      sets: 2,
      reasonKey: "progression.repsUp",
      delta: "+1 rep",
      volumeType: "reps",
    }
    const { store } = renderWithPreloadedSession(BASE_DURATION_SESSION, {
      exercise: DURATION_EXERCISE,
      suggestion,
    })

    const rows = store.get(sessionAtom).setsData["workout-ex-dur"]
    expect(rows[0]).toMatchObject({ kind: "duration" })
  })

  it("adds rows when SETS_UP suggests more sets than currently exist", async () => {
    const suggestion: ProgressionSuggestion = {
      rule: "SETS_UP",
      reps: 8,
      weight: 60,
      sets: 4,
      reasonKey: "progression.setsUp",
      delta: "+1 set",
      volumeType: "reps",
    }
    const { store } = renderWithPreloadedSession(BASE_SESSION, { suggestion })

    await waitFor(() => {
      const rows = store.get(sessionAtom).setsData["workout-ex-1"]
      expect(rows).toHaveLength(4)
      expect(rows[2]).toMatchObject({ kind: "reps", reps: "8", weight: "60", done: false })
      expect(rows[3]).toMatchObject({ kind: "reps", reps: "8", weight: "60", done: false })
    })
  })

  it("does nothing when suggestion is null", () => {
    const { store } = renderWithPreloadedSession(BASE_SESSION, { suggestion: null })

    const rows = store.get(sessionAtom).setsData["workout-ex-1"]
    expect(rows[0]).toMatchObject({ reps: "10", weight: "60" })
  })
})

// ---------------------------------------------------------------------------
// Duration exercise tests
// ---------------------------------------------------------------------------

const DURATION_LIB_EXERCISE: Exercise = {
  id: "library-ex-dur",
  name: "Plank",
  muscle_group: "Core",
  emoji: "🔥",
  is_system: true,
  created_at: "2024-01-01T00:00:00Z",
  youtube_url: null,
  instructions: null,
  image_url: null,
  equipment: "bodyweight",
  difficulty_level: null,
  name_en: "Plank",
  source: null,
  secondary_muscles: null,
  reviewed_at: null,
  reviewed_by: null,
  measurement_type: "duration",
  default_duration_seconds: 3,
}

const DURATION_EXERCISE: WorkoutExercise = {
  id: "workout-ex-dur",
  workout_day_id: "day-a",
  exercise_id: "library-ex-dur",
  name_snapshot: "Plank",
  muscle_snapshot: "Core",
  emoji_snapshot: "🔥",
  sets: 2,
  reps: "1",
  weight: "0",
  rest_seconds: 60,
  sort_order: 0,
  target_duration_seconds: 3,
  rep_range_min: 1,
  rep_range_max: 1,
  set_range_min: 2,
  set_range_max: 4,
  weight_increment: null,
  max_weight_reached: false,
}

// targetSeconds: 3 keeps fake-timer tests fast (3 × 250 ms interval ticks)
const BASE_DURATION_SESSION: SessionState = {
  ...BASE_SESSION,
  setsData: {
    "workout-ex-dur": [
      { kind: "duration", targetSeconds: 3, weight: "0", done: false, timerStartedAt: null },
      { kind: "duration", targetSeconds: 3, weight: "0", done: false, timerStartedAt: null },
    ],
  },
  totalSetsDone: 0,
}

describe("SetsTable – duration exercises", () => {
  beforeEach(() => {
    enqueueSetLogMock.mockClear()
    mockLibExercise = DURATION_LIB_EXERCISE
  })

  afterEach(() => {
    mockLibExercise = undefined
    vi.useRealTimers()
  })

  it("renders a Play button for each incomplete duration row", () => {
    const { store } = renderWithProviders(
      <SetsTable exercise={DURATION_EXERCISE} sessionId="session-1" isReadOnly={false} />,
    )
    act(() => {
      store.set(sessionAtom, BASE_DURATION_SESSION)
    })

    const playButtons = screen.getAllByRole("button", { name: "Start" })
    expect(playButtons).toHaveLength(2)
    playButtons.forEach((btn) => expect(btn).not.toBeDisabled())
  })

  it("clicking Play sets timerStartedAt on the correct row", async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(
      <SetsTable exercise={DURATION_EXERCISE} sessionId="session-1" isReadOnly={false} />,
    )
    act(() => {
      store.set(sessionAtom, BASE_DURATION_SESSION)
    })

    const before = Date.now()
    await user.click(screen.getAllByRole("button", { name: "Start" })[0])
    const after = Date.now()

    const rows = store.get(sessionAtom).setsData["workout-ex-dur"]
    const r0 = rows[0]
    const r1 = rows[1]
    expect(r0.kind).toBe("duration")
    expect(r1.kind).toBe("duration")
    if (r0.kind !== "duration" || r1.kind !== "duration") throw new Error("expected duration rows")
    expect(r0.timerStartedAt).toBeGreaterThanOrEqual(before)
    expect(r0.timerStartedAt).toBeLessThanOrEqual(after)
    expect(r1.timerStartedAt).toBeNull()
  })

  it("disables other Play buttons while a timer is running", async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(
      <SetsTable exercise={DURATION_EXERCISE} sessionId="session-1" isReadOnly={false} />,
    )
    act(() => {
      store.set(sessionAtom, BASE_DURATION_SESSION)
    })

    await user.click(screen.getAllByRole("button", { name: "Start" })[0])

    // Row 0 is running — shows "End early"; row 1 still shows "Start" but disabled
    expect(screen.getByRole("button", { name: "End early" })).toBeInTheDocument()
    const remainingPlay = screen.getAllByRole("button", { name: "Start" })
    expect(remainingPlay).toHaveLength(1)
    expect(remainingPlay[0]).toBeDisabled()
  })

  it("clears rest timer when Play is tapped", async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(
      <SetsTable exercise={DURATION_EXERCISE} sessionId="session-1" isReadOnly={false} />,
    )
    act(() => {
      store.set(sessionAtom, BASE_DURATION_SESSION)
      store.set(restAtom, {
        startedAt: Date.now(),
        durationSeconds: 60,
        pausedAt: null,
        accumulatedPause: 0,
      })
    })

    await user.click(screen.getAllByRole("button", { name: "Start" })[0])

    expect(store.get(restAtom)).toBeNull()
  })

  it("auto-completes and enqueues set log when countdown reaches zero", () => {
    vi.useFakeTimers()
    const T0 = 1_000_000
    vi.setSystemTime(T0)

    const { store } = renderWithProviders(
      <SetsTable exercise={DURATION_EXERCISE} sessionId="session-1" isReadOnly={false} />,
    )
    act(() => {
      store.set(sessionAtom, BASE_DURATION_SESSION)
    })

    act(() => {
      fireEvent.click(screen.getAllByRole("button", { name: "Start" })[0])
    })

    const row0 = store.get(sessionAtom).setsData["workout-ex-dur"][0]
    expect(row0.kind).toBe("duration")
    if (row0.kind !== "duration") throw new Error("expected duration row")
    expect(row0.timerStartedAt).toBe(T0)

    // Advance past targetSeconds (3 s)
    act(() => {
      vi.advanceTimersByTime(3_250)
    })

    const rows = store.get(sessionAtom).setsData["workout-ex-dur"]
    const done0 = rows[0]
    expect(done0.kind).toBe("duration")
    if (done0.kind !== "duration") throw new Error("expected duration row")
    expect(done0.done).toBe(true)
    expect(done0.loggedSeconds).toBe(3)
    expect(enqueueSetLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        exerciseId: "library-ex-dur",
        setNumber: 1,
        durationSeconds: 3,
      }),
    )
  })

  it("End early button logs elapsed seconds and marks set done", () => {
    vi.useFakeTimers()
    const T0 = 1_000_000
    vi.setSystemTime(T0)

    const { store } = renderWithProviders(
      <SetsTable exercise={DURATION_EXERCISE} sessionId="session-1" isReadOnly={false} />,
    )
    act(() => {
      store.set(sessionAtom, BASE_DURATION_SESSION)
    })

    act(() => {
      fireEvent.click(screen.getAllByRole("button", { name: "Start" })[0])
    })

    // Advance 1 s (well within targetSeconds: 3)
    act(() => {
      vi.advanceTimersByTime(1_250)
    })

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "End early" }))
    })

    const rows = store.get(sessionAtom).setsData["workout-ex-dur"]
    const done0 = rows[0]
    expect(done0.kind).toBe("duration")
    if (done0.kind !== "duration") throw new Error("expected duration row")
    expect(done0.done).toBe(true)
    expect(done0.loggedSeconds).toBe(1)
    expect(enqueueSetLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ durationSeconds: 1 }),
    )
  })
})
