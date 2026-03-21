import { vi, describe, it, expect, beforeEach } from "vitest"
import { act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import {
  useAIGenerateWorkout,
  isQuotaError,
} from "./useAIGenerateWorkout"
import type { Exercise } from "@/types/database"
import type { GeneratorConstraints } from "@/types/generator"

const invoke = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    from: vi.fn(),
  },
}))

const EX: Exercise = {
  id: "ex-1",
  name: "Squat",
  muscle_group: "quads",
  emoji: "🏋",
  is_system: true,
  created_at: "",
  youtube_url: null,
  instructions: null,
  image_url: null,
  equipment: "barbell",
  difficulty_level: "intermediate",
  name_en: "Squat",
  source: null,
  secondary_muscles: [],
  reviewed_at: null,
  reviewed_by: null,
}

const CONSTRAINTS: GeneratorConstraints = {
  duration: 30,
  equipmentCategory: "full-gym",
  muscleGroups: ["full-body"],
}

function functionsError(status: number) {
  return {
    message: "non-2xx",
    context: new Response(null, { status }),
  }
}

describe("useAIGenerateWorkout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("maps invoke error with 429 context to quota_exceeded", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: functionsError(429),
    })

    const { result } = renderHookWithProviders(() =>
      useAIGenerateWorkout({ exercisePool: [EX] }),
    )

    await act(async () => {
      try {
        await result.current.mutateAsync(CONSTRAINTS)
        expect.fail("expected rejection")
      } catch (e) {
        expect(e).toBeInstanceOf(Error)
        if (!(e instanceof Error)) throw e
        expect(e.message).toBe("quota_exceeded")
        expect(isQuotaError(e)).toBe(true)
      }
    })
  })

  it("maps invoke error with 504 context to timeout", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: functionsError(504),
    })

    const { result } = renderHookWithProviders(() =>
      useAIGenerateWorkout({ exercisePool: [EX] }),
    )

    await act(async () => {
      try {
        await result.current.mutateAsync(CONSTRAINTS)
        expect.fail("expected rejection")
      } catch (e) {
        expect(e).toBeInstanceOf(Error)
        if (!(e instanceof Error)) throw e
        expect(e.message).toBe("timeout")
        expect(isQuotaError(e)).toBe(false)
      }
    })
  })

  it("rethrows other invoke errors unchanged", async () => {
    const original = { message: "boom", context: new Response(null, { status: 500 }) }
    invoke.mockResolvedValue({ data: null, error: original })

    const { result } = renderHookWithProviders(() =>
      useAIGenerateWorkout({ exercisePool: [EX] }),
    )

    await act(async () => {
      try {
        await result.current.mutateAsync(CONSTRAINTS)
        expect.fail("expected rejection")
      } catch (e) {
        expect(e).toBe(original)
      }
    })
  })
})
