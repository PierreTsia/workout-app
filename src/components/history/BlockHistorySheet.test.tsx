import { vi, describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { BlockHistorySheet } from "./BlockHistorySheet"
import type { BlockRunView } from "@/lib/blockCompletionHistory"

vi.mock("@/hooks/useOnlineStatus", () => ({ useOnlineStatus: () => true }))

const mockHistory = vi.fn()
vi.mock("@/hooks/useBlockCompletionHistory", () => ({
  useBlockCompletionHistory: () => mockHistory(),
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
})
