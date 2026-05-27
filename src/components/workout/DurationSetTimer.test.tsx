import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import userEvent from "@testing-library/user-event"
import { act, screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { DurationSetTimer } from "./DurationSetTimer"

vi.mock("@/lib/audio", () => ({
  primeAudio: vi.fn(),
  playWarningBeep: vi.fn(),
  playFinishBeeps: vi.fn(),
}))

vi.mock("@/hooks/useKeepScreenAwake", () => ({
  useKeepScreenAwake: vi.fn(),
}))

import { primeAudio, playWarningBeep, playFinishBeeps } from "@/lib/audio"
import { useKeepScreenAwake } from "@/hooks/useKeepScreenAwake"

const mockedPrimeAudio = vi.mocked(primeAudio)
const mockedPlayWarningBeep = vi.mocked(playWarningBeep)
const mockedPlayFinishBeeps = vi.mocked(playFinishBeeps)
const mockedUseKeepScreenAwake = vi.mocked(useKeepScreenAwake)

type DurationProps = React.ComponentProps<typeof DurationSetTimer>

function makeProps(overrides: Partial<DurationProps> = {}): DurationProps {
  return {
    targetSeconds: 10,
    timerStartedAt: null,
    disabled: false,
    isWorkoutPaused: false,
    onStart: vi.fn(),
    onLog: vi.fn(),
    onUpdateTarget: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  mockedPrimeAudio.mockClear()
  mockedPlayWarningBeep.mockClear()
  mockedPlayFinishBeeps.mockClear()
  mockedUseKeepScreenAwake.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("DurationSetTimer", () => {
  it("primes audio when the user taps the Start button", async () => {
    const user = userEvent.setup()
    renderWithProviders(<DurationSetTimer {...makeProps()} />)

    await user.click(screen.getByRole("button", { name: /start/i }))

    expect(mockedPrimeAudio).toHaveBeenCalledTimes(1)
  })

  it("keeps the screen awake while running and releases on pause", () => {
    const { rerender } = renderWithProviders(
      <DurationSetTimer {...makeProps({ timerStartedAt: 1_000 })} />,
    )
    expect(mockedUseKeepScreenAwake).toHaveBeenLastCalledWith(true)

    rerender(
      <DurationSetTimer
        {...makeProps({ timerStartedAt: 1_000, isWorkoutPaused: true })}
      />,
    )
    expect(mockedUseKeepScreenAwake).toHaveBeenLastCalledWith(false)

    rerender(
      <DurationSetTimer
        {...makeProps({ timerStartedAt: 1_000, isWorkoutPaused: false })}
      />,
    )
    expect(mockedUseKeepScreenAwake).toHaveBeenLastCalledWith(true)
  })

  it("does not keep the screen awake when the timer is idle", () => {
    renderWithProviders(
      <DurationSetTimer {...makeProps({ timerStartedAt: null })} />,
    )
    expect(mockedUseKeepScreenAwake).toHaveBeenLastCalledWith(false)
  })

  it("calls onLog with elapsed seconds when the user taps End early before T-0", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const start = 1_000
    vi.setSystemTime(start)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onLog = vi.fn()

    renderWithProviders(
      <DurationSetTimer
        {...makeProps({ targetSeconds: 10, timerStartedAt: start, onLog })}
      />,
    )

    act(() => {
      vi.setSystemTime(start + 3_500)
      vi.advanceTimersByTime(250)
    })

    await user.click(screen.getByRole("button", { name: /end early/i }))

    expect(onLog).toHaveBeenCalledWith(3)
    expect(mockedPlayFinishBeeps).not.toHaveBeenCalled()
  })

  it("fires a warning at T-3 / T-2 / T-1 and the finish chime + onLog + vibrate at T-0", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const start = 1_000
    vi.setSystemTime(start)
    const onLog = vi.fn()
    const vibrate = vi.fn()
    vi.stubGlobal("navigator", { vibrate })

    renderWithProviders(
      <DurationSetTimer
        {...makeProps({ targetSeconds: 10, timerStartedAt: start, onLog })}
      />,
    )

    act(() => {
      vi.setSystemTime(start + 7_000)
      vi.advanceTimersByTime(250)
    })
    expect(mockedPlayWarningBeep).toHaveBeenCalledTimes(1)

    act(() => {
      vi.setSystemTime(start + 8_000)
      vi.advanceTimersByTime(250)
    })
    expect(mockedPlayWarningBeep).toHaveBeenCalledTimes(2)

    act(() => {
      vi.setSystemTime(start + 9_000)
      vi.advanceTimersByTime(250)
    })
    expect(mockedPlayWarningBeep).toHaveBeenCalledTimes(3)

    act(() => {
      vi.setSystemTime(start + 10_000)
      vi.advanceTimersByTime(250)
    })
    expect(mockedPlayFinishBeeps).toHaveBeenCalledTimes(1)
    expect(vibrate).toHaveBeenCalled()
    expect(onLog).toHaveBeenCalledWith(10)
  })

  it("shows a service-worker notification at T-0 when permission is granted", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const start = 1_000
    vi.setSystemTime(start)
    const showNotification = vi.fn()
    vi.stubGlobal("Notification", { permission: "granted" })
    vi.stubGlobal("navigator", {
      vibrate: vi.fn(),
      serviceWorker: { ready: Promise.resolve({ showNotification }) },
    })

    renderWithProviders(
      <DurationSetTimer
        {...makeProps({ targetSeconds: 3, timerStartedAt: start })}
      />,
    )

    act(() => {
      vi.setSystemTime(start + 3_000)
      vi.advanceTimersByTime(250)
    })

    // showNotification is called inside a microtask after serviceWorker.ready resolves
    return Promise.resolve().then(() => {
      expect(showNotification).toHaveBeenCalledTimes(1)
    })
  })

  it("does not show a service-worker notification when permission is not granted", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const start = 1_000
    vi.setSystemTime(start)
    const showNotification = vi.fn()
    vi.stubGlobal("Notification", { permission: "denied" })
    vi.stubGlobal("navigator", {
      vibrate: vi.fn(),
      serviceWorker: { ready: Promise.resolve({ showNotification }) },
    })

    renderWithProviders(
      <DurationSetTimer
        {...makeProps({ targetSeconds: 3, timerStartedAt: start })}
      />,
    )

    act(() => {
      vi.setSystemTime(start + 3_000)
      vi.advanceTimersByTime(250)
    })

    return Promise.resolve().then(() => {
      expect(showNotification).not.toHaveBeenCalled()
    })
  })

  it("suppresses stale warning beeps but still fires the finish chime after a long gap", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const start = 1_000
    vi.setSystemTime(start)
    vi.stubGlobal("navigator", { vibrate: vi.fn() })

    renderWithProviders(
      <DurationSetTimer
        {...makeProps({ targetSeconds: 10, timerStartedAt: start })}
      />,
    )

    act(() => {
      vi.setSystemTime(start + 11_000)
      vi.advanceTimersByTime(250)
    })

    expect(mockedPlayWarningBeep).not.toHaveBeenCalled()
    expect(mockedPlayFinishBeeps).toHaveBeenCalledTimes(1)
  })
})
