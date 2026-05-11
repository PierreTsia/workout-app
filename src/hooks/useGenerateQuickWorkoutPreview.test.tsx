/**
 * Behavioral tests for `useGenerateQuickWorkoutPreview` (T127, #342).
 *
 * Same status → typed-error mapping the prior generic AI hook had
 * (`quota_exceeded` / `timeout` / network) — but the hook now invokes the
 * new endpoint name. Adds a hydration test because the ticket calls it
 * out explicitly: ids returned by the server must be resolved against
 * the local pool without a second roundtrip.
 */

import { vi, describe, it, expect, beforeEach } from "vitest"
import { act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import {
  useGenerateQuickWorkoutPreview,
  isQuotaError,
  isNetworkError,
} from "./useGenerateQuickWorkoutPreview"
import type { Exercise } from "@/types/database"
import type { GeneratorConstraints } from "@/types/generator"

const invoke = vi.fn()
const fromExercises = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    from: (...args: unknown[]) => fromExercises(...args),
  },
}))

function makeExercise(id: string, overrides: Partial<Exercise> = {}): Exercise {
  return {
    id,
    name: `Exercise ${id}`,
    muscle_group: "Pectoraux",
    emoji: "🏋",
    is_system: true,
    created_at: "",
    youtube_url: null,
    instructions: null,
    image_url: null,
    equipment: "barbell",
    difficulty_level: "intermediate",
    name_en: `Exercise ${id}`,
    source: null,
    secondary_muscles: [],
    reviewed_at: null,
    reviewed_by: null,
    ...overrides,
  }
}

const POOL_BENCH = makeExercise("ex-bench", { name: "Bench Press" })
const POOL_ROW = makeExercise("ex-row", { name: "Barbell Row", muscle_group: "Dos" })

const CONSTRAINTS: GeneratorConstraints = {
  duration: 30,
  equipmentCategories: ["full-gym"],
  muscleGroups: ["full-body"],
}

function functionsError(status: number) {
  return {
    message: "non-2xx",
    context: new Response(null, { status }),
  }
}

describe("useGenerateQuickWorkoutPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("invokes the generate-quick-workout endpoint with constraints + locale", async () => {
    invoke.mockResolvedValueOnce({
      data: { exerciseIds: ["ex-bench", "ex-row"], rationale: "Solid push/pull." },
      error: null,
    })

    const { result } = renderHookWithProviders(() =>
      useGenerateQuickWorkoutPreview({ exercisePool: [POOL_BENCH, POOL_ROW] }),
    )

    await act(async () => {
      await result.current.mutateAsync(CONSTRAINTS)
    })

    expect(invoke).toHaveBeenCalledTimes(1)
    const [name, opts] = invoke.mock.calls[0]
    expect(name).toBe("generate-quick-workout")
    const body = (opts as { body: Record<string, unknown> }).body
    expect(body.duration).toBe(30)
    expect(body.equipmentCategories).toEqual(["full-gym"])
    expect(body.muscleGroups).toEqual(["full-body"])
    expect(typeof body.locale).toBe("string")
  })

  it("hydrates exerciseIds from the local pool — zero second fetch when all ids resolve", async () => {
    invoke.mockResolvedValueOnce({
      data: { exerciseIds: ["ex-bench", "ex-row"], rationale: "" },
      error: null,
    })

    const { result } = renderHookWithProviders(() =>
      useGenerateQuickWorkoutPreview({ exercisePool: [POOL_BENCH, POOL_ROW] }),
    )

    let workout: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined
    await act(async () => {
      workout = await result.current.mutateAsync(CONSTRAINTS)
    })

    expect(workout!.exercises).toHaveLength(2)
    expect(workout!.exercises.map((e) => e.exercise.id)).toEqual(["ex-bench", "ex-row"])
    // Pool covered every id, so the .from("exercises") fallback fetch must
    // NOT have been issued.
    expect(fromExercises).not.toHaveBeenCalled()
  })

  it("falls back to a bulk fetch for ids missing from the pool", async () => {
    invoke.mockResolvedValueOnce({
      data: { exerciseIds: ["ex-bench", "ex-missing"], rationale: "" },
      error: null,
    })
    const fetched = makeExercise("ex-missing", { name: "Pull-up", muscle_group: "Dos" })
    fromExercises.mockReturnValueOnce({
      select: () => ({
        in: vi.fn().mockResolvedValueOnce({ data: [fetched], error: null }),
      }),
    })

    const { result } = renderHookWithProviders(() =>
      useGenerateQuickWorkoutPreview({ exercisePool: [POOL_BENCH] }),
    )

    let workout: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined
    await act(async () => {
      workout = await result.current.mutateAsync(CONSTRAINTS)
    })

    expect(fromExercises).toHaveBeenCalledWith("exercises")
    // Exact (not sorted) — preserves the order the model returned. Sorting
    // here would hide the bug PR #347 review C5 flagged.
    expect(workout!.exercises.map((e) => e.exercise.id)).toEqual([
      "ex-bench",
      "ex-missing",
    ])
  })

  it("hydrates in the AI's exerciseIds order, even when pool + fetch outputs are interleaved", async () => {
    // The model's ordering is intent (warm-up first, compound second, etc.);
    // the legacy hydrateExercises returned `[...fromPool, ...fetched]` which
    // silently reordered the workout. PR #347 review C5 — locked in here.
    invoke.mockResolvedValueOnce({
      data: {
        exerciseIds: ["ex-missing-a", "ex-bench", "ex-missing-b"],
        rationale: "",
      },
      error: null,
    })
    const fetchedA = makeExercise("ex-missing-a", { name: "Warm-up" })
    const fetchedB = makeExercise("ex-missing-b", { name: "Cool-down" })
    fromExercises.mockReturnValueOnce({
      select: () => ({
        // Postgres returns rows in arbitrary order — emulate that by
        // returning the fetched ids reversed vs. the AI ordering.
        in: vi.fn().mockResolvedValueOnce({ data: [fetchedB, fetchedA], error: null }),
      }),
    })

    const { result } = renderHookWithProviders(() =>
      useGenerateQuickWorkoutPreview({ exercisePool: [POOL_BENCH] }),
    )

    let workout: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined
    await act(async () => {
      workout = await result.current.mutateAsync(CONSTRAINTS)
    })

    expect(workout!.exercises.map((e) => e.exercise.id)).toEqual([
      "ex-missing-a",
      "ex-bench",
      "ex-missing-b",
    ])
  })

  it("maps invoke error with 429 context to quota_exceeded", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: functionsError(429) })

    const { result } = renderHookWithProviders(() =>
      useGenerateQuickWorkoutPreview({ exercisePool: [POOL_BENCH] }),
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
    invoke.mockResolvedValueOnce({ data: null, error: functionsError(504) })

    const { result } = renderHookWithProviders(() =>
      useGenerateQuickWorkoutPreview({ exercisePool: [POOL_BENCH] }),
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

  it("rethrows other invoke errors unchanged (so the global toast / dev console see them)", async () => {
    const original = { message: "boom", context: new Response(null, { status: 500 }) }
    invoke.mockResolvedValueOnce({ data: null, error: original })

    const { result } = renderHookWithProviders(() =>
      useGenerateQuickWorkoutPreview({ exercisePool: [POOL_BENCH] }),
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

  it("isNetworkError + isQuotaError exports are usable for the UI's error branching", async () => {
    // Sanity check on the helpers — `QuickWorkoutAIGeneratingStep`
    // branches on these for its error / quota / fallback states. T127
    // kept the same external surface so the component swap is a
    // one-line import change.
    expect(isQuotaError(new Error("quota_exceeded"))).toBe(true)
    expect(isQuotaError(new Error("anything else"))).toBe(false)

    const fnFetchErr = Object.assign(new Error("fetch failed"), { name: "FunctionsFetchError" })
    expect(isNetworkError(fnFetchErr)).toBe(true)
    expect(isNetworkError(new Error("regular error"))).toBe(false)
  })
})
