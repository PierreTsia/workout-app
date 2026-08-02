import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import {
  useTranslationReviewQueue,
  type TranslationReviewRow,
} from "@/hooks/useTranslationReviewQueue"
import {
  TranslationWriteRefusedError,
  useApproveTranslation,
} from "@/hooks/useApproveTranslation"
import { useExercisesForReview } from "@/hooks/useExercisesForReview"

/**
 * The seam between T158's read-only queue and T159's write: a decision has to
 * remove the row from `get_translations_for_review`, and nothing in either hook
 * says so on its own. The queue's filter lives in SQL, the stamp that satisfies
 * it lives in the mutation, and the two can drift apart without a single type
 * error.
 *
 * So this drives both real hooks against a fake `exercises` table whose queue
 * predicate is lifted from the migration itself — see the first test, which
 * fails the moment the SQL filter stops being the one modelled here.
 */

const migrationSources = import.meta.glob("../../supabase/migrations/*.sql", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

const FUNCTION_HEAD = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s/i

/**
 * The surviving definition of a function: migration filenames sort into apply
 * order, and `CREATE OR REPLACE` means only the last one is what the database
 * runs. Reading anything else would pin these fakes to history.
 */
const lastDefinitionOf = (name: string): string =>
  Object.entries(migrationSources)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([, sql]) =>
      sql
        .replace(/--[^\n]*/g, "")
        .split(new RegExp(`(?=${FUNCTION_HEAD.source})`, "i")),
    )
    .filter((chunk) =>
      new RegExp(`FUNCTION\\s+(?:public\\.)?${name}\\s*\\(`, "i").test(chunk),
    )
    .at(-1) ?? ""

const filterOf = (name: string): string | undefined =>
  /WHERE([\s\S]*?)ORDER BY/
    .exec(lastDefinitionOf(name))?.[1]
    ?.replace(/\s+/g, " ")
    .trim()

interface FakeRow {
  id: string
  name: string
  instructions_en: TranslationReviewRow["instructions_en"]
  instructions_en_status: string | null
  instructions_en_reviewed_at: string | null
  /** Content review and image enrichment share this one. Nothing here writes it. */
  reviewed_at: string | null
}

const english = {
  setup: ["Lie back on the bench."],
  movement: ["Press the bar upward."],
  breathing: ["Exhale as you press."],
  common_mistakes: ["Arched lower back."],
}

const makeRow = (id: string, status: string): FakeRow => ({
  id,
  name: id,
  instructions_en: english,
  instructions_en_status: status,
  instructions_en_reviewed_at: null,
  reviewed_at: null,
})

const db = vi.hoisted(() => ({ rows: [] as unknown[] }))

vi.mock("@/lib/supabase", () => {
  type Row = Record<string, unknown>

  return {
    supabase: {
      from: () => ({
        update: (payload: Row) => ({
          eq: (_column: string, id: string) => ({
            // PostgREST answers an UPDATE that matched nothing with an empty
            // array and no error — the shape an RLS refusal arrives in, and the
            // reason the mutation counts its rows instead of trusting `error`.
            // Modelling that faithfully is what makes the rejected-write test
            // below a test of the mutation rather than a test of this fake.
            select: async () => {
              const matched = (db.rows as Row[]).filter((row) => row.id === id)
              db.rows = (db.rows as Row[]).map((row) =>
                row.id === id ? { ...row, ...payload } : row,
              )
              return {
                data: matched.map((row) => ({ id: row.id })),
                error: null,
              }
            },
          }),
        }),
      }),
      // Both predicates are asserted against their migrations below, and
      // nothing else: no status filter on either, so a row can only leave a
      // queue by having that queue's own timestamp written.
      rpc: async (name: string) => ({
        data:
          name === "get_translations_for_review"
            ? (db.rows as Row[]).filter(
                (row) =>
                  row.instructions_en !== null &&
                  row.instructions_en_reviewed_at === null,
              )
            : (db.rows as Row[]).filter((row) => row.reviewed_at === null),
        error: null,
      }),
    },
  }
})

