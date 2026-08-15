import { vi, describe, it, expect, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { BlockHistorySheet } from "./BlockHistorySheet"
import type { BenchmarkCompletionHistory } from "@/hooks/useBenchmarkCompletionHistory"
import type { AmrapRunView } from "@/lib/amrapScore"
import type { BlockRunView } from "@/lib/blockCompletionHistory"

vi.mock("@/hooks/useOnlineStatus", () => ({ useOnlineStatus: () => true }))

function idleBlockHistory() {
  return {
    data: { views: [], trend: { seconds: [], dates: [] }, amrapViews: [] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }
}

const mockHistory = vi.fn(idleBlockHistory)
vi.mock("@/hooks/useBlockCompletionHistory", () => ({
  useBlockCompletionHistory: () => mockHistory(),
}))

function idleCatalog(): {
  data: BenchmarkCompletionHistory | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => void
} {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }
}

const mockCatalogHistory = vi.fn(idleCatalog)
vi.mock("@/hooks/useBenchmarkCompletionHistory", () => ({
  useBenchmarkCompletionHistory: () => mockCatalogHistory(),
}))

function view(
  sessionId: string,
  date: string,
  completionSeconds: number,
  opts: Partial<Omit<BlockRunView, "run">> & { isComplete?: boolean } = {},
): BlockRunView {
  return {
    run: {
      sessionId,
      date,
      completionSeconds,
      fingerprint: "fp",
      isComplete: opts.isComplete ?? true,
    },
    deltaSeconds: opts.deltaSeconds ?? null,
    isPb: opts.isPb ?? false,
    shapeChanged: opts.shapeChanged ?? false,
  }
}

function renderSheet() {
  return renderWithProviders(
    <BlockHistorySheet
      open
      onOpenChange={() => {}}
      blockId="block-1"
      label="Zeus"
    />,
  )
}

describe("BlockHistorySheet", () => {
  beforeEach(() => {
    mockHistory.mockReset()
    mockHistory.mockReturnValue(idleBlockHistory())
    mockCatalogHistory.mockReset()
    mockCatalogHistory.mockReturnValue(idleCatalog())
  })

  it("lists each run's completion time, the delta vs last, and a PB badge", () => {
    mockHistory.mockReturnValue({
      data: {
        views: [
          view("s2", "2026-06-08T10:00:00.000Z", 240, { deltaSeconds: -60, isPb: true }),
          view("s1", "2026-06-01T10:00:00.000Z", 300),
        ],
        trend: {
          seconds: [300, 240],
          dates: ["2026-06-01T10:00:00.000Z", "2026-06-08T10:00:00.000Z"],
        },
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })

    renderSheet()

    expect(screen.getByText("4:00")).toBeInTheDocument()
    expect(screen.getByText("5:00")).toBeInTheDocument()
    expect(screen.getByText(/60s/)).toBeInTheDocument()
    expect(screen.getByText("PB")).toBeInTheDocument()
  })

  it("shows an empty state when there are no runs", () => {
    mockHistory.mockReturnValue({
      data: { views: [], trend: { seconds: [], dates: [] } },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })

    renderSheet()

    expect(screen.getByText(/No completed runs yet\./)).toBeInTheDocument()
  })

  it("renders a glossed AmrapScore, PB, and rounds delta for AMRAP history", () => {
    const amrapView = (
      sessionId: string,
      date: string,
      fullRounds: number,
      leftover: number,
      leftoverName: string,
      opts: Partial<Pick<AmrapRunView, "deltaRounds" | "isPb" | "isComplete">> = {},
    ): AmrapRunView => ({
      sessionId,
      date,
      fingerprint: "amrap|1200|ex-1:5:0",
      isComplete: opts.isComplete ?? true,
      score: { fullRounds, leftover, leftoverName },
      deltaRounds: opts.deltaRounds ?? null,
      isPb: opts.isPb ?? false,
      shapeChanged: false,
    })

    mockHistory.mockReturnValue({
      data: {
        mode: "amrap",
        views: [],
        trend: { seconds: [], dates: [] },
        amrapViews: [
          amrapView("s2", "2026-08-15T10:00:00.000Z", 27, 3, "push-ups", {
            deltaRounds: 2,
            isPb: true,
          }),
          amrapView("s1", "2026-08-01T10:00:00.000Z", 25, 8, "push-ups"),
        ],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })

    renderSheet()

    expect(screen.getByText("27+3")).toBeInTheDocument()
    expect(screen.getByText("27 rounds · 3 push-ups")).toBeInTheDocument()
    expect(screen.getByText("25+8")).toBeInTheDocument()
    expect(screen.getByText("PB")).toBeInTheDocument()
    expect(screen.getByText(/2 rounds/)).toBeInTheDocument()
    expect(screen.queryByText("4:00")).not.toBeInTheDocument()
  })

  it("shows the cindy story and a first run with no delta when opened by catalog id", () => {
    mockCatalogHistory.mockReturnValue({
      data: {
        copy: {
          tagline_fr: "Le WOD de Tom Holland. 20 min.",
          tagline_en: "Tom Holland’s WOD. 20 min.",
          story_fr: "Cinq tractions, dix pompes, quinze squats.",
          story_en:
            "Five pull-ups, ten push-ups, fifteen squats. As many rounds as possible. The score is 27+3, not kilos. Holland did 27 rounds — your move.",
          reference: { name: "Tom Holland", score: "27" },
        },
        amrapViews: [
          {
            sessionId: "s1",
            date: "2026-08-01T10:00:00.000Z",
            fingerprint: "amrap|1200|ex-1:5:0",
            isComplete: true,
            score: { fullRounds: 27, leftover: 3, leftoverName: "push-ups" },
            deltaRounds: null,
            isPb: false,
            shapeChanged: false,
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })

    renderWithProviders(
      <BlockHistorySheet
        open
        onOpenChange={() => {}}
        blockId="block-tuesday"
        catalogId="cindy-catalog"
        label="Cindy"
      />,
    )

    expect(screen.getByText("Tom Holland’s WOD. 20 min.")).toBeInTheDocument()
    expect(screen.getByText(/Five pull-ups, ten push-ups, fifteen squats/)).toBeInTheDocument()
    expect(screen.getByText(/Tom Holland — 27 rounds/)).toBeInTheDocument()
    expect(screen.getByText("27+3")).toBeInTheDocument()
    expect(screen.queryByText(/vs last/)).not.toBeInTheDocument()
    expect(screen.queryByText("PB")).not.toBeInTheDocument()
  })

  it("keeps the story and withholds a fake PR when the catalog has no runs", () => {
    mockCatalogHistory.mockReturnValue({
      data: {
        copy: {
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

    renderWithProviders(
      <BlockHistorySheet
        open
        onOpenChange={() => {}}
        blockId="block-tuesday"
        catalogId="cindy-catalog"
        label="Cindy"
      />,
    )

    expect(screen.getByText("Tom Holland’s WOD. 20 min.")).toBeInTheDocument()
    expect(screen.getByText("No PR yet")).toBeInTheDocument()
    expect(screen.queryByText(/No completed runs yet/)).not.toBeInTheDocument()
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument()
    expect(screen.getByText(/Tom Holland — 27 rounds/)).toBeInTheDocument()
  })
})
