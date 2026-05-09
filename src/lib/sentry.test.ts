import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const initMock = vi.fn()

vi.mock("@sentry/react", () => ({
  init: (...args: unknown[]) => initMock(...args),
  browserTracingIntegration: () => ({ name: "test-tracing" }),
  captureException: vi.fn(),
}))

describe("initSentry", () => {
  beforeEach(() => {
    vi.resetModules()
    initMock.mockReset()
    vi.stubEnv("VITE_SENTRY_DSN", "https://test@example.ingest.sentry.io/1")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("calls Sentry.init when DSN is set", async () => {
    const { initSentry } = await import("./sentry")
    initSentry()
    expect(initMock).toHaveBeenCalledOnce()
  })

  it("is idempotent — second call is a no-op", async () => {
    const { initSentry } = await import("./sentry")
    initSentry()
    initSentry()
    initSentry()
    expect(initMock).toHaveBeenCalledOnce()
  })

  it("short-circuits when DSN is missing", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "")
    const { initSentry } = await import("./sentry")
    initSentry()
    expect(initMock).not.toHaveBeenCalled()
  })
})
