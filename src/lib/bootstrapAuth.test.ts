import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { Session } from "@supabase/supabase-js"
import type { User } from "@/types/auth"
import { bootstrapAuth } from "./bootstrapAuth"

const FAKE_USER = { id: "user-123" } as User

const buildSessionResult = (user: User | null) => ({
  data: { session: user ? ({ user } as unknown as Session) : null },
})

describe("bootstrapAuth", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
    vi.useRealTimers()
  })

  it("propagates the user and flips loading=false on resolve", async () => {
    const setAuth = vi.fn()
    const setLoading = vi.fn()
    const onUser = vi.fn()

    await bootstrapAuth({
      getSession: () => Promise.resolve(buildSessionResult(FAKE_USER)),
      setAuth,
      setLoading,
      onUser,
    })

    expect(setAuth).toHaveBeenCalledWith(FAKE_USER)
    expect(onUser).toHaveBeenCalledWith(FAKE_USER)
    expect(setLoading).toHaveBeenCalledWith(false)
  })

  it("sets user=null and skips onUser when no session is returned", async () => {
    const setAuth = vi.fn()
    const setLoading = vi.fn()
    const onUser = vi.fn()

    await bootstrapAuth({
      getSession: () => Promise.resolve(buildSessionResult(null)),
      setAuth,
      setLoading,
      onUser,
    })

    expect(setAuth).toHaveBeenCalledWith(null)
    expect(onUser).not.toHaveBeenCalled()
    expect(setLoading).toHaveBeenCalledWith(false)
  })

  it("falls back to user=null and still flips loading=false when getSession() rejects", async () => {
    const setAuth = vi.fn()
    const setLoading = vi.fn()
    const onUser = vi.fn()

    await bootstrapAuth({
      getSession: () => Promise.reject(new Error("network down")),
      setAuth,
      setLoading,
      onUser,
    })

    expect(setAuth).toHaveBeenCalledWith(null)
    expect(onUser).not.toHaveBeenCalled()
    expect(setLoading).toHaveBeenCalledWith(false)
    expect(warnSpy).toHaveBeenCalled()
  })

  it("times out a hung getSession() and continues offline", async () => {
    vi.useFakeTimers()
    const setAuth = vi.fn()
    const setLoading = vi.fn()

    const hung = new Promise<{ data: { session: Session | null } }>(() => {
      // never resolves — simulates supabase-js silent refresh hanging on a
      // flaky network. Without the timeout, authLoadingAtom would stick at
      // true and AuthGuard would render null (= black screen).
    })

    const promise = bootstrapAuth({
      getSession: () => hung,
      setAuth,
      setLoading,
      timeoutMs: 50,
    })

    await vi.advanceTimersByTimeAsync(50)
    await promise

    expect(setAuth).toHaveBeenCalledWith(null)
    expect(setLoading).toHaveBeenCalledWith(false)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("bootstrap timed out"),
      expect.any(Error),
    )
  })

  it("does not invoke setAuth twice when getSession() resolves before timeout", async () => {
    vi.useFakeTimers()
    const setAuth = vi.fn()
    const setLoading = vi.fn()

    const promise = bootstrapAuth({
      getSession: () => Promise.resolve(buildSessionResult(FAKE_USER)),
      setAuth,
      setLoading,
      timeoutMs: 5000,
    })

    await vi.advanceTimersByTimeAsync(0)
    await promise

    expect(setAuth).toHaveBeenCalledTimes(1)
    expect(setAuth).toHaveBeenCalledWith(FAKE_USER)
    expect(setLoading).toHaveBeenCalledTimes(1)
    expect(setLoading).toHaveBeenCalledWith(false)
  })

  it("guarantees setLoading(false) even if setAuth throws synchronously", async () => {
    const setLoading = vi.fn()
    const setAuth = vi.fn(() => {
      throw new Error("store unavailable")
    })

    await bootstrapAuth({
      getSession: () => Promise.resolve(buildSessionResult(FAKE_USER)),
      setAuth,
      setLoading,
    })

    expect(setLoading).toHaveBeenCalledWith(false)
  })
})
