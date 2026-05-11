/**
 * Shape-parity tests for `useCreateQuickWorkout` (T125, #342).
 *
 * The headline guarantee this test locks in: the rows the hook would write to
 * `workout_exercises` for a given `GeneratedWorkout` deep-equal what
 * `buildWorkoutExerciseInsertRowsForDay` produces. After the refactor the
 * equivalence holds by construction (the hook calls the helper). This file
 * exists so any future revert to inline row-building goes red on CI.
 *
 * The mocked `supabase` client is a small chainable recorder — `.from(table)`
 * returns a builder that records `.insert(payload)` (and `.select().single()`
 * for the day row insert) into a per-instance call log the test inspects.
 */

import { vi, describe, it, expect, beforeEach } from "vitest"
import { act, waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import type { User } from "@/types/auth"
import type { Exercise } from "@/types/database"
import type { GeneratedExercise, GeneratedWorkout } from "@/types/generator"
import { buildWorkoutExerciseInsertRowsForDay } from "@/lib/programPersistence"
import { useCreateQuickWorkout } from "./useCreateQuickWorkout"

// ---------------------------------------------------------------------------
// Mock supabase — chainable recorder scoped to the chains the hook builds.
// ---------------------------------------------------------------------------

const MOCK_DAY_ID = "mock-day-uuid-1"

interface InsertCall {
  table: string
  payload: unknown
}

const insertCalls: InsertCall[] = []

vi.mock("@/lib/supabase", () => {
  function from(table: string) {
    return {
      insert(payload: unknown) {
        insertCalls.push({ table, payload })
        return {
          select() {
            return {
              single: () =>
                Promise.resolve({
                  data: table === "workout_days" ? { id: MOCK_DAY_ID } : null,
                  error: null,
                }),
            }
          },
          // Thenable for `await supabase.from("workout_exercises").insert([...])`.
          then(
            onFulfilled: (v: { data: null; error: null }) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) {
            return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected)
          },
        }
      },
    }
  }
  return { supabase: { from } }
})

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

const TEST_USER = { id: "user-uuid-1", email: "test@example.com" } as unknown as User

function makeExercise(overrides: Partial<Exercise> & Pick<Exercise, "id" | "name">): Exercise {
  return {
    id: overrides.id,
    name: overrides.name,
    muscle_group: overrides.muscle_group ?? "Pectoraux",
    emoji: overrides.emoji ?? "🏋️",
    is_system: true,
    created_at: "",
    youtube_url: null,
    instructions: null,
    image_url: null,
    equipment: overrides.equipment ?? "barbell",
    difficulty_level: "intermediate",
    name_en: null,
    source: null,
    secondary_muscles: null,
    reviewed_at: null,
    reviewed_by: null,
    measurement_type: overrides.measurement_type,
    default_duration_seconds: overrides.default_duration_seconds,
  }
}

function makeGE(
  exercise: Exercise,
  overrides: Partial<Omit<GeneratedExercise, "exercise">> = {},
): GeneratedExercise {
  return {
    exercise,
    sets: overrides.sets ?? 3,
    reps: overrides.reps ?? "10",
    restSeconds: overrides.restSeconds ?? 90,
    isCompound: overrides.isCompound ?? false,
  }
}

function makeMixedWorkout(): GeneratedWorkout {
  // Mirrors the deterministic Quick Workout generator's output: no weightKg,
  // no explicit ranges, no targetDurationSeconds. Mix of reps / duration /
  // bodyweight to exercise every branch in the row builder.
  const bench = makeExercise({
    id: "ex-bench",
    name: "Bench Press",
    equipment: "barbell",
    measurement_type: "reps",
  })
  const plank = makeExercise({
    id: "ex-plank",
    name: "Plank",
    equipment: "bodyweight",
    measurement_type: "duration",
    default_duration_seconds: 30,
  })
  const pushup = makeExercise({
    id: "ex-pushup",
    name: "Push-up",
    equipment: "bodyweight",
    measurement_type: "reps",
  })

  return {
    name: "Quick Push Day",
    hasFallback: false,
    exercises: [
      makeGE(bench, { sets: 4, reps: "8" }),
      makeGE(plank, { sets: 4, reps: "0", restSeconds: 60 }),
      makeGE(pushup, { sets: 3, reps: "12" }),
    ],
  }
}

