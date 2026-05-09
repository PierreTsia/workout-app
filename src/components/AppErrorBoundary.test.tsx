import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { AppErrorBoundary } from "./AppErrorBoundary"

const captureExceptionMock = vi.fn()
const initSentryMock = vi.fn()

vi.mock("@sentry/react", () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
}))

vi.mock("@/lib/sentry", () => ({
  initSentry: (...args: unknown[]) => initSentryMock(...args),
}))

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Kaboom")
  return <span>safe</span>
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    captureExceptionMock.mockReset()
    initSentryMock.mockReset()
  })

  it("renders children when no error", () => {
    render(
      <AppErrorBoundary fallback={() => <div>fallback</div>}>
        <span>happy</span>
      </AppErrorBoundary>,
    )
    expect(screen.getByText("happy")).toBeInTheDocument()
  })

  it("renders fallback with error and a stable error id when child throws", () => {
    const fallback = vi.fn(({ errorId }) => <div>{`fb-${errorId}`}</div>)

    render(
      <AppErrorBoundary fallback={fallback}>
        <Boom shouldThrow />
      </AppErrorBoundary>,
    )

    expect(fallback).toHaveBeenCalled()
    const ctx = fallback.mock.calls[0]![0] as {
      error: Error
      errorId: string
      componentStack: string | null
      caughtAt: Date
    }
    expect(ctx.error.message).toBe("Kaboom")
    expect(ctx.errorId).toMatch(/^err_[0-9a-f]{6}$/)
    expect(ctx.caughtAt).toBeInstanceOf(Date)
    expect(screen.getByText(`fb-${ctx.errorId}`)).toBeInTheDocument()
  })

  it("pins caughtAt to the moment of the catch (stable across re-renders)", () => {
    const fallback = vi.fn(({ caughtAt }) => (
      <div>{`ts-${caughtAt.toISOString()}`}</div>
    ))

    const { rerender } = render(
      <AppErrorBoundary fallback={fallback}>
        <Boom shouldThrow />
      </AppErrorBoundary>,
    )

    const firstCtx = fallback.mock.calls[0]![0] as { caughtAt: Date }
    const initialIso = firstCtx.caughtAt.toISOString()

    rerender(
      <AppErrorBoundary fallback={fallback}>
        <Boom shouldThrow />
      </AppErrorBoundary>,
    )

    const lastCtx = fallback.mock.calls.at(-1)![0] as { caughtAt: Date }
    expect(lastCtx.caughtAt.toISOString()).toEqual(initialIso)
  })

  it("calls initSentry before captureException with error_id tag", async () => {
    render(
      <AppErrorBoundary fallback={({ errorId }) => <div>{errorId}</div>}>
        <Boom shouldThrow />
      </AppErrorBoundary>,
    )

    await flushPromises()

    expect(initSentryMock).toHaveBeenCalledTimes(1)
    expect(captureExceptionMock).toHaveBeenCalledTimes(1)
    expect(initSentryMock.mock.invocationCallOrder[0]!).toBeLessThan(
      captureExceptionMock.mock.invocationCallOrder[0]!,
    )

    const [capturedError, ctx] = captureExceptionMock.mock.calls[0]! as [
      Error,
      { tags: { error_id: string }; contexts: { react: unknown } },
    ]
    expect(capturedError.message).toBe("Kaboom")
    expect(ctx.tags.error_id).toMatch(/^err_[0-9a-f]{6}$/)
    expect(ctx.contexts.react).toBeDefined()
  })

  it("resetError clears the boundary state", () => {
    const fallback = vi.fn(({ resetError }) => (
      <button onClick={resetError}>reset</button>
    ))

    const { rerender } = render(
      <AppErrorBoundary fallback={fallback}>
        <Boom shouldThrow />
      </AppErrorBoundary>,
    )
    expect(screen.getByRole("button", { name: "reset" })).toBeInTheDocument()

    rerender(
      <AppErrorBoundary fallback={fallback}>
        <Boom shouldThrow={false} />
      </AppErrorBoundary>,
    )

    const lastCtx = fallback.mock.calls.at(-1)![0] as {
      resetError: () => void
    }
    act(() => lastCtx.resetError())

    expect(screen.getByText("safe")).toBeInTheDocument()
  })
})
