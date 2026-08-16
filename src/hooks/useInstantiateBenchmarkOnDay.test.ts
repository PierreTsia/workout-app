import { vi, describe, it, expect, beforeEach } from "vitest"
import { act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import type { CatalogPreviewRow } from "@/lib/previewCatalogCircuit"
import { useInstantiateBenchmarkOnDay } from "./useInstantiateBenchmarkOnDay"

const CINDY_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const PULL_ID = "11111111-1111-4111-8111-111111111111"
const PUSH_ID = "22222222-2222-4222-8222-222222222222"
const SQUAT_ID = "33333333-3333-4333-8333-333333333333"

function makeCindy(overrides: Partial<CatalogPreviewRow> = {}): CatalogPreviewRow {
  return {
    id: CINDY_ID,
    slug: "cindy",
    label: "Cindy",
    aliases: ["holland", "tom holland"],
    rx: {
      mode: "amrap",
      cap_seconds: 1200,
      exercises: [
        { exercise_id: PULL_ID, amount: 5, weight: 0 },
        { exercise_id: PUSH_ID, amount: 10, weight: 0 },
        { exercise_id: SQUAT_ID, amount: 15, weight: 0 },
      ],
    },
    tagline_fr: "Le WOD de Tom Holland.",
    tagline_en: "Tom Holland’s WOD.",
    ...overrides,
  }
}

const insertCalls: { table: string; payload: unknown }[] = []
const fetchExercisesByIds = vi.hoisted(() => vi.fn())

vi.mock("@/lib/fetchExercisesByIds", () => ({ fetchExercisesByIds }))

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      insert: (payload: unknown) => {
        insertCalls.push({ table, payload })
        return {
          select: () => ({
            single: () =>
              Promise.resolve({
                data: table === "exercise_blocks" ? { id: "block-1" } : null,
                error: null,
              }),
          }),
          then(
            onFulfilled: (v: { data: null; error: null }) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) {
            return Promise.resolve({ data: null, error: null }).then(
              onFulfilled,
              onRejected,
            )
          },
        }
      },
    }),
  },
}))

describe("useInstantiateBenchmarkOnDay", () => {
  beforeEach(() => {
    insertCalls.length = 0
    fetchExercisesByIds.mockReset()
  })

  it("throws before insert when an exercise_id is missing from the catalog", async () => {
    fetchExercisesByIds.mockResolvedValue([
      { id: PULL_ID, name: "Tractions", muscle_group: "Dos", emoji: "🚣" },
    ])

    const { result, store } = renderHookWithProviders(() =>
      useInstantiateBenchmarkOnDay(),
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await expect(
      result.current.mutateAsync({
        dayId: "day-1",
        catalog: makeCindy(),
        existingMaxSortOrder: -1,
      }),
    ).rejects.toThrow(/missing exercise_id/)

    expect(insertCalls).toEqual([])
  })

  it("stamps benchmark_circuit_id and copies catalog Rx onto the day block", async () => {
    fetchExercisesByIds.mockResolvedValue([
      { id: PULL_ID, name: "Tractions", muscle_group: "Dos", emoji: "🚣" },
      { id: PUSH_ID, name: "Pompes", muscle_group: "Pectoraux", emoji: "🏋️" },
      { id: SQUAT_ID, name: "Squat", muscle_group: "Quadriceps", emoji: "🦵" },
    ])

    const { result, store } = renderHookWithProviders(() =>
      useInstantiateBenchmarkOnDay(),
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await act(async () => {
      await result.current.mutateAsync({
        dayId: "day-1",
        catalog: makeCindy(),
        existingMaxSortOrder: 2,
      })
    })

    expect(fetchExercisesByIds).toHaveBeenCalledWith(
      [PULL_ID, PUSH_ID, SQUAT_ID],
      "id, name, muscle_group, emoji",
    )

    const blockInsert = insertCalls.find((c) => c.table === "exercise_blocks")
    expect(blockInsert?.payload).toEqual({
      workout_day_id: "day-1",
      label: "Cindy",
      rounds: 1,
      rest_seconds: 0,
      transition_seconds: 0,
      sort_order: 3,
      mode: "amrap",
      cap_seconds: 1200,
      benchmark_circuit_id: CINDY_ID,
    })

    const cellInsert = insertCalls.find((c) => c.table === "block_exercises")
    expect(cellInsert?.payload).toEqual([
      {
        exercise_id: PULL_ID,
        name_snapshot: "Tractions",
        muscle_snapshot: "Dos",
        emoji_snapshot: "🚣",
        position: 0,
        per_round: [{ amount: 5, weight: 0 }],
        block_id: "block-1",
      },
      {
        exercise_id: PUSH_ID,
        name_snapshot: "Pompes",
        muscle_snapshot: "Pectoraux",
        emoji_snapshot: "🏋️",
        position: 1,
        per_round: [{ amount: 10, weight: 0 }],
        block_id: "block-1",
      },
      {
        exercise_id: SQUAT_ID,
        name_snapshot: "Squat",
        muscle_snapshot: "Quadriceps",
        emoji_snapshot: "🦵",
        position: 2,
        per_round: [{ amount: 15, weight: 0 }],
        block_id: "block-1",
      },
    ])
  })

  it("throws Not authenticated when there is no user", async () => {
    const { result } = renderHookWithProviders(() =>
      useInstantiateBenchmarkOnDay(),
    )

    await expect(
      result.current.mutateAsync({
        dayId: "day-1",
        catalog: makeCindy(),
        existingMaxSortOrder: -1,
      }),
    ).rejects.toThrow("Not authenticated")

    expect(fetchExercisesByIds).not.toHaveBeenCalled()
    expect(insertCalls).toEqual([])
  })

  it("invalidates exercise-blocks for the day and workout-days", async () => {
    fetchExercisesByIds.mockResolvedValue([
      { id: PULL_ID, name: "Tractions", muscle_group: "Dos", emoji: "🚣" },
      { id: PUSH_ID, name: "Pompes", muscle_group: "Pectoraux", emoji: "🏋️" },
      { id: SQUAT_ID, name: "Squat", muscle_group: "Quadriceps", emoji: "🦵" },
    ])

    const { result, store, queryClient } = renderHookWithProviders(() =>
      useInstantiateBenchmarkOnDay(),
    )
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await act(async () => {
      await result.current.mutateAsync({
        dayId: "day-1",
        catalog: makeCindy(),
        existingMaxSortOrder: -1,
      })
    })

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["exercise-blocks", "day-1"],
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["workout-days"] })
  })
})
