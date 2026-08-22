import { vi, describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Route, Routes } from "react-router-dom"
import { renderWithProviders } from "@/test/utils"
import { ProgramCard } from "./ProgramCard"
import type { Program } from "@/types/onboarding"
import type { ProgramScore } from "@/lib/programScore/types"

function makeScore(overrides: Partial<ProgramScore> = {}): ProgramScore {
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
    ...overrides,
  }
}

const BASE_PROGRAM: Program = {
  id: "p-1",
  user_id: "u-1",
  name: "Test Program",
  template_id: "tpl-1",
  is_active: false,
  archived_at: null,
  created_at: "2026-03-15T10:00:00Z",
}

function renderCard(overrides = {}) {
  const defaultProps = {
    program: BASE_PROGRAM,
    isActive: false,
    isSessionActive: false,
    onActivate: vi.fn(),
    onArchive: vi.fn(),
    onEdit: vi.fn(),
    ...overrides,
  }
  renderWithProviders(<ProgramCard {...defaultProps} />)
  return defaultProps
}

describe("ProgramCard", () => {
  it("renders program name", () => {
    renderCard()
    expect(screen.getByText("Test Program")).toBeInTheDocument()
  })

  it("shows score chips and the fact line under the name", () => {
    renderCard({ score: makeScore() })

    expect(screen.getByText("Test Program")).toBeInTheDocument()
    expect(screen.getByText("Muscle growth · On target")).toBeInTheDocument()
    expect(screen.getByText("Strength · Low")).toBeInTheDocument()
    expect(screen.getByText("Endurance · High")).toBeInTheDocument()
    expect(screen.getByText("Balance 42")).toBeInTheDocument()
    expect(screen.getByText("3 days · 24 sets · 1 circuits")).toBeInTheDocument()
  })

  it("does not fabricate On target chips for an empty program", () => {
    renderCard({
      score: makeScore({
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
      }),
    })

    expect(screen.queryByText("On target")).not.toBeInTheDocument()
    expect(screen.queryByText(/Muscle growth/)).not.toBeInTheDocument()
    expect(screen.queryByText("Low")).not.toBeInTheDocument()
    expect(screen.queryByText(/Balance/)).not.toBeInTheDocument()
  })

  it("shows skeleton chips while intent is loading — not Low", () => {
    renderCard({ intentLoading: true })

    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(
      0,
    )
    expect(screen.queryByText("Low")).not.toBeInTheDocument()
    expect(screen.queryByText("On target")).not.toBeInTheDocument()
  })

  it("uses the FR contract for chips and the fact line", () => {
    const defaultProps = {
      program: BASE_PROGRAM,
      isActive: false,
      isSessionActive: false,
      onActivate: vi.fn(),
      onArchive: vi.fn(),
      onEdit: vi.fn(),
      score: makeScore(),
    }
    renderWithProviders(<ProgramCard {...defaultProps} />, { locale: "fr" })

    expect(screen.getByText("Prise de masse · Dans le viseur")).toBeInTheDocument()
    expect(screen.getByText("Force · Faible")).toBeInTheDocument()
    expect(screen.getByText("Endurance · Élevé")).toBeInTheDocument()
    expect(screen.getByText("Répartition 42")).toBeInTheDocument()
    expect(screen.queryByText(/Équilibre/)).not.toBeInTheDocument()
    expect(screen.getByText("3 j · 24 séries · 1 circuits")).toBeInTheDocument()
  })

  it("shows Active badge when active", () => {
    renderCard({ isActive: true })
    expect(screen.getByText("Active")).toBeInTheDocument()
  })

  it("hides action buttons when active", () => {
    renderCard({ isActive: true })
    expect(screen.queryByRole("button", { name: "Activate" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument()
  })

  it("shows Activate and Archive for inactive program", () => {
    renderCard()
    expect(screen.getByRole("button", { name: "Activate" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument()
  })

  it("disables Activate when session is active", () => {
    renderCard({ isSessionActive: true })
    expect(screen.getByRole("button", { name: "Activate" })).toBeDisabled()
  })

  it("shows Unarchive for archived program", () => {
    renderCard({ program: { ...BASE_PROGRAM, archived_at: "2026-03-15T12:00:00Z" } })
    expect(screen.getByRole("button", { name: "Unarchive" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Activate" })).not.toBeInTheDocument()
  })

  it("shows Archived badge for archived program", () => {
    renderCard({ program: { ...BASE_PROGRAM, archived_at: "2026-03-15T12:00:00Z" } })
    expect(screen.getByText("Archived")).toBeInTheDocument()
  })

  it("navigates to the program page when the card title is clicked", async () => {
    const defaultProps = {
      program: BASE_PROGRAM,
      isActive: false,
      isSessionActive: false,
      onActivate: vi.fn(),
      onArchive: vi.fn(),
      onEdit: vi.fn(),
    }
    renderWithProviders(
      <Routes>
        <Route path="/" element={<ProgramCard {...defaultProps} />} />
        <Route path="/programs/:programId" element={<div>program page</div>} />
      </Routes>,
    )

    await userEvent.setup().click(screen.getByRole("link", { name: /Test Program/ }))
    expect(screen.getByText("program page")).toBeInTheDocument()
  })

  it("does not navigate when Activate is clicked", async () => {
    const onActivate = vi.fn()
    const defaultProps = {
      program: BASE_PROGRAM,
      isActive: false,
      isSessionActive: false,
      onActivate,
      onArchive: vi.fn(),
      onEdit: vi.fn(),
    }
    renderWithProviders(
      <Routes>
        <Route path="/" element={<ProgramCard {...defaultProps} />} />
        <Route path="/programs/:programId" element={<div>program page</div>} />
      </Routes>,
    )

    await userEvent.setup().click(screen.getByRole("button", { name: "Activate" }))
    expect(onActivate).toHaveBeenCalledOnce()
    expect(screen.queryByText("program page")).not.toBeInTheDocument()
  })

  it("calls onActivate when Activate button is clicked", async () => {
    const props = renderCard()
    await userEvent.setup().click(screen.getByRole("button", { name: "Activate" }))
    expect(props.onActivate).toHaveBeenCalledOnce()
  })
})
