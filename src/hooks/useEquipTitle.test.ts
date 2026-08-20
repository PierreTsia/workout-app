import { describe, it, expect, vi, beforeEach } from "vitest"
import { act } from "@testing-library/react"
import { toast } from "sonner"
import { createStore } from "jotai"
import { renderHookWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import { useEquipTitle } from "./useEquipTitle"

const mockEq = vi.fn()
const mockUpdate = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn<(table: string) => { update: typeof mockUpdate }>(() => ({
  update: mockUpdate,
}))

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const USER_ID = "user-1"

function setAuthed(store: ReturnType<typeof createStore>) {
  act(() => {
    store.set(authAtom, { id: USER_ID } as never)
  })
}

describe("useEquipTitle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEq.mockResolvedValue({ error: null })
  })

  it("equips a title, invalidates the profile query, and toasts success", async () => {
    const { result, store, queryClient } = renderHookWithProviders(() =>
      useEquipTitle(),
    )
    setAuthed(store)
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")

    await act(async () => {
      await result.current.mutateAsync("tier-gold")
    })

    expect(mockFrom).toHaveBeenCalledWith("user_profiles")
    expect(mockUpdate).toHaveBeenCalledWith({
      active_title_tier_id: "tier-gold",
    })
    expect(mockEq).toHaveBeenCalledWith("user_id", USER_ID)
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["user-profile", USER_ID],
    })
    expect(toast.success).toHaveBeenCalledWith("Title equipped!")
  })

  it("clears the title, invalidates the profile query, and toasts removal", async () => {
    const { result, store, queryClient } = renderHookWithProviders(() =>
      useEquipTitle(),
    )
    setAuthed(store)
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")

    await act(async () => {
      await result.current.mutateAsync(null)
    })

    expect(mockUpdate).toHaveBeenCalledWith({ active_title_tier_id: null })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["user-profile", USER_ID],
    })
    expect(toast.success).toHaveBeenCalledWith("Title removed.")
  })

  it("toasts an error when the update fails", async () => {
    mockEq.mockResolvedValue({ error: { message: "RLS denied" } })
    const { result, store } = renderHookWithProviders(() => useEquipTitle())
    setAuthed(store)

    await expect(
      act(async () => {
        await result.current.mutateAsync("tier-gold")
      }),
    ).rejects.toBeTruthy()

    expect(toast.error).toHaveBeenCalledWith(
      "Could not update title. Try again.",
    )
    expect(toast.success).not.toHaveBeenCalled()
  })
})
