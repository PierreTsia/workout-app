import { vi, describe, it, expect, beforeEach } from "vitest"
import { waitFor, act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import { useExerciseHistory } from "./useExerciseHistory"

const selectFn = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn(() => ({ select: selectFn })) },
}))

const fetchExercisesByIds = vi.hoisted(() => vi.fn())
vi.mock("@/lib/fetchExercisesByIds", () => ({ fetchExercisesByIds }))

const catalogRow = (id: string, name: string, name_en: string) => ({
  id,
  name,
  name_en,
  muscle_group: "Pectoraux",
  equipment: "barbell",
  emoji: "💪",
})

function mockLogs(rows: { exercise_id: string; exercise_name_snapshot: string }[]) {
  selectFn.mockResolvedValue({ data: rows, error: null })
}

function render() {
  const rendered = renderHookWithProviders(() => useExerciseHistory())
  act(() => {
    rendered.store.set(authAtom, { id: "user-1" } as never)
  })
  return rendered
}

describe("useExerciseHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchExercisesByIds.mockResolvedValue([])
  })

  it("does not embed the catalog — it would be paid on every set_log row", async () => {
    mockLogs([{ exercise_id: "a", exercise_name_snapshot: "Squat" }])

    const { result } = render()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(selectFn).toHaveBeenCalledWith("exercise_id, exercise_name_snapshot")
    expect(selectFn.mock.calls[0][0]).not.toContain("exercises(")
  })

  it("looks the catalog up once for the distinct ids only", async () => {
    mockLogs([
      { exercise_id: "a", exercise_name_snapshot: "Squat" },
      { exercise_id: "a", exercise_name_snapshot: "Squat" },
      { exercise_id: "b", exercise_name_snapshot: "Bench" },
    ])

    const { result } = render()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(fetchExercisesByIds).toHaveBeenCalledTimes(1)
    expect(fetchExercisesByIds.mock.calls[0][0]).toEqual(["a", "b"])
    expect(fetchExercisesByIds.mock.calls[0][1]).not.toContain("*")
  })

  it("attaches the catalog row so T150 can localize the label", async () => {
    mockLogs([{ exercise_id: "a", exercise_name_snapshot: "Développé couché" }])
    fetchExercisesByIds.mockResolvedValue([
      catalogRow("a", "Développé couché", "Bench Press"),
    ])

    const { result } = render()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([
      {
        id: "a",
        name: "Développé couché",
        exercise: catalogRow("a", "Développé couché", "Bench Press"),
      },
    ])
  })

  it("keeps the option with a null embed when the catalog omits the id", async () => {
    mockLogs([{ exercise_id: "gone", exercise_name_snapshot: "Vieux mouvement" }])

    const { result } = render()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([
      { id: "gone", name: "Vieux mouvement", exercise: null },
    ])
  })

  it("keeps the first snapshot seen for a renamed exercise", async () => {
    mockLogs([
      { exercise_id: "a", exercise_name_snapshot: "Nouveau nom" },
      { exercise_id: "a", exercise_name_snapshot: "Ancien nom" },
    ])

    const { result } = render()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([
      { id: "a", name: "Nouveau nom", exercise: null },
    ])
  })

  it("sorts options by name", async () => {
    mockLogs([
      { exercise_id: "c", exercise_name_snapshot: "Squat" },
      { exercise_id: "a", exercise_name_snapshot: "Abdos" },
      { exercise_id: "b", exercise_name_snapshot: "Développé" },
    ])

    const { result } = render()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.map((o) => o.name)).toEqual([
      "Abdos",
      "Développé",
      "Squat",
    ])
  })

  it("stays idle without auth", () => {
    const { result } = renderHookWithProviders(() => useExerciseHistory())

    expect(result.current.fetchStatus).toBe("idle")
    expect(selectFn).not.toHaveBeenCalled()
  })
})
