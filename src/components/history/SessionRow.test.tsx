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

// The circuit sheet pulls in the real client transitively, which throws on
// import when the env has no Supabase URL — as CI's does.
vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

const useSessionSetLogs = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/useSessionSetLogs", () => ({ useSessionSetLogs }))

const useSessionBlockMeta = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/useSessionBlockMeta", () => ({ useSessionBlockMeta }))

const useSessionBlockRuns = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/useSessionBlockRuns", () => ({ useSessionBlockRuns }))

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
})
