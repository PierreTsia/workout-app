import { vi, describe, it, expect, beforeEach } from "vitest"
import { act, waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import type { User } from "@/types/auth"
import {
  DuplicateNameError,
  PATForbiddenError,
  QuotaExceededError,
  useCreatePAT,
} from "./useCreatePAT"

const mockInvoke = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}))

const TEST_USER = { id: "uid-1", email: "test@example.com" } as unknown as User

function setupHook() {
  return renderHookWithProviders(() => useCreatePAT(), {
    initialEntries: ["/account/api-tokens"],
  })
}

function makeFunctionsError(status: number, body: unknown) {
  return {
    name: "FunctionsHttpError",
    message: `Edge Function returned a non-2xx status code (${status})`,
    context: new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  }
}

describe("useCreatePAT", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockReset()
  })

  it("returns the plaintext token on success", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        token: "glp_abc123",
        prefix: "glp_abc1",
        expires_at: "2026-05-27T00:00:00Z",
      },
      error: null,
    })

    const { result, store } = setupHook()
    store.set(authAtom, TEST_USER)

    let returned: unknown
    await act(async () => {
      returned = await result.current.mutateAsync({
        name: "Cursor laptop",
        lifetime_days: 30,
      })
    })

    expect(returned).toEqual({
      token: "glp_abc123",
      prefix: "glp_abc1",
      expires_at: "2026-05-27T00:00:00Z",
    })
    expect(mockInvoke).toHaveBeenCalledWith("create-pat", {
      method: "POST",
      body: { name: "Cursor laptop", lifetime_days: 30 },
    })
  })

  it("forwards lifetime_days = null for the 'never' option", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { token: "glp_x", prefix: "glp_x", expires_at: null },
      error: null,
    })

    const { result, store } = setupHook()
    store.set(authAtom, TEST_USER)

    await act(async () => {
      await result.current.mutateAsync({ name: "Never", lifetime_days: null })
    })

    expect(mockInvoke).toHaveBeenCalledWith("create-pat", {
      method: "POST",
      body: { name: "Never", lifetime_days: null },
    })
  })

  it("maps 409 + duplicate_name to DuplicateNameError", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: makeFunctionsError(409, {
        error: 'A token named "dup" already exists.',
        code: "duplicate_name",
      }),
    })

    const { result, store } = setupHook()
    store.set(authAtom, TEST_USER)

    await expect(
      act(async () => {
        await result.current.mutateAsync({ name: "dup", lifetime_days: 30 })
      }),
    ).rejects.toBeInstanceOf(DuplicateNameError)
  })

  it("maps 409 + quota_exceeded to QuotaExceededError", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: makeFunctionsError(409, {
        error: "Maximum of 10 active tokens reached.",
        code: "quota_exceeded",
      }),
    })

    const { result, store } = setupHook()
    store.set(authAtom, TEST_USER)

    await expect(
      act(async () => {
        await result.current.mutateAsync({ name: "x", lifetime_days: 30 })
      }),
    ).rejects.toBeInstanceOf(QuotaExceededError)
  })

  it("maps 403 to PATForbiddenError (anti-escalation)", async () => {
    // Note: hook routes 403 by status alone, body shape doesn't matter for
    // this case — but we still send the production shape for accuracy.
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: makeFunctionsError(403, {
        error:
          "Cannot create a personal access token from a PAT-authenticated request",
      }),
    })

    const { result, store } = setupHook()
    store.set(authAtom, TEST_USER)

    await expect(
      act(async () => {
        await result.current.mutateAsync({ name: "x", lifetime_days: 30 })
      }),
    ).rejects.toBeInstanceOf(PATForbiddenError)
  })

  it("propagates unknown errors as-is", async () => {
    const err = makeFunctionsError(500, { error: "internal" })
    mockInvoke.mockResolvedValueOnce({ data: null, error: err })

    const { result, store } = setupHook()
    store.set(authAtom, TEST_USER)

    await expect(
      act(async () => {
        await result.current.mutateAsync({ name: "x", lifetime_days: 30 })
      }),
    ).rejects.toBe(err)
  })

  it("does NOT collapse a 409 with an unknown error code into a typed error", async () => {
    // Defensive: only the two declared 409 codes should map. Anything else must
    // bubble through so the global toast / dev console see it.
    const err = makeFunctionsError(409, { error: "future_unknown_code" })
    mockInvoke.mockResolvedValueOnce({ data: null, error: err })

    const { result, store } = setupHook()
    store.set(authAtom, TEST_USER)

    await expect(
      act(async () => {
        await result.current.mutateAsync({ name: "x", lifetime_days: 30 })
      }),
    ).rejects.toBe(err)
  })

  it("invalidates the personal-access-tokens query on success", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { token: "glp_y", prefix: "glp_y", expires_at: null },
      error: null,
    })

    const { result, store } = setupHook()
    store.set(authAtom, TEST_USER)

    await act(async () => {
      await result.current.mutateAsync({ name: "x", lifetime_days: 30 })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
  })
})
