import { vi, describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Route, Routes } from "react-router-dom"
import { renderWithProviders } from "@/test/utils"
import { ProgramCard } from "./ProgramCard"
import type { Program } from "@/types/onboarding"
import type { ProgramDayOutline, ProgramScore } from "@/lib/programScore/types"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

vi.mock("@/components/body-map/BodyMap", () => ({
  BodyMap: () => <div data-testid="program-card-body-map-model" />,
  BODY_MAP_INTENSITY_COLORS: [],
}))

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

function outlineDay(
  id: string,
  emoji: string,
  label: string,
  items: ProgramDayOutline["items"] = [],
): ProgramDayOutline {
  return { id, emoji, label, items }
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
    expect(screen.getByText(/Created on /)).toBeInTheDocument()
  })

  it("shows the dominant track and the fact line — not the 0–100 balance meter", () => {
    renderCard({ score: makeScore() })

    expect(screen.getByText("Test Program")).toBeInTheDocument()
    expect(screen.getByText("Built for")).toBeInTheDocument()
    expect(screen.getByText("Endurance")).toBeInTheDocument()
    expect(screen.queryByText("Muscle growth · On target")).not.toBeInTheDocument()
    expect(screen.queryByText("Balance")).not.toBeInTheDocument()
    expect(screen.queryByText("42")).not.toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    expect(screen.getByText("3 days · 24 sets · 1 circuits")).toBeInTheDocument()
    expect(screen.queryByText(/Push/)).not.toBeInTheDocument()
  })

  it("shows the week as day labels, not exercise names", () => {
    renderCard({
      score: makeScore(),
      days: [
        outlineDay("d1", "🔥", "Push"),
        outlineDay("d2", "💪", "Pull"),
        outlineDay("d3", "🦵", "Legs"),
      ],
    })

    expect(screen.getByRole("button", { name: "Exercises on Push" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Exercises on Pull" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Exercises on Legs" })).toBeInTheDocument()
    expect(screen.queryByText(/Bench/)).not.toBeInTheDocument()
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
    expect(screen.queryByText("Built for")).not.toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
  })

  it("shows skeleton chips while intent is loading — not Low", () => {
    renderCard({ intentLoading: true })

    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(
      0,
    )
    expect(screen.queryByText("Low")).not.toBeInTheDocument()
    expect(screen.queryByText("On target")).not.toBeInTheDocument()
  })

  it("uses the FR contract for focus and the fact line — not Équilibre on the card", () => {
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

    expect(screen.getByText("Fait pour")).toBeInTheDocument()
    expect(screen.getByText("Endurance")).toBeInTheDocument()
    expect(screen.getByText(/Créé le /)).toBeInTheDocument()
    expect(screen.queryByText(/Généré le /)).not.toBeInTheDocument()
    expect(screen.queryByText("Prise de masse · Dans le viseur")).not.toBeInTheDocument()
    expect(screen.queryByText("Équilibre")).not.toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    expect(screen.getByText("3 j · 24 séries · 1 circuits")).toBeInTheDocument()
  })

  it("opens the focus popover with a goal and a reason — not band names", async () => {
    renderCard({ score: makeScore() })
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Why this goal" }))

    expect(
      screen.getByText(
        "This program looks better for Endurance, because it has a Circuit, or enough high-rep sets with short rest.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText("On target")).not.toBeInTheDocument()
    expect(screen.queryByText("Low")).not.toBeInTheDocument()
    expect(
      screen.queryByText(
        "The strongest of muscle growth, strength, and endurance. The others sit below.",
      ),
    ).not.toBeInTheDocument()
  })

  it("FR focus popover says the goal and the reason — not Dans le viseur", async () => {
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
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Pourquoi cet objectif" }))

    expect(
      screen.getByText(
        "Ce programme paraît plus fait pour Endurance, parce que tu as un Circuit, ou assez de séries à reps hautes et repos court.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText("Dans le viseur")).not.toBeInTheDocument()
    expect(screen.queryByText("Faible")).not.toBeInTheDocument()
  })

  it("shows Active badge when active", () => {
    renderCard({ isActive: true })
    expect(screen.getByText("Active")).toBeInTheDocument()
  })

  it("keeps actions in the overflow menu — not as footer buttons", () => {
    renderCard()
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Activate" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument()
  })

  it("hides Activate and Archive in the menu when the program is active", async () => {
    renderCard({ isActive: true })
    await userEvent.setup().click(screen.getByRole("button", { name: "Open menu" }))

    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "Activate" })).not.toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "Archive" })).not.toBeInTheDocument()
  })

  it("shows Edit, Activate, and Archive in the menu for an inactive program", async () => {
    renderCard()
    await userEvent.setup().click(screen.getByRole("button", { name: "Open menu" }))

    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Activate" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Archive" })).toBeInTheDocument()
  })

  it("disables Activate in the menu when a session is active", async () => {
    renderCard({ isSessionActive: true })
    await userEvent.setup().click(screen.getByRole("button", { name: "Open menu" }))

    expect(screen.getByRole("menuitem", { name: "Activate" })).toHaveAttribute(
      "aria-disabled",
      "true",
    )
  })

  it("shows Unarchive in the menu for an archived program", async () => {
    renderCard({ program: { ...BASE_PROGRAM, archived_at: "2026-03-15T12:00:00Z" } })
    await userEvent.setup().click(screen.getByRole("button", { name: "Open menu" }))

    expect(screen.getByRole("menuitem", { name: "Unarchive" })).toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "Activate" })).not.toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument()
  })

  it("shows Archived badge for archived program", () => {
    renderCard({ program: { ...BASE_PROGRAM, archived_at: "2026-03-15T12:00:00Z" } })
    expect(screen.getByText("Archived")).toBeInTheDocument()
  })

  it("covers the whole card with the program link", async () => {
    const defaultProps = {
      program: BASE_PROGRAM,
      isActive: false,
      isSessionActive: false,
      onActivate: vi.fn(),
      onArchive: vi.fn(),
      onEdit: vi.fn(),
      score: makeScore(),
    }
    renderWithProviders(
      <Routes>
        <Route path="/" element={<ProgramCard {...defaultProps} />} />
        <Route path="/programs/:programId" element={<div>program page</div>} />
      </Routes>,
    )

    const cardLink = screen.getByRole("link", { name: "Test Program" })
    await userEvent.setup().click(cardLink)
    expect(screen.getByText("program page")).toBeInTheDocument()
  })

  it("does not navigate when the focus hint is opened", async () => {
    const defaultProps = {
      program: BASE_PROGRAM,
      isActive: false,
      isSessionActive: false,
      onActivate: vi.fn(),
      onArchive: vi.fn(),
      onEdit: vi.fn(),
      score: makeScore(),
    }
    renderWithProviders(
      <Routes>
        <Route path="/" element={<ProgramCard {...defaultProps} />} />
        <Route path="/programs/:programId" element={<div>program page</div>} />
      </Routes>,
    )

    await userEvent.setup().click(screen.getByRole("button", { name: "Why this goal" }))
    expect(
      screen.getByText(
        "This program looks better for Endurance, because it has a Circuit, or enough high-rep sets with short rest.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText("program page")).not.toBeInTheDocument()
  })

  it("opens a day peek with the week's exercises, without navigating", async () => {
    const defaultProps = {
      program: BASE_PROGRAM,
      isActive: false,
      isSessionActive: false,
      onActivate: vi.fn(),
      onArchive: vi.fn(),
      onEdit: vi.fn(),
      score: makeScore(),
      days: [
        outlineDay("d1", "🔥", "Push", [
          {
            kind: "solo",
            id: "we-1",
            emoji: "🏋️",
            name_snapshot: "Développé couché",
            exercise: { name: "Développé couché", name_en: "Bench Press" },
            sets: 3,
            reps: "8",
            sortOrder: 0,
          },
        ]),
      ],
    }
    renderWithProviders(
      <Routes>
        <Route path="/" element={<ProgramCard {...defaultProps} />} />
        <Route path="/programs/:programId" element={<div>program page</div>} />
      </Routes>,
    )

    await userEvent.setup().click(screen.getByRole("button", { name: "Exercises on Push" }))
    const peek = screen.getByRole("dialog")
    expect(peek).toHaveTextContent("Bench Press")
    expect(peek).toHaveTextContent("3 × 8")
    expect(screen.queryByText("program page")).not.toBeInTheDocument()
  })

  it("does not navigate when a day peek is dismissed onto the card", async () => {
    const defaultProps = {
      program: BASE_PROGRAM,
      isActive: false,
      isSessionActive: false,
      onActivate: vi.fn(),
      onArchive: vi.fn(),
      onEdit: vi.fn(),
      score: makeScore(),
      days: [
        outlineDay("d1", "🔥", "Push", [
          {
            kind: "solo",
            id: "we-1",
            emoji: "🏋️",
            name_snapshot: "Développé couché",
            exercise: { name: "Développé couché", name_en: "Bench Press" },
            sets: 3,
            reps: "8",
            sortOrder: 0,
          },
        ]),
      ],
    }
    renderWithProviders(
      <Routes>
        <Route path="/" element={<ProgramCard {...defaultProps} />} />
        <Route path="/programs/:programId" element={<div>program page</div>} />
      </Routes>,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Exercises on Push" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    await user.click(screen.getByRole("link", { name: "Test Program" }))
    expect(screen.queryByText("program page")).not.toBeInTheDocument()

    await user.click(screen.getByRole("link", { name: "Test Program" }))
    expect(screen.getByText("program page")).toBeInTheDocument()
  })

  it("does not navigate when a focus hint is dismissed onto the card", async () => {
    const defaultProps = {
      program: BASE_PROGRAM,
      isActive: false,
      isSessionActive: false,
      onActivate: vi.fn(),
      onArchive: vi.fn(),
      onEdit: vi.fn(),
      score: makeScore(),
    }
    renderWithProviders(
      <Routes>
        <Route path="/" element={<ProgramCard {...defaultProps} />} />
        <Route path="/programs/:programId" element={<div>program page</div>} />
      </Routes>,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Why this goal" }))
    expect(
      screen.getByText(
        "This program looks better for Endurance, because it has a Circuit, or enough high-rep sets with short rest.",
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("link", { name: "Test Program" }))
    expect(screen.queryByText("program page")).not.toBeInTheDocument()

    await user.click(screen.getByRole("link", { name: "Test Program" }))
    expect(screen.getByText("program page")).toBeInTheDocument()
  })

  it("navigates on the next card click after a peek is dismissed with Escape", async () => {
    const defaultProps = {
      program: BASE_PROGRAM,
      isActive: false,
      isSessionActive: false,
      onActivate: vi.fn(),
      onArchive: vi.fn(),
      onEdit: vi.fn(),
      score: makeScore(),
      days: [
        outlineDay("d1", "🔥", "Push", [
          {
            kind: "solo",
            id: "we-1",
            emoji: "🏋️",
            name_snapshot: "Développé couché",
            exercise: { name: "Développé couché", name_en: "Bench Press" },
            sets: 3,
            reps: "8",
            sortOrder: 0,
          },
        ]),
      ],
    }
    renderWithProviders(
      <Routes>
        <Route path="/" element={<ProgramCard {...defaultProps} />} />
        <Route path="/programs/:programId" element={<div>program page</div>} />
      </Routes>,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Exercises on Push" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await user.click(screen.getByRole("link", { name: "Test Program" }))
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

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Open menu" }))
    await user.click(screen.getByRole("menuitem", { name: "Activate" }))
    expect(onActivate).toHaveBeenCalledOnce()
    expect(screen.queryByText("program page")).not.toBeInTheDocument()
  })

  it("does not navigate when the overflow menu is opened", async () => {
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

    await userEvent.setup().click(screen.getByRole("button", { name: "Open menu" }))
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument()
    expect(screen.queryByText("program page")).not.toBeInTheDocument()
  })
})
