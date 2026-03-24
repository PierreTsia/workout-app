import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"
import { useAdvanceWorkoutDayOnDateRollover } from "./useAdvanceWorkoutDayOnDateRollover"
import type { SessionState } from "@/store/atoms"

const DASHBOARD_EVAL_DATE_KEY = "workout-app-dashboard-eval-date"

function baseSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    currentDayId: "day-a",
    activeDayId: null,
    exerciseIndex: 0,
    setsData: {},
    startedAt: null,
    isActive: false,
    totalSetsDone: 0,
    pausedAt: null,
    accumulatedPause: 0,
    cycleId: null,
    ...overrides,
  }
}

function setupHook(props: {
  isSessionActive: boolean
  currentDayId: string | null
  completedDayIds: string[]
  nextDayId: string | null
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
  const setSession = vi.fn()

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)

  renderHook(
    () =>
      useAdvanceWorkoutDayOnDateRollover({
        ...props,
        setSession,
        queryClient,
      }),
    { wrapper },
  )

  return { setSession, invalidateSpy }
}

describe("useAdvanceWorkoutDayOnDateRollover", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("advances currentDayId to nextDayId on first eval when viewing a completed day", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date("2025-06-02T10:00:00"))

    const { setSession, invalidateSpy } = setupHook({
      isSessionActive: false,
      currentDayId: "day-a",
      completedDayIds: ["day-a"],
      nextDayId: "day-b",
    })

    expect(setSession).toHaveBeenCalledTimes(1)
    const updater = setSession.mock.calls[0]![0] as (p: SessionState) => SessionState
    const next = updater(baseSession({ currentDayId: "day-a", totalSetsDone: 3 }))
    expect(next.currentDayId).toBe("day-b")
    expect(next.exerciseIndex).toBe(0)
    expect(next.totalSetsDone).toBe(0)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["last-session-for-day"] })
    expect(sessionStorage.getItem(DASHBOARD_EVAL_DATE_KEY)).toBe("2025-06-02")
  })

  it("does not advance when session is active", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date("2025-06-02T10:00:00"))

    const { setSession } = setupHook({
      isSessionActive: true,
      currentDayId: "day-a",
      completedDayIds: ["day-a"],
      nextDayId: "day-b",
    })

    expect(setSession).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(DASHBOARD_EVAL_DATE_KEY)).toBeNull()
  })

  it("does not advance when current day is not completed in the cycle", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date("2025-06-02T10:00:00"))

    const { setSession } = setupHook({
      isSessionActive: false,
      currentDayId: "day-b",
      completedDayIds: ["day-a"],
      nextDayId: "day-b",
    })

    expect(setSession).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(DASHBOARD_EVAL_DATE_KEY)).toBe("2025-06-02")
  })

  it("does not advance again on the same calendar day (sessionStorage gate)", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date("2025-06-02T10:00:00"))

    sessionStorage.setItem(DASHBOARD_EVAL_DATE_KEY, "2025-06-02")

    const { setSession } = setupHook({
      isSessionActive: false,
      currentDayId: "day-a",
      completedDayIds: ["day-a"],
      nextDayId: "day-b",
    })

    expect(setSession).not.toHaveBeenCalled()
  })

  it("advances after the calendar day changes (interval tick)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date("2025-06-02T23:00:00"))

    const { setSession, invalidateSpy } = setupHook({
      isSessionActive: false,
      currentDayId: "day-a",
      completedDayIds: ["day-a"],
      nextDayId: "day-b",
    })

    setSession.mockClear()
    invalidateSpy.mockClear()

    vi.setSystemTime(new Date("2025-06-03T08:00:00"))

    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })

    expect(setSession).toHaveBeenCalledTimes(1)
    const updater = setSession.mock.calls[0]![0] as (p: SessionState) => SessionState
    expect(updater(baseSession({ currentDayId: "day-a" })).currentDayId).toBe("day-b")
    expect(sessionStorage.getItem(DASHBOARD_EVAL_DATE_KEY)).toBe("2025-06-03")
  })
})
