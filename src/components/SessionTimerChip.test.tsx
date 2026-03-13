import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { screen, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { sessionAtom, type SessionState } from "@/store/atoms"
import { SessionTimerChip } from "./SessionTimerChip"

const BASE_SESSION: SessionState = {
  currentDayId: "day-1",
  activeDayId: null,
  exerciseIndex: 0,
  setsData: {},
  startedAt: null,
  isActive: false,
  totalSetsDone: 0,
  pausedAt: null,
  accumulatedPause: 0,
}

describe("SessionTimerChip", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date("2026-01-01T00:00:30.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders nothing when session is inactive", () => {
    const { container, store } = renderWithProviders(<SessionTimerChip />)
    act(() => {
      store.set(sessionAtom, { ...BASE_SESSION, isActive: false, startedAt: null })
    })
    expect(container.innerHTML).toBe("")
  })

  it("renders elapsed time when session is active", () => {
    const startedAt = Date.now() - 65_000
    const { store } = renderWithProviders(<SessionTimerChip />)

    act(() => {
      store.set(sessionAtom, {
        ...BASE_SESSION,
        isActive: true,
        startedAt,
      })
    })

    act(() => { vi.advanceTimersByTime(1_000) })

    expect(screen.getByText("01:06")).toBeInTheDocument()
  })

  it("shows Pause button when running", () => {
    const { store } = renderWithProviders(<SessionTimerChip />)

    act(() => {
      store.set(sessionAtom, {
        ...BASE_SESSION,
        isActive: true,
        startedAt: Date.now() - 10_000,
      })
    })

    act(() => { vi.advanceTimersByTime(1_000) })

    expect(screen.getByRole("button", { name: "Pause workout" })).toBeInTheDocument()
  })

  it("switches to Resume after clicking Pause", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { store } = renderWithProviders(<SessionTimerChip />)

    act(() => {
      store.set(sessionAtom, {
        ...BASE_SESSION,
        isActive: true,
        startedAt: Date.now() - 10_000,
      })
    })

    act(() => { vi.advanceTimersByTime(1_000) })

    await user.click(screen.getByRole("button", { name: "Pause workout" }))

    expect(screen.getByRole("button", { name: "Resume workout" })).toBeInTheDocument()
    expect(store.get(sessionAtom).pausedAt).not.toBeNull()
  })

  it("resumes and accumulates pause duration on Play click", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const now = Date.now()
    const { store } = renderWithProviders(<SessionTimerChip />)

    act(() => {
      store.set(sessionAtom, {
        ...BASE_SESSION,
        isActive: true,
        startedAt: now - 30_000,
        pausedAt: now - 5_000,
        accumulatedPause: 0,
      })
    })

    act(() => { vi.advanceTimersByTime(1_000) })

    await user.click(screen.getByRole("button", { name: "Resume workout" }))

    const updated = store.get(sessionAtom)
    expect(updated.pausedAt).toBeNull()
    expect(updated.accumulatedPause).toBeGreaterThan(0)
  })

  it("freezes display while paused", () => {
    const now = Date.now()
    const { store } = renderWithProviders(<SessionTimerChip />)

    act(() => {
      store.set(sessionAtom, {
        ...BASE_SESSION,
        isActive: true,
        startedAt: now - 20_000,
        pausedAt: now - 5_000,
        accumulatedPause: 0,
      })
    })

    act(() => { vi.advanceTimersByTime(1_000) })

    const frozenText = screen.getByText("00:15")
    expect(frozenText).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(10_000) })

    expect(screen.getByText("00:15")).toBeInTheDocument()
  })
})
