import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import { Route, Routes } from "react-router-dom"
import { mockQueryResult, renderWithProviders } from "@/test/utils"
import type { ProgramScore } from "@/lib/programScore/types"
import type { Program } from "@/types/onboarding"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

const mockUseProgram = vi.fn()
const mockUseProgramIntent = vi.fn()
const mockUseProgramDayCards = vi.fn()
const mockOnline = vi.hoisted(() => vi.fn(() => true))

vi.mock("@/hooks/useProgram", () => ({
  useProgram: (id: string | null) => mockUseProgram(id),
}))

vi.mock("@/hooks/useProgramIntent", () => ({
  useProgramIntent: (id: string | null) => mockUseProgramIntent(id),
}))

vi.mock("@/hooks/useProgramDayCards", () => ({
  useProgramDayCards: (id: string | null) => mockUseProgramDayCards(id),
}))

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => mockOnline(),
}))

import { ProgramPage } from "./ProgramPage"

const VALID_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

function renderAt(path: string, locale: "en" | "fr" = "en") {
  return renderWithProviders(
    <Routes>
      <Route path="/programs/:programId" element={<ProgramPage />} />
    </Routes>,
    { initialEntries: [path], locale },
  )
}

function missingProgram() {
  return {
    ...mockQueryResult<Program | undefined>(undefined),
    isError: true,
    isSuccess: false,
    status: "error" as const,
    error: { code: "PGRST116", message: "not found" },
  }
}

function makeProgram(overrides: Partial<Program> = {}): Program {
  return {
    id: VALID_ID,
    user_id: "u-1",
    name: "PPL",
    template_id: null,
    is_active: true,
    archived_at: null,
    created_at: "2026-08-01T00:00:00Z",
    ...overrides,
  }
}

function emptyScore(): ProgramScore {
  return {
    hypertrophy: { band: "empty", volume: "empty", frequency: "empty" },
    strength: { band: "empty" },
    endurance: { band: "empty" },
    balance: { kind: "empty" },
    facts: {
      dayCount: 0,
      setCount: 0,
      circuitCount: 0,
      circuitModes: { amrap: 0, rounds: 0 },
      mix: { free: 0, machine: 0, bodyweight: 0, other: 0 },
    },
  }
}

function scoredWeek(): ProgramScore {
  return {
    hypertrophy: { band: "ok", volume: "ok", frequency: "ok" },
    strength: { band: "short" },
    endurance: { band: "high" },
    balance: { kind: "score", value: 42 },
    facts: {
      dayCount: 3,
      setCount: 24,
      circuitCount: 1,
      circuitModes: { amrap: 1, rounds: 0 },
      mix: { free: 20, machine: 4, bodyweight: 0, other: 0 },
    },
  }
}

describe("ProgramPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseProgram.mockReturnValue(mockQueryResult(undefined))
    mockUseProgramIntent.mockReturnValue(mockQueryResult(undefined))
    mockUseProgramDayCards.mockReturnValue(mockQueryResult([]))
    mockOnline.mockReturnValue(true)
  })

  it("shows not-found for a junk id and does not fabricate On target bands", () => {
    renderAt("/programs/not-a-uuid")

    expect(screen.getByText("This program isn’t here.")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Back to programs" }),
    ).toHaveAttribute("href", "/library/programs")
    expect(screen.queryByText("On target")).not.toBeInTheDocument()
  })

  it("shows not-found for a missing program and does not fabricate On target bands", () => {
    mockUseProgram.mockReturnValue(missingProgram())
    mockUseProgramIntent.mockReturnValue(mockQueryResult(undefined))

    renderAt(`/programs/${VALID_ID}`)

    expect(screen.getByText("This program isn’t here.")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Back to programs" }),
    ).toHaveAttribute("href", "/library/programs")
    expect(screen.queryByText("On target")).not.toBeInTheDocument()
  })

  it("shows empty.scores for a week with no items and does not show Low", () => {
    mockUseProgram.mockReturnValue(mockQueryResult(makeProgram()))
    mockUseProgramIntent.mockReturnValue(mockQueryResult(emptyScore()))

    renderAt(`/programs/${VALID_ID}`)

    expect(screen.getByText("Add a day to see what this program is for.")).toBeInTheDocument()
    expect(screen.queryByText("Low")).not.toBeInTheDocument()
    expect(screen.queryByText("On target")).not.toBeInTheDocument()
  })

  it("renders scores, facts, and DayCards for the owner, without Start", () => {
    mockUseProgram.mockReturnValue(mockQueryResult(makeProgram()))
    mockUseProgramIntent.mockReturnValue(mockQueryResult(scoredWeek()))
    mockUseProgramDayCards.mockReturnValue(
      mockQueryResult([
        {
          id: "day-1",
          label: "🔥 Push",
          exerciseCount: 1,
          items: [
            {
              kind: "solo" as const,
              id: "we-1",
              emoji: "🏋️",
              name: "Bench Press",
              sets: 3,
              reps: "8",
              restSeconds: 90,
              sortOrder: 0,
            },
          ],
        },
      ]),
    )

    renderAt(`/programs/${VALID_ID}`)

    expect(screen.getByRole("heading", { name: "PPL" })).toBeInTheDocument()
    expect(
      screen.getByText(
        "On target means most muscles you programmed hit 8–20 sets and 2–3 days this week.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("3 days · 24 sets · 1 circuits")).toBeInTheDocument()
    expect(screen.getByText(/Free weights/)).toBeInTheDocument()
    expect(screen.getByText(/Bench Press/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      `/builder/${VALID_ID}`,
    )
    expect(screen.queryByRole("button", { name: /start/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /start/i })).not.toBeInTheDocument()
  })

  it("shows loadError and no On target when the program query fails", () => {
    mockUseProgram.mockReturnValue({
      ...mockQueryResult(undefined),
      isError: true,
      isSuccess: false,
      status: "error" as const,
      error: { message: "network" },
    })

    renderAt(`/programs/${VALID_ID}`)

    expect(screen.getByText("We couldn’t load this program.")).toBeInTheDocument()
    expect(screen.queryByText("On target")).not.toBeInTheDocument()
  })

  it("shows offline copy and no bands when offline with a cache miss", () => {
    mockOnline.mockReturnValue(false)
    mockUseProgram.mockReturnValue({
      ...mockQueryResult(undefined),
      isLoading: false,
      isPending: false,
    })

    renderAt(`/programs/${VALID_ID}`)

    expect(
      screen.getByText("Scores will show when this week is already on the phone."),
    ).toBeInTheDocument()
    expect(screen.queryByText("On target")).not.toBeInTheDocument()
    expect(screen.queryByText("Low")).not.toBeInTheDocument()
  })
})