function setupHook() {
  return renderHookWithProviders(() => useCreateQuickWorkout(), {
    initialEntries: ["/"],
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useCreateQuickWorkout — shape parity", () => {
  beforeEach(() => {
    insertCalls.length = 0
  })

  it("inserts workout_exercises rows that deep-equal buildWorkoutExerciseInsertRowsForDay output", async () => {
    const workout = makeMixedWorkout()

    const { result, store } = setupHook()
    // Set the auth atom inside act() so jotai's subscription flushes a
    // re-render before mutateAsync runs — otherwise the mutationFn closure
    // captured by useMutation still sees `user === null` from initial render.
    act(() => {
      store.set(authAtom, TEST_USER)
    })

    await act(async () => {
      await result.current.mutateAsync({ workout })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    const exercisesInsert = insertCalls.find((c) => c.table === "workout_exercises")
    expect(exercisesInsert, "hook must insert workout_exercises rows").toBeDefined()

    const actualRows = exercisesInsert!.payload as Array<Record<string, unknown>>

    // The shared helper is the source of truth — `create_workout_day` uses
    // its Edge twin, and `programPersistence.test.ts` already covers the
    // helper across reps / duration / bodyweight / mixed cases. This
    // assertion locks in delegation: any inline construction that drifts
    // from the helper goes red here.
    const expectedRows = buildWorkoutExerciseInsertRowsForDay(MOCK_DAY_ID, workout.exercises)

    expect(actualRows).toEqual(expectedRows)
  })

  it("workout_days insert carries the locked Quick Workout shape for a live workout", async () => {
    const workout = makeMixedWorkout()

    const { result, store } = setupHook()
    act(() => {
      store.set(authAtom, TEST_USER)
    })

    await act(async () => {
      await result.current.mutateAsync({ workout })
    })

    const dayInsert = insertCalls.find((c) => c.table === "workout_days")
    expect(dayInsert, "hook must insert exactly one workout_days row").toBeDefined()

    const payload = dayInsert!.payload as Record<string, unknown>

    // Locked shape per ADR 0002 §3 + Tech Plan. These four fields define
    // "ad-hoc, standalone, live, visually identifiable as a Quick Workout"
    // and must match the rows `create_workout_day` MCP tool writes.
    expect(payload.program_id).toBe(null)
    expect(payload.label).toBe("Quick Push Day")
    expect(payload.emoji).toBe("⚡")
    expect(payload.sort_order).toBe(0)

    // Live workout (no saveAsDraft) → saved_at is intentionally NOT set in
    // the payload. The DB column defaults to NULL. Drafts get cycle 3.
    expect(payload.saved_at).toBeUndefined()
  })

  it("saveAsDraft: true stamps saved_at with a fresh ISO timestamp", async () => {
    const workout = makeMixedWorkout()

    const { result, store } = setupHook()
    act(() => {
      store.set(authAtom, TEST_USER)
    })

    const before = Date.now()
    await act(async () => {
      await result.current.mutateAsync({ workout, saveAsDraft: true })
    })
    const after = Date.now()

    const dayInsert = insertCalls.find((c) => c.table === "workout_days")
    const payload = dayInsert!.payload as Record<string, unknown>

    expect(typeof payload.saved_at).toBe("string")
    const stamp = Date.parse(payload.saved_at as string)
    expect(Number.isFinite(stamp)).toBe(true)
    expect(stamp).toBeGreaterThanOrEqual(before)
    expect(stamp).toBeLessThanOrEqual(after)
  })
})
