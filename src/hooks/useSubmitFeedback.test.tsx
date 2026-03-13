import { vi, describe, it, expect, beforeEach } from "vitest"
import { act, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import { renderHookWithProviders } from "@/test/utils"
import { useSubmitFeedback } from "./useSubmitFeedback"
import type { ExerciseContentFeedbackInsert } from "@/types/database"

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

function createInsertChain(resolveWith: { data?: unknown; error?: unknown } = {}) {
  const chain = {
    insert: vi.fn(() =>
      Promise.resolve({
        data: resolveWith.data ?? null,
        error: resolveWith.error ?? null,
      }),
    ),
  }
  return chain
}

let mockChain = createInsertChain()

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => mockChain),
  },
}))

const PAYLOAD: ExerciseContentFeedbackInsert = {
  exercise_id: "ex-1",
  user_email: "test@example.com",
  user_id: "uid-1",
  source_screen: "workout",
  fields_reported: ["illustration"],
  error_details: { illustration: ["wrong_exercise"] },
  other_illustration_text: null,
  other_video_text: null,
  other_description_text: null,
  comment: null,
}

describe("useSubmitFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChain = createInsertChain()
  })

  it("starts with isPending false", () => {
    const { result } = renderHookWithProviders(() => useSubmitFeedback())
    expect(result.current.isPending).toBe(false)
  })

  it("resolves on successful insert", async () => {
    const { result } = renderHookWithProviders(() => useSubmitFeedback())

    await act(async () => {
      await result.current.submit(PAYLOAD)
    })

    expect(result.current.isPending).toBe(false)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("shows error toast and throws on supabase error", async () => {
    mockChain = createInsertChain({ error: { message: "RLS violation" } })
    const { result } = renderHookWithProviders(() => useSubmitFeedback())

    await expect(
      act(async () => {
        await result.current.submit(PAYLOAD)
      }),
    ).rejects.toThrow("Feedback submit failed")

    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it("resets isPending after error", async () => {
    mockChain = createInsertChain({ error: { message: "fail" } })
    const { result } = renderHookWithProviders(() => useSubmitFeedback())

    try {
      await act(async () => {
        await result.current.submit(PAYLOAD)
      })
    } catch {
      // expected
    }

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })
  })
})
