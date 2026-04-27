import { vi, describe, it, expect, beforeEach } from "vitest"
import { waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import type { User } from "@/types/auth"
import { usePersonalAccessTokens } from "./usePersonalAccessTokens"

const mockOrder = vi.fn()
const mockSelect = vi.fn((..._args: unknown[]) => ({ order: mockOrder }))
const mockFrom = vi.fn((..._args: unknown[]) => ({ select: mockSelect }))

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

const TEST_USER = { id: "uid-1", email: "test@example.com" } as unknown as User

describe("usePersonalAccessTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOrder.mockReset()
  })

  it("does not fire the query while the user is unauthenticated", () => {
    mockOrder.mockResolvedValue({ data: [], error: null })
    const { result } = renderHookWithProviders(() => usePersonalAccessTokens())

    expect(result.current.isFetching).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("returns the rows on success, ordered by created_at desc", async () => {
    const rows = [
      {
        id: "pat-1",
        user_id: "uid-1",
        name: "Cursor",
        prefix: "glp_aaaa",
        expires_at: null,
        last_used_at: null,
        created_at: "2026-04-27T00:00:00Z",
      },
    ]
    mockOrder.mockResolvedValue({ data: rows, error: null })

    const { result, store } = renderHookWithProviders(() =>
      usePersonalAccessTokens(),
    )
    store.set(authAtom, TEST_USER)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual(rows)
    expect(mockFrom).toHaveBeenCalledWith("personal_access_tokens")
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false })
  })

  it("does NOT include token_hash in the select projection", async () => {
    // Defensive: regression guard against accidentally exposing the hashed
    // value to the browser.
    mockOrder.mockResolvedValue({ data: [], error: null })

    const { store } = renderHookWithProviders(() => usePersonalAccessTokens())
    store.set(authAtom, TEST_USER)

    await waitFor(() => {
      expect(mockSelect).toHaveBeenCalled()
    })
    const projection = mockSelect.mock.calls[0]?.[0] as string
    expect(projection).toBeDefined()
    expect(projection).not.toMatch(/token_hash/)
    expect(projection).not.toMatch(/\*/)
  })

  it("propagates supabase errors", async () => {
    mockOrder.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    })

    const { result, store } = renderHookWithProviders(() =>
      usePersonalAccessTokens(),
    )
    store.set(authAtom, TEST_USER)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })

  it("returns an empty array when supabase returns null data", async () => {
    mockOrder.mockResolvedValue({ data: null, error: null })

    const { result, store } = renderHookWithProviders(() =>
      usePersonalAccessTokens(),
    )
    store.set(authAtom, TEST_USER)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual([])
  })
})
