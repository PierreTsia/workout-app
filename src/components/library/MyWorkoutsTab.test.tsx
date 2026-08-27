import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Route, Routes } from "react-router-dom"
import { mockQueryResult, renderWithProviders } from "@/test/utils"
import { defaultSessionState, sessionAtom } from "@/store/atoms"
import type { Program } from "@/types/onboarding"
import type { ProgramDayOutline, ProgramScore } from "@/lib/programScore/types"
import { MyWorkoutsTab } from "./MyWorkoutsTab"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

vi.mock("@/components/body-map/BodyMap", () => ({
  BodyMap: () => null,
  BODY_MAP_INTENSITY_COLORS: [],
}))

const mockUseUserPrograms = vi.fn()
vi.mock("@/hooks/useUserPrograms", () => ({
  useUserPrograms: () => mockUseUserPrograms(),
}))

const mockUseProgramsIntent = vi.fn()
vi.mock("@/hooks/useProgramsIntent", () => ({
  useProgramsIntent: () => mockUseProgramsIntent(),
}))

vi.mock("@/hooks/useActivateProgram", () => ({
  useActivateProgram: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock("@/hooks/useArchiveProgram", () => ({
  useArchiveProgram: () => ({ mutate: vi.fn(), isPending: false }),
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

function makeProgram(overrides: Partial<Program> = {}): Program {
  return {
    id: "p-1",
    user_id: "u-1",
    name: "PPL",
    template_id: null,
    is_active: false,
    archived_at: null,
    created_at: "2026-08-26T10:00:00Z",
    ...overrides,
  }
}

describe("MyWorkoutsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseUserPrograms.mockReturnValue(mockQueryResult<Program[]>([]))
    mockUseProgramsIntent.mockReturnValue({ data: undefined, isLoading: false })
  })

  it("says there are no programs yet", () => {
    renderWithProviders(<MyWorkoutsTab />)

    expect(screen.getByText("No programs yet")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "PPL" })).not.toBeInTheDocument()
  })

  it("lists the active program first, even when it arrives later in the payload", () => {
    mockUseUserPrograms.mockReturnValue(
      mockQueryResult([
        makeProgram({ id: "ppl", name: "PPL", is_active: false }),
        makeProgram({ id: "manuel", name: "Test Manuel", is_active: true }),
        makeProgram({ id: "machines", name: "Machine Hypertrophy", is_active: false }),
      ]),
    )

    renderWithProviders(<MyWorkoutsTab />)

    const programLinks = screen.getAllByRole("link").filter((link) =>
      (link.getAttribute("href") ?? "").startsWith("/programs/"),
    )
    expect(programLinks.map((link) => link.getAttribute("aria-label"))).toEqual([
      "Test Manuel",
      "PPL",
      "Machine Hypertrophy",
    ])
    expect(screen.queryByText("No programs yet")).not.toBeInTheDocument()
  })

  it("hides archived programs until Show archived is on", async () => {
    mockUseUserPrograms.mockReturnValue(
      mockQueryResult([
        makeProgram({ id: "live", name: "Live", is_active: true }),
        makeProgram({
          id: "old",
          name: "Old PPL",
          is_active: false,
          archived_at: "2026-01-01T00:00:00Z",
        }),
      ]),
    )
    const user = userEvent.setup()
    renderWithProviders(<MyWorkoutsTab />)

    expect(screen.getByRole("link", { name: "Live" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Old PPL" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("switch", { name: "Show archived" }))
    expect(screen.getByRole("link", { name: "Old PPL" })).toBeInTheDocument()
  })

  it("offers New program", () => {
    renderWithProviders(<MyWorkoutsTab />)

    expect(screen.getByRole("button", { name: "New program" })).toBeEnabled()
  })

  it("opens New program on the create flow", async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route path="/" element={<MyWorkoutsTab />} />
        <Route path="/create-program" element={<div>create page</div>} />
      </Routes>,
    )

    await user.click(screen.getByRole("button", { name: "New program" }))
    expect(screen.getByText("create page")).toBeInTheDocument()
  })

  it("blocks New program while a session is running", () => {
    const { store } = renderWithProviders(<MyWorkoutsTab />)
    act(() => {
      store.set(sessionAtom, { ...defaultSessionState, isActive: true })
    })

    expect(screen.getByRole("button", { name: "New program" })).toBeDisabled()
    expect(screen.getByText("Finish your current workout first")).toBeInTheDocument()
  })

  it("opens a day peek with a Circuit from the week's intent", async () => {
    mockUseUserPrograms.mockReturnValue(
      mockQueryResult([makeProgram({ id: "ppl", name: "PPL", is_active: true })]),
    )
    const days: ProgramDayOutline[] = [
      {
        id: "d1",
        emoji: "🔥",
        label: "Push",
        items: [
          {
            kind: "circuit",
            id: "blk-1",
            label: "Cindy",
            rounds: 0,
            exerciseCount: 5,
            sortOrder: 0,
          },
        ],
      },
    ]
    mockUseProgramsIntent.mockReturnValue({
      isLoading: false,
      data: {
        ppl: { score: makeScore(), bodyMap: [], days },
      },
    })
    const user = userEvent.setup()
    renderWithProviders(<MyWorkoutsTab />)

    await user.click(screen.getByRole("button", { name: "Exercises on Push" }))
    const peek = screen.getByRole("dialog")
    expect(peek).toHaveTextContent("Cindy")
    expect(peek).toHaveTextContent("5 exercises · 0 rounds")
  })
})
