import { vi, describe, it, expect, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders, mockQueryResult } from "@/test/utils"
import type { ExerciseBlockWithExercises, SetLogWithExercise } from "@/types/database"
import type { BenchmarkCompletionHistory } from "@/hooks/useBenchmarkCompletionHistory"
import { LastSessionRecap } from "./LastSessionRecap"

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

const lastSession = {
  id: "sess-theseus",
  started_at: "2026-08-20T10:00:00.000Z",
  finished_at: "2026-08-20T10:11:00.000Z",
  active_duration_ms: 11 * 60_000,
  total_sets_done: 21,
  has_skipped_sets: false,
}

const THESEUS_STATIONS = [
  { be: "be-row", ex: "ex-row", name: "Rowing", reps: "10" },
  { be: "be-dip", ex: "ex-dip", name: "Dips", reps: "10" },
  { be: "be-hang", ex: "ex-hang", name: "Hang", reps: "10" },
  { be: "be-push", ex: "ex-push", name: "Push-ups", reps: "10" },
  { be: "be-sit", ex: "ex-sit", name: "Sit-ups", reps: "10" },
] as const

function log(over: Partial<SetLogWithExercise> = {}): SetLogWithExercise {
  return {
    id: crypto.randomUUID(),
    session_id: lastSession.id,
    exercise_id: "ex-row",
    block_exercise_id: "be-row",
    workout_exercise_id: null,
    exercise_name_snapshot: "Rowing",
    set_number: 1,
    reps_logged: "10",
    duration_seconds: null,
    weight_logged: 0,
    estimated_1rm: null,
    was_pr: false,
    logged_at: "2026-08-20T10:00:00.000Z",
    rir: null,
    rest_seconds: null,
    prescribed_reps: null,
    prescribed_weight: null,
    prescribed_sets: null,
    prescribed_duration_seconds: null,
    exercise: null,
    ...over,
  }
}

/** 4 full rounds + leftover 0 on rowing → AMRAP 4+0. */
function theseusLogs(): SetLogWithExercise[] {
  const fullRounds = THESEUS_STATIONS.flatMap((station, stationIdx) =>
    [1, 2, 3, 4].map((round) =>
      log({
        block_exercise_id: station.be,
        exercise_id: station.ex,
        exercise_name_snapshot: station.name,
        set_number: round,
        reps_logged: station.reps,
        logged_at: new Date(
          Date.parse("2026-08-20T10:00:00.000Z") +
            ((round - 1) * THESEUS_STATIONS.length + stationIdx) * 1000,
        ).toISOString(),
      }),
    ),
  )
  const leftover = log({
    block_exercise_id: "be-row",
    exercise_id: "ex-row",
    exercise_name_snapshot: "Rowing",
    set_number: 5,
    reps_logged: "0",
    logged_at: "2026-08-20T10:10:50.000Z",
  })
  return [...fullRounds, leftover]
}

function theseusMeta() {
  return new Map(
    THESEUS_STATIONS.map((station, position) => [
      station.be,
      {
        blockId: "block-theseus",
        label: "Theseus",
        position,
        emoji: "🐂",
        blockSortOrder: 0,
        mode: "amrap" as const,
        benchmarkCircuitId: "theseus-catalog",
      },
    ]),
  )
}

function mockTheseusHistory() {
  useSessionSetLogs.mockReturnValue(mockQueryResult(theseusLogs()))
  useSessionBlockMeta.mockReturnValue(mockQueryResult(theseusMeta()))
  useSessionBlockRuns.mockReturnValue(
    mockQueryResult(
      new Map([
        [
          "block-theseus",
          {
            finished_at: "2026-08-20T10:11:00.000Z",
            benchmarkCircuitId: "theseus-catalog",
            catalogSlug: "theseus",
            catalogLabel: "Theseus",
          },
        ],
      ]),
    ),
  )
}

function makeProgramBlock(
  id: string,
  label: string,
  sort_order: number,
): ExerciseBlockWithExercises {
  return {
    id,
    workout_day_id: "day-1",
    label,
    rounds: 1,
    rest_seconds: 0,
    transition_seconds: 0,
    mode: "amrap",
    cap_seconds: 10 * 60,
    sort_order,
    created_at: "2026-01-01T00:00:00.000Z",
    exercises: [],
  }
}

describe("LastSessionRecap", () => {
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

  it("shows a Theseus AMRAP score instead of flattened 5 × 0–10", () => {
    mockTheseusHistory()

    renderWithProviders(
      <LastSessionRecap lastSession={lastSession} exercises={[]} blocks={[]} />,
    )

    expect(screen.getByText("4+0")).toBeInTheDocument()
    expect(screen.queryByText(/5\s*×\s*0/)).not.toBeInTheDocument()
  })

  it("defaults to Last session and shows four circuit labels on Programme", async () => {
    mockTheseusHistory()
    const blocks = [
      makeProgramBlock("b-1", "Theseus", 0),
      makeProgramBlock("b-2", "Zeus", 1),
      makeProgramBlock("b-3", "Heracles", 2),
      makeProgramBlock("b-4", "Ares", 3),
    ]

    renderWithProviders(
      <LastSessionRecap
        lastSession={lastSession}
        exercises={[]}
        blocks={blocks}
      />,
    )

    expect(screen.getByRole("tab", { name: /last session/i })).toHaveAttribute(
      "data-state",
      "active",
    )
    expect(screen.getByText("4+0")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("tab", { name: /^program$/i }))

    expect(screen.getByText("Zeus")).toBeInTheDocument()
    expect(screen.getByText("Heracles")).toBeInTheDocument()
    expect(screen.getByText("Ares")).toBeInTheDocument()
  })

  it("hides tabs when logs are empty and still shows the programme sequence", () => {
    useSessionSetLogs.mockReturnValue(mockQueryResult([]))
    const blocks = [
      makeProgramBlock("b-1", "Theseus", 0),
      makeProgramBlock("b-2", "Zeus", 1),
      makeProgramBlock("b-3", "Heracles", 2),
      makeProgramBlock("b-4", "Ares", 3),
    ]

    renderWithProviders(
      <LastSessionRecap
        lastSession={lastSession}
        exercises={[]}
        blocks={blocks}
      />,
    )

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
    expect(screen.getByText("Theseus")).toBeInTheDocument()
    expect(screen.getByText("Zeus")).toBeInTheDocument()
    expect(screen.getByText("Heracles")).toBeInTheDocument()
    expect(screen.getByText("Ares")).toBeInTheDocument()
  })
})
