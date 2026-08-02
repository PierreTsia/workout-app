import { describe, it, expect, vi, beforeEach } from "vitest"
import { act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { EXERCISES_BATCH_QUERY_KEY } from "@/hooks/useExerciseBatch"
import { TRANSLATION_REVIEW_QUEUE_KEY } from "@/hooks/useTranslationReviewQueue"
import {
  TranslationWriteRefusedError,
  useApproveTranslation,
} from "./useApproveTranslation"

type Payload = Record<string, unknown>

type Response = { data: { id: string }[] | null; error: Error | null }

const select = vi.fn<(columns: string) => Promise<Response>>()
const eq = vi.fn<(column: string, id: string) => { select: typeof select }>(
  () => ({ select }),
)
const update = vi.fn<(payload: Payload) => { eq: typeof eq }>(() => ({ eq }))

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}))

const mockFrom = vi.fn<(table: string) => { update: typeof update }>(() => ({
  update,
}))

const lastPayload = (): Payload => update.mock.calls.at(-1)?.[0] ?? {}

beforeEach(() => {
  vi.clearAllMocks()
  select.mockResolvedValue({ data: [{ id: "ex-1" }], error: null })
})

describe("useApproveTranslation", () => {
  // Copilot's finding: the row comes back only to be discarded, and it carries
  // both instructions blobs.
  it("asks the database for an id rather than the row it just wrote", async () => {
    const { result } = renderHookWithProviders(() => useApproveTranslation())

    await act(async () => {
      await result.current.mutateAsync({
        exerciseId: "ex-1",
        status: "approved",
      })
    })

    expect(select).toHaveBeenCalledWith("id")
  })

  // The defect underneath it. An UPDATE that RLS refuses is not an error over
  // PostgREST — it is a successful request that matched no rows. A hook that
  // ignores its result therefore reports success, fires the green toast, and
  // leaves the row in the queue with nobody able to tell a refused write from
  // a slow one.
  it("treats a response carrying no row as a refused write", async () => {
    select.mockResolvedValue({ data: [], error: null })
    const { result } = renderHookWithProviders(() => useApproveTranslation())

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          exerciseId: "ex-1",
          status: "approved",
        })
      }),
    ).rejects.toBeInstanceOf(TranslationWriteRefusedError)
  })

  it("stamps the translation verdict and its own review timestamp", async () => {
    const { result } = renderHookWithProviders(() => useApproveTranslation())

    await act(async () => {
      await result.current.mutateAsync({
        exerciseId: "ex-1",
        status: "approved",
      })
    })

    expect(mockFrom).toHaveBeenCalledWith("exercises")
    expect(eq).toHaveBeenCalledWith("id", "ex-1")
    expect(lastPayload()).toMatchObject({ instructions_en_status: "approved" })
    expect(
      Date.parse(lastPayload().instructions_en_reviewed_at as string),
    ).not.toBeNaN()
  })

  // The whole reason this hook exists instead of reusing useAdminUpdateExercise:
  // `reviewed_at` is shared with content review and image enrichment, so writing
  // it here would drain /admin/review's queue without anyone reading a word.
  it("never touches the shared content-review columns", async () => {
    const { result } = renderHookWithProviders(() => useApproveTranslation())

    await act(async () => {
      await result.current.mutateAsync({
        exerciseId: "ex-1",
        status: "approved",
      })
    })

    expect(Object.keys(lastPayload())).not.toContain("reviewed_at")
    expect(Object.keys(lastPayload())).not.toContain("reviewed_by")
  })

  it("carries the corrected English when the reviewer fixed it first", async () => {
    const { result } = renderHookWithProviders(() => useApproveTranslation())
    const corrected = {
      setup: ["Set your hands shoulder-width apart."],
      movement: ["Press the bar upward."],
      breathing: ["Exhale as you press."],
      common_mistakes: ["Arched lower back."],
    }

    await act(async () => {
      await result.current.mutateAsync({
        exerciseId: "ex-1",
        status: "approved",
        instructionsEn: corrected,
      })
    })

    expect(lastPayload().instructions_en).toEqual(corrected)
  })

  // An untouched approval must not rewrite the column with a round-tripped copy:
  // the value the pipeline wrote is the value that stays.
  it("omits the English column entirely when nothing was edited", async () => {
    const { result } = renderHookWithProviders(() => useApproveTranslation())

    await act(async () => {
      await result.current.mutateAsync({
        exerciseId: "ex-1",
        status: "approved",
      })
    })

    expect(Object.keys(lastPayload())).not.toContain("instructions_en")
  })

  // Reverting is a verdict, not a deletion: the row leaves the queue and the app
  // falls back to French, but the translation stays in the table so a later
  // `--force` pass can pick it up instead of paying for it twice.
  it("reverting flags the row without discarding the translation", async () => {
    const { result } = renderHookWithProviders(() => useApproveTranslation())

    await act(async () => {
      await result.current.mutateAsync({
        exerciseId: "ex-1",
        status: "flagged",
      })
    })

    expect(lastPayload()).toMatchObject({ instructions_en_status: "flagged" })
    expect(
      Date.parse(lastPayload().instructions_en_reviewed_at as string),
    ).not.toBeNaN()
    expect(Object.keys(lastPayload())).not.toContain("instructions_en")
  })

  // The catalog row is cached in four places besides the queue, and an approved
  // translation changes what every one of them renders.
  it("invalidates the review queue and every catalog cache holding the row", async () => {
    const { result, queryClient } = renderHookWithProviders(() =>
      useApproveTranslation(),
    )
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")

    await act(async () => {
      await result.current.mutateAsync({
        exerciseId: "ex-1",
        status: "approved",
      })
    })

    const invalidated = invalidate.mock.calls.map(([args]) => args?.queryKey)
    expect(invalidated).toEqual(
      expect.arrayContaining([
        [TRANSLATION_REVIEW_QUEUE_KEY],
        ["exercise", "ex-1"],
        [EXERCISES_BATCH_QUERY_KEY],
        ["admin-exercises"],
        ["exercise-library-paginated"],
      ]),
    )
  })

  it("leaves every cache alone when the write fails", async () => {
    select.mockResolvedValue({ data: null, error: new Error("rls denied") })
    const { result, queryClient } = renderHookWithProviders(() =>
      useApproveTranslation(),
    )
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          exerciseId: "ex-1",
          status: "approved",
        })
      }),
    ).rejects.toThrow("rls denied")

    expect(invalidate).not.toHaveBeenCalled()
  })
})
