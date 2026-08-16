import { vi, describe, it, expect, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders, mockQueryResult, type TestLocale } from "@/test/utils"
import type {
  ExerciseLabelFields,
  Session,
  SetLogWithExercise,
} from "@/types/database"
import { SessionRow } from "./SessionRow"
import type { BenchmarkCompletionHistory } from "@/hooks/useBenchmarkCompletionHistory"

// The circuit sheet pulls in the real client transitively, which throws on
// import when the env has no Supabase URL — as CI's does.
vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

const useSessionSetLogs = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/useSessionSetLogs", () => ({ useSessionSetLogs }))

const useSessionBlockMeta = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/useSessionBlockMeta", () => ({ useSessionBlockMeta }))

const useSessionBlockRuns = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/useSessionBlockRuns", () => ({ useSessionBlockRuns }))

const useBenchmarkCompletionHistory = vi.hoisted(() =>
  vi.fn(
    (): {
      data: BenchmarkCompletionHistory | undefined
      isLoading: boolean
      isError: boolean
      refetch: () => void
    } => ({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
  ),
)
vi.mock("@/hooks/useBenchmarkCompletionHistory", () => ({
  useBenchmarkCompletionHistory,
}))

vi.mock("@/hooks/useBlockCompletionHistory", () => ({
  useBlockCompletionHistory: () => ({
    data: { views: [], trend: { seconds: [], dates: [] }, amrapViews: [] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

const session: Session = {
  id: "sess-1",
  user_id: "user-1",
  workout_day_id: "day-1",
  workout_label_snapshot: "Lundi",
  started_at: "2026-06-15T10:00:00.000Z",
  finished_at: "2026-06-15T11:00:00.000Z",
  active_duration_ms: 3_600_000,
  total_sets_done: 3,
  has_skipped_sets: false,
  cycle_id: "cyc-1",
}

const catalog = (name: string, name_en: string): ExerciseLabelFields => ({
  id: "ex-1",
  name,
  name_en,
  muscle_group: "Pectoraux",
  equipment: "barbell",
  emoji: "🏋️",
})

const log = (over: Partial<SetLogWithExercise> = {}): SetLogWithExercise => ({
  id: crypto.randomUUID(),
  session_id: "sess-1",
  exercise_id: "ex-1",
  block_exercise_id: null,
  workout_exercise_id: null,
  exercise_name_snapshot: "Frozen name",
  set_number: 1,
  reps_logged: "10",
  duration_seconds: null,
  weight_logged: 100,
  estimated_1rm: null,
  was_pr: false,
  logged_at: "2026-06-15T10:00:00.000Z",
  rir: null,
  rest_seconds: null,
  prescribed_reps: null,
  prescribed_weight: null,
  prescribed_sets: null,
  prescribed_duration_seconds: null,
  exercise: null,
  ...over,
})

async function expand(locale: TestLocale) {
  renderWithProviders(<SessionRow session={session} />, { locale })
  await userEvent.click(screen.getByRole("button"))
}

describe("SessionRow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSessionBlockMeta.mockReturnValue(mockQueryResult(new Map()))
    useSessionBlockRuns.mockReturnValue(mockQueryResult(new Map()))
    useBenchmarkCompletionHistory.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
  })

  it.each([
    ["en", "Bench Press", "Développé couché"],
    ["fr", "Développé couché", "Bench Press"],
  ] as const)("names a solo group in %s", async (locale, expected, hidden) => {
    useSessionSetLogs.mockReturnValue(
      mockQueryResult([log({ exercise: catalog("Développé couché", "Bench Press") })]),
    )

    await expand(locale)

    expect(screen.getByText(expected)).toBeInTheDocument()
    expect(screen.queryByText(hidden)).not.toBeInTheDocument()
    expect(screen.queryByText("Frozen name")).not.toBeInTheDocument()
  })

  it("falls back to the snapshot when the catalog row is gone", async () => {
    useSessionSetLogs.mockReturnValue(mockQueryResult([log({ exercise: null })]))

    await expand("en")

    expect(screen.getByText("Frozen name")).toBeInTheDocument()
  })

  it("shows a revisited exercise once, in the order it was trained", async () => {
    const bench = catalog("Développé couché", "Bench Press")
    const row = { ...catalog("Rowing", "Barbell Row"), id: "ex-2" }
    useSessionSetLogs.mockReturnValue(
      mockQueryResult([
        log({ exercise_id: "a", exercise: bench, set_number: 1, logged_at: "2026-06-15T10:00:00Z" }),
        log({ exercise_id: "b", exercise: row, set_number: 1, logged_at: "2026-06-15T10:02:00Z" }),
        log({ exercise_id: "a", exercise: bench, set_number: 2, logged_at: "2026-06-15T10:04:00Z" }),
      ]),
    )

    await expand("en")

    // One heading each, Bench first because it was logged first — alphabetical
    // order would have put "Barbell Row" on top.
    expect(screen.getAllByText("Bench Press")).toHaveLength(1)
    const headings = screen
      .getAllByText(/Bench Press|Barbell Row/)
      .map((el) => el.textContent)
    expect(headings).toEqual(["Bench Press", "Barbell Row"])
  })

  it("opens the catalog history sheet when the circuit carries a catalog id", async () => {
    useSessionSetLogs.mockReturnValue(
      mockQueryResult([
        log({
          block_exercise_id: "be-cindy",
          exercise_name_snapshot: "Pompes",
        }),
      ]),
    )
    useSessionBlockMeta.mockReturnValue(
      mockQueryResult(
        new Map([
          [
            "be-cindy",
            {
              blockId: "block-tue",
              label: "Cindy",
              position: 0,
              emoji: "🔥",
              blockSortOrder: 0,
              mode: "amrap",
              benchmarkCircuitId: "cindy-catalog",
            },
          ],
        ]),
      ),
    )
    useBenchmarkCompletionHistory.mockReturnValue({
      data: {
        copy: {
          slug: "cindy",
          tagline_fr: "Le WOD de Tom Holland. 20 min.",
          tagline_en: "Tom Holland’s WOD. 20 min.",
          story_fr: "Cinq tractions.",
          story_en: "Five pull-ups, ten push-ups, fifteen squats.",
          reference: { name: "Tom Holland", score: "27" },
        },
        amrapViews: [],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })

    await expand("en")
    await userEvent.click(screen.getByRole("button", { name: /cindy/i }))

    expect(screen.getByText("Tom Holland’s WOD. 20 min.")).toBeInTheDocument()
    expect(screen.getByText("No PR yet")).toBeInTheDocument()
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument()
  })

  it("opens Cindy history from the GO stamp after the live block was forked", async () => {
    useSessionSetLogs.mockReturnValue(
      mockQueryResult([
        log({
          block_exercise_id: "be-cindy",
          exercise_name_snapshot: "Pompes",
        }),
      ]),
    )
    useSessionBlockMeta.mockReturnValue(
      mockQueryResult(
        new Map([
          [
            "be-cindy",
            {
              blockId: "block-tue",
              label: "Cindy Light",
              position: 0,
              emoji: "🔥",
              blockSortOrder: 0,
              mode: "amrap",
              benchmarkCircuitId: "fork-id",
            },
          ],
        ]),
      ),
    )
    useSessionBlockRuns.mockReturnValue(
      mockQueryResult(
        new Map([
          [
            "block-tue",
            {
              finished_at: "2026-08-01T10:20:00.000Z",
              benchmarkCircuitId: "cindy-catalog",
              catalogSlug: "cindy",
            },
          ],
        ]),
      ),
    )
    useBenchmarkCompletionHistory.mockReturnValue({
      data: {
        copy: {
          slug: "cindy",
          tagline_fr: "Le WOD de Tom Holland. 20 min.",
          tagline_en: "Tom Holland’s WOD. 20 min.",
          story_fr: "Cinq tractions.",
          story_en: "Five pull-ups, ten push-ups, fifteen squats.",
          reference: { name: "Tom Holland", score: "27" },
        },
        amrapViews: [],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })

    await expand("en")
    expect(screen.queryByText("Cindy Light")).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /cindy/i }))

    expect(useBenchmarkCompletionHistory).toHaveBeenCalledWith(
      true,
      "cindy-catalog",
    )
    expect(useBenchmarkCompletionHistory).not.toHaveBeenCalledWith(
      true,
      "fork-id",
    )
  })
})
