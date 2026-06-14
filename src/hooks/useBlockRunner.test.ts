import { describe, it, expect, vi, afterEach } from "vitest"
import { act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { useBlockRunner } from "@/hooks/useBlockRunner"
import type { BlockRunnerContext } from "@/lib/blockRunner"

const ctx = (over: Partial<BlockRunnerContext> = {}): BlockRunnerContext => ({
  rounds: 2,
  exerciseCount: 2,
  transitionSeconds: 0,
  restSeconds: 0,
  ...over,
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useBlockRunner", () => {
  it("logs the current cell then advances to the next exercise", () => {
    const onLog = vi.fn()
    const { result } = renderHookWithProviders(() =>
      useBlockRunner({ ctx: ctx(), onLog }),
    )

    expect(result.current.state).toEqual({
      phase: "exercise",
      cursor: { round: 0, exerciseIdx: 0 },
    })

    act(() => result.current.logAndAdvance())

    expect(onLog).toHaveBeenCalledWith({ round: 0, exerciseIdx: 0 })
    expect(result.current.state).toEqual({
      phase: "exercise",
      cursor: { round: 0, exerciseIdx: 1 },
    })
  })

  it("starts on the first cell with no timer running", () => {
    const { result } = renderHookWithProviders(() =>
      useBlockRunner({ ctx: ctx() }),
    )

    expect(result.current.state).toEqual({
      phase: "exercise",
      cursor: { round: 0, exerciseIdx: 0 },
    })
    expect(result.current.remainingSeconds).toBeNull()
  })

  it("arms a countdown on transition and auto-advances when it elapses", () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const { result } = renderHookWithProviders(() =>
      useBlockRunner({ ctx: ctx({ transitionSeconds: 20 }) }),
    )

    act(() => result.current.logAndAdvance())
    expect(result.current.state.phase).toBe("transition")
    expect(result.current.remainingSeconds).toBe(20)

    act(() => vi.advanceTimersByTime(5_000))
    expect(result.current.remainingSeconds).toBe(15)

    act(() => vi.advanceTimersByTime(20_000))
    expect(result.current.state).toEqual({
      phase: "exercise",
      cursor: { round: 0, exerciseIdx: 1 },
    })
    expect(result.current.remainingSeconds).toBeNull()
  })

  it("skip jumps past an armed timer immediately", () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const { result } = renderHookWithProviders(() =>
      useBlockRunner({ ctx: ctx({ transitionSeconds: 20 }) }),
    )

    act(() => result.current.logAndAdvance())
    act(() => result.current.skip())

    expect(result.current.state).toEqual({
      phase: "exercise",
      cursor: { round: 0, exerciseIdx: 1 },
    })
    expect(result.current.remainingSeconds).toBeNull()
  })

  it("goBack steps the cursor back one cell", () => {
    const { result } = renderHookWithProviders(() =>
      useBlockRunner({ ctx: ctx() }),
    )

    act(() => result.current.logAndAdvance())
    act(() => result.current.goBack())

    expect(result.current.state).toEqual({
      phase: "exercise",
      cursor: { round: 0, exerciseIdx: 0 },
    })
  })

  it("cancelLog calls onCancelLog with the cursor and leaves state untouched", () => {
    const onCancelLog = vi.fn()
    const { result } = renderHookWithProviders(() =>
      useBlockRunner({ ctx: ctx(), onCancelLog }),
    )

    const before = result.current.state
    act(() => result.current.cancelLog())

    expect(onCancelLog).toHaveBeenCalledWith({ round: 0, exerciseIdx: 0 })
    expect(result.current.state).toEqual(before)
  })
})
