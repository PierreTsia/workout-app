import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  fetchExercisesByIds,
  FETCH_EXERCISES_BY_IDS_CHUNK_SIZE,
} from "./fetchExercisesByIds"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

function mockExerciseSelectIn(
  inImpl: (column: string, ids: string[]) => Promise<{ data: unknown; error: null }>,
) {
  const inFn = vi.fn(inImpl)
  vi.mocked(supabase.from).mockReturnValue({
    select: vi.fn(() => ({ in: inFn })),
  } as never)
  return inFn
}

describe("fetchExercisesByIds", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns [] without calling Supabase when ids are empty", async () => {
    await expect(fetchExercisesByIds([])).resolves.toEqual([])
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("dedupes ids and uses a single .in request", async () => {
    const inFn = mockExerciseSelectIn((_col, ids) =>
      Promise.resolve({
        data: ids.map((id) => ({ id, name: `n-${id}` })),
        error: null,
      }),
    )

    await fetchExercisesByIds(["a", "b", "a", "", "b"])

    expect(inFn).toHaveBeenCalledTimes(1)
    expect(inFn).toHaveBeenCalledWith("id", ["a", "b"])
    expect(supabase.from).toHaveBeenCalledWith("exercises")
  })

  it(`chunks requests at FETCH_EXERCISES_BY_IDS_CHUNK_SIZE (${FETCH_EXERCISES_BY_IDS_CHUNK_SIZE})`, async () => {
    const inFn = mockExerciseSelectIn((_col, ids) =>
      Promise.resolve({
        data: ids.map((id) => ({ id, name: `n-${id}` })),
        error: null,
      }),
    )

    const ids = Array.from(
      { length: FETCH_EXERCISES_BY_IDS_CHUNK_SIZE + 1 },
      (_, i) => `id-${i}`,
    )
    const rows = await fetchExercisesByIds(ids)

    expect(inFn).toHaveBeenCalledTimes(2)
    expect(inFn.mock.calls[0][1]).toHaveLength(FETCH_EXERCISES_BY_IDS_CHUNK_SIZE)
    expect(inFn.mock.calls[1][1]).toHaveLength(1)
    expect(rows).toHaveLength(FETCH_EXERCISES_BY_IDS_CHUNK_SIZE + 1)
  })
})
