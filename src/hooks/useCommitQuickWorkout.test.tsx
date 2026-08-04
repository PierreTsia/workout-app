/**
 * Behavioral tests for `useCommitQuickWorkout` (T128, #342). Mirrors the
 * shape of `useGenerateQuickWorkoutPreview.test.tsx` so the contract is
 * obvious at a glance: the hook is the client side of the
 * `commit-quick-workout` Edge function — same status-code → typed-error
 * mapping the read-side has, but the success path returns the persisted
 * `workoutDayId` and invalidates the day-list query so the next render
 * sees the new day.
 */

import { vi, describe, it, expect, beforeEach } from "vitest"
import { act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import {
  useCommitQuickWorkout,
  isCommitFailedError,
  isNetworkError,
} from "./useCommitQuickWorkout"
import type { GeneratedWorkout } from "@/types/generator"
import type { Exercise } from "@/types/database"

const invoke = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
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
    measurement_type: "reps",
    default_duration_seconds: null,
    ...overrides,
  }
}

const SAMPLE_WORKOUT: GeneratedWorkout = {
  name: "AI: Full Body / Full gym / 30min",
  hasFallback: false,
  exercises: [
    {
      exercise: makeExercise("11111111-1111-1111-1111-111111111111", { name: "Bench Press" }),
      sets: 4,
      reps: "8-10",
      restSeconds: 120,
      isCompound: true,
    },
  ],
}

function functionsError(status: number, body: unknown = {}) {
  return {
    message: "non-2xx",
    context: new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  }
}

describe("useCommitQuickWorkout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("T170: forwards Circuit day-items as MCP Circuit Items on commit", async () => {
    invoke.mockResolvedValueOnce({
      data: { workout_day_id: "day-circuit" },
      error: null,
    })

    const circuitWorkout: GeneratedWorkout = {
      ...SAMPLE_WORKOUT,
      dayItems: [
        {
          kind: "solo",
          exercise: SAMPLE_WORKOUT.exercises[0],
        },
        {
          kind: "circuit",
          circuit: {
            label: "Finisher",
            rounds: 3,
            restSeconds: 90,
            transitionSeconds: 0,
            exercises: [
              {
                exercise: makeExercise("22222222-2222-2222-2222-222222222222", {
                  name: "Push-up",
                  equipment: "bodyweight",
                }),
                amount: 10,
                weightKg: 0,
              },
              {
                exercise: makeExercise("33333333-3333-3333-3333-333333333333", {
                  name: "Row",
                }),
                amount: 12,
                weightKg: 20,
              },
            ],
          },
        },
      ],
    }

    const { result } = renderHookWithProviders(() => useCommitQuickWorkout())
    await act(async () => {
      await result.current.mutateAsync({ workout: circuitWorkout })
    })

    const [, payload] = invoke.mock.calls[0] as [
      string,
      { body: { exercises: unknown[] } },
    ]
    expect(payload.body.exercises).toEqual([
      {
        exercise_id: "11111111-1111-1111-1111-111111111111",
        sets: 4,
        reps: "8-10",
        weight_kg: 0,
        rest_seconds: 120,
      },
      {
        type: "circuit",
        label: "Finisher",
        rounds: 3,
        rest_seconds: 90,
        transition_seconds: 0,
        exercises: [
          {
            exercise_id: "22222222-2222-2222-2222-222222222222",
            amount: 10,
            weight_kg: 0,
          },
          {
            exercise_id: "33333333-3333-3333-3333-333333333333",
            amount: 12,
            weight_kg: 20,
          },
        ],
      },
    ])
  })

  it("invokes commit-quick-workout with label + MCP-shaped exercises", async () => {
    invoke.mockResolvedValueOnce({
      data: { workout_day_id: "day-1" },
      error: null,
    })

    const { result } = renderHookWithProviders(() => useCommitQuickWorkout())

    let returned: { workoutDayId: string } | undefined
    await act(async () => {
      returned = await result.current.mutateAsync({ workout: SAMPLE_WORKOUT })
    })

    expect(returned).toEqual({ workoutDayId: "day-1" })
    expect(invoke).toHaveBeenCalledTimes(1)
    const [endpoint, payload] = invoke.mock.calls[0] as [string, { body: { label: string; exercises: unknown[] } }]
    expect(endpoint).toBe("commit-quick-workout")
    expect(payload.body.label).toBe(SAMPLE_WORKOUT.name)
    expect(payload.body.exercises).toEqual([
      {
        exercise_id: "11111111-1111-1111-1111-111111111111",
        sets: 4,
        reps: "8-10",
        weight_kg: 0,
        rest_seconds: 120,
      },
    ])
  })

  it("maps 502 commit_failed responses to a typed error with kind", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: functionsError(502, { error: "commit_failed", kind: "rpc_error" }),
    })

    const { result } = renderHookWithProviders(() => useCommitQuickWorkout())

    let caught: unknown
    await act(async () => {
      try {
        await result.current.mutateAsync({ workout: SAMPLE_WORKOUT })
      } catch (e) {
        caught = e
      }
    })

    expect(isCommitFailedError(caught)).toBe(true)
    expect((caught as { reason: string }).reason).toBe("rpc_error")
  })

  it("rethrows network errors so callers can branch on isNetworkError", async () => {
    const fetchErr = Object.assign(
      new Error("Failed to send a request to the Edge Function"),
      { name: "FunctionsFetchError" },
    )
    invoke.mockResolvedValueOnce({ data: null, error: fetchErr })

    const { result } = renderHookWithProviders(() => useCommitQuickWorkout())

    let caught: unknown
    await act(async () => {
      try {
        await result.current.mutateAsync({ workout: SAMPLE_WORKOUT })
      } catch (e) {
        caught = e
      }
    })

    expect(isNetworkError(caught)).toBe(true)
  })

  it("surfaces 401 auth_missing as an error (no MCP roundtrip happened)", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: functionsError(401, { error: "auth_missing" }),
    })

    const { result } = renderHookWithProviders(() => useCommitQuickWorkout())

    let caught: unknown
    await act(async () => {
      try {
        await result.current.mutateAsync({ workout: SAMPLE_WORKOUT })
      } catch (e) {
        caught = e
      }
    })

    expect(caught).toBeTruthy()
  })
})