function setup() {
  return renderHookWithProviders(() => ({
    queue: useTranslationReviewQueue(),
    contentReview: useExercisesForReview(),
    decide: useApproveTranslation(),
  }))
}

const namesInQueue = (queue: TranslationReviewRow[] | undefined) =>
  (queue ?? []).map(({ name }) => name)

beforeEach(() => {
  db.rows = [makeRow("clean-row", "clean"), makeRow("flagged-row", "flagged")]
})

describe("a reviewed translation and the T158 queue", () => {
  // Pins the fake above to the real thing. If the RPC ever filters on something
  // else — `reviewed_at`, or the status — this fails first and says so, instead
  // of the round-trip tests below quietly proving a fiction.
  it("is filtered by the migration on exactly the two columns modelled here", () => {
    expect(filterOf("get_translations_for_review")).toBe(
      "e.instructions_en IS NOT NULL AND e.instructions_en_reviewed_at IS NULL",
    )
  })

  it("shares no filter column with the content review queue", () => {
    expect(filterOf("get_unreviewed_exercises_by_usage")).toBe(
      "e.reviewed_at IS NULL",
    )
  })

  it("drops an approved row from the queue on the next read", async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.queue.isSuccess).toBe(true))
    expect(namesInQueue(result.current.queue.data)).toContain("clean-row")

    await act(async () => {
      await result.current.decide.mutateAsync({
        exerciseId: "clean-row",
        status: "approved",
      })
    })

    await waitFor(() =>
      expect(namesInQueue(result.current.queue.data)).toEqual(["flagged-row"]),
    )
  })

  // The sharp end. `flagged` is the status the queue *prioritises*, so if the
  // stamp were missing and departure came from the verdict instead, reverting
  // would leave the row sitting at the top of the queue forever.
  it("drops a row reverted to French, even though flagged is what the queue ranks first", async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.queue.isSuccess).toBe(true))

    await act(async () => {
      await result.current.decide.mutateAsync({
        exerciseId: "clean-row",
        status: "flagged",
      })
    })

    await waitFor(() =>
      expect(namesInQueue(result.current.queue.data)).toEqual(["flagged-row"]),
    )
  })

  // The ticket's stated point de vigilance. `reviewed_at` is shared with image
  // enrichment and content review, so stamping it here would quietly retire an
  // exercise from /admin/review that nobody has read a word of — and the only
  // symptom would be a queue that is shorter than it should be.
  //
  // The refetch is the load-bearing part: the mutation does not invalidate this
  // key, so without it the assertion would merely be reading a stale cache and
  // would hold no matter what the write did.
  it("does not retire the row from the content review queue", async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.contentReview.isSuccess).toBe(true))
    expect(result.current.contentReview.data).toHaveLength(2)

    await act(async () => {
      await result.current.decide.mutateAsync({
        exerciseId: "clean-row",
        status: "approved",
      })
    })

    const refetched = await act(() => result.current.contentReview.refetch())

    expect(refetched.data?.map(({ name }) => name)).toEqual([
      "clean-row",
      "flagged-row",
    ])
  })

  // The refusal RLS actually produces: a successful request that changed
  // nothing. The mutation has to read that as a failure, or the reviewer gets a
  // green toast over a queue that never moved.
  it("leaves the whole queue standing when the write is refused", async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.queue.isSuccess).toBe(true))

    await expect(
      act(async () => {
        await result.current.decide.mutateAsync({
          exerciseId: "does-not-exist",
          status: "approved",
        })
      }),
    ).rejects.toBeInstanceOf(TranslationWriteRefusedError)

    const refetched = await act(() => result.current.queue.refetch())

    expect(refetched.data?.map(({ name }) => name)).toEqual([
      "clean-row",
      "flagged-row",
    ])
  })
})
