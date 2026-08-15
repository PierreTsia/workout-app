import { afterEach, describe, expect, it, vi } from "vitest"
import { act, screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { sessionAtom } from "@/store/atoms"
import { BlockClockChrome } from "@/components/workout/BlockClockChrome"

const T0 = 1_700_000_000_000

describe("BlockClockChrome", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows elapsed wall-clock from the GO instant", () => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)

    renderWithProviders(<BlockClockChrome startedAt={T0} />)

    expect(screen.getByRole("timer", { name: /elapsed/i })).toHaveTextContent(
      "00:00",
    )
  })

  it("ticks elapsed seconds on a wall clock", () => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    renderWithProviders(<BlockClockChrome startedAt={T0} />)

    act(() => {
      vi.advanceTimersByTime(5_000)
    })

    expect(screen.getByRole("timer", { name: /elapsed/i })).toHaveTextContent(
      "00:05",
    )
  })

  it("keeps counting down during a session pause", () => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    const { store } = renderWithProviders(
      <BlockClockChrome startedAt={T0} capSeconds={20 * 60} />,
    )

    act(() => {
      store.set(sessionAtom, {
        ...store.get(sessionAtom),
        isActive: true,
        startedAt: T0,
        pausedAt: T0 + 1_000,
        accumulatedPause: 60_000,
      })
      vi.advanceTimersByTime(8_000)
    })

    expect(screen.getByRole("timer", { name: /remaining/i })).toHaveTextContent(
      "19:52",
    )
  })

  it("keeps ticking during a session pause (wall-clock, not SessionTimerChip)", () => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    const { store } = renderWithProviders(<BlockClockChrome startedAt={T0} />)

    act(() => {
      store.set(sessionAtom, {
        ...store.get(sessionAtom),
        isActive: true,
        startedAt: T0,
        pausedAt: T0 + 1_000,
        accumulatedPause: 60_000,
      })
      vi.advanceTimersByTime(8_000)
    })

    expect(screen.getByRole("timer", { name: /elapsed/i })).toHaveTextContent(
      "00:08",
    )
  })

  it("counts down remaining cap from the GO instant", () => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    renderWithProviders(
      <BlockClockChrome startedAt={T0} capSeconds={20 * 60} />,
    )

    expect(screen.getByRole("timer", { name: /remaining/i })).toHaveTextContent(
      "20:00",
    )

    act(() => {
      vi.advanceTimersByTime(12 * 60 * 1000)
    })
    expect(screen.getByRole("timer", { name: /remaining/i })).toHaveTextContent(
      "08:00",
    )
  })

  it("is not a button and ignores pointer events", () => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    renderWithProviders(<BlockClockChrome startedAt={T0} />)

    const clock = screen.getByRole("timer", { name: /elapsed/i })
    expect(clock.tagName).not.toBe("BUTTON")
    expect(clock).toHaveClass("pointer-events-none")
    expect(
      screen.queryByRole("button", { name: /elapsed/i }),
    ).not.toBeInTheDocument()
  })
})
