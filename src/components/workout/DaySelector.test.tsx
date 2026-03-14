import { describe, expect, it } from "vitest"
import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { sessionAtom, type SessionState } from "@/store/atoms"
import type { WorkoutDay } from "@/types/database"
import { DaySelector } from "./DaySelector"

const DAYS: WorkoutDay[] = [
  {
    id: "day-a",
    user_id: "user-1",
    program_id: "program-1",
    label: "Monday",
    emoji: "🟦",
    sort_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "day-b",
    user_id: "user-1",
    program_id: "program-1",
    label: "Tuesday",
    emoji: "🟧",
    sort_order: 1,
    created_at: "2026-01-01T00:00:00.000Z",
  },
]

const BASE_SESSION: SessionState = {
  currentDayId: "day-a",
  activeDayId: "day-a",
  exerciseIndex: 2,
  setsData: {},
  startedAt: Date.now(),
  isActive: true,
  totalSetsDone: 5,
  pausedAt: null,
  accumulatedPause: 0,
}

describe("DaySelector", () => {
  it("allows navigation without mutating session progress while active", async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<DaySelector days={DAYS} />)
    act(() => {
      store.set(sessionAtom, BASE_SESSION)
    })

    await user.click(screen.getByRole("button", { name: /tuesday/i }))

    const next = store.get(sessionAtom)
    expect(next.currentDayId).toBe("day-b")
    expect(next.exerciseIndex).toBe(2)
    expect(next.totalSetsDone).toBe(5)
    expect(next.activeDayId).toBe("day-a")
  })

  it("resets index and total sets when inactive and switching day", async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<DaySelector days={DAYS} />)
    act(() => {
      store.set(sessionAtom, {
        ...BASE_SESSION,
        isActive: false,
        activeDayId: null,
      })
    })

    await user.click(screen.getByRole("button", { name: /tuesday/i }))

    const next = store.get(sessionAtom)
    expect(next.currentDayId).toBe("day-b")
    expect(next.exerciseIndex).toBe(0)
    expect(next.totalSetsDone).toBe(0)
  })
})
