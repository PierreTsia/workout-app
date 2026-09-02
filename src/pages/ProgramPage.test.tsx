import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Route, Routes, useLocation, useParams } from "react-router-dom"
import { mockQueryResult, renderWithProviders } from "@/test/utils"
import type { ProgramScore } from "@/lib/programScore/types"
import type { Program } from "@/types/onboarding"
import type { ProgramDayCard } from "@/hooks/useProgramDayCards"
import { defaultSessionState, sessionAtom } from "@/store/atoms"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

const mockUseProgram = vi.fn()
const mockUseProgramIntent = vi.fn()
const mockUseProgramDayCards = vi.fn()
const mockOnline = vi.hoisted(() => vi.fn(() => true))
const mockActivateMutate = vi.hoisted(() => vi.fn())
const mockArchiveMutate = vi.hoisted(() => vi.fn())

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

vi.mock("@/hooks/useActivateProgram", () => ({
  useActivateProgram: () => ({ mutate: mockActivateMutate, isPending: false }),
}))

vi.mock("@/hooks/useArchiveProgram", () => ({
  useArchiveProgram: () => ({ mutate: mockArchiveMutate, isPending: false }),
}))

import { readBuilderLocationState } from "@/lib/builderLocationState"
import { ProgramPage } from "./ProgramPage"

const VALID_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

function BuilderLanding() {
  const { programId } = useParams()
  const { dayId } = readBuilderLocationState(useLocation().state)
  return (
    <div>{`builder:${programId}:${dayId ?? "list"}`}</div>
  )
}

function renderAt(path: string, locale: "en" | "fr" = "en") {
  return renderWithProviders(
    <Routes>
      <Route path="/programs/:programId" element={<ProgramPage />} />
      <Route path="/builder/:programId" element={<BuilderLanding />} />
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

function makeDayCard(overrides: Partial<ProgramDayCard> = {}): ProgramDayCard {
  return {
    id: "day-1",
    emoji: "🔥",
    name: "Push",
    label: "🔥 Push",
    exerciseCount: 2,
    items: [
      {
        kind: "solo",
        id: "we-1",
        emoji: "🏋️",
        name: "Bench Press",
        sets: 3,
        reps: "8",
        restSeconds: 90,
        sortOrder: 0,
        exerciseId: "ex-bench",
      },
      {
        kind: "circuit",
        id: "blk-1",
        label: "Cindy",
        rounds: 3,
        exerciseCount: 1,
        sortOrder: 1,
        stations: [
          {
            id: "be-1",
            name: "Pull-ups",
            emoji: "🏋️",
            amounts: [5],
            isDuration: false,
            exerciseId: "ex-pull",
          },
        ],
      },
    ],
    ...overrides,
  }
}

function seedLoadedPage(
  program: Program = makeProgram(),
  days: ProgramDayCard[] = [makeDayCard()],
) {
  mockUseProgram.mockReturnValue(mockQueryResult(program))
  mockUseProgramIntent.mockReturnValue(mockQueryResult(scoredWeek()))
  mockUseProgramDayCards.mockReturnValue(mockQueryResult(days))
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

  it("shows not-found for a junk id and does not fabricate Moderate bands", () => {
    renderAt("/programs/not-a-uuid")

    expect(screen.getByText("This program isn’t here.")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Back to programs" }),
    ).toHaveAttribute("href", "/library/programs")
    expect(screen.queryByText("Moderate")).not.toBeInTheDocument()
  })

  it("shows a loading status while the program query is pending, not not-found", () => {
    mockUseProgram.mockReturnValue({
      ...mockQueryResult(undefined),
      isPending: true,
      isLoading: false,
      isSuccess: false,
      isFetched: false,
      status: "pending",
    })
    mockUseProgramIntent.mockReturnValue({
      ...mockQueryResult(undefined),
      isPending: true,
      isLoading: false,
      isSuccess: false,
      status: "pending",
    })
    mockUseProgramDayCards.mockReturnValue({
      ...mockQueryResult(undefined),
      isPending: true,
      isLoading: false,
      isSuccess: false,
      status: "pending",
    })

    renderAt(`/programs/${VALID_ID}`)

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument()
    expect(screen.queryByText("This program isn’t here.")).not.toBeInTheDocument()
  })

  it("keeps loading while a cached not-found is still refetching", () => {
    mockUseProgram.mockReturnValue({
      ...missingProgram(),
      isFetching: true,
    })

    renderAt(`/programs/${VALID_ID}`)

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument()
    expect(screen.queryByText("This program isn’t here.")).not.toBeInTheDocument()
  })

  it("shows a loading status until scores and days settle, not an empty week", () => {
    mockUseProgram.mockReturnValue(mockQueryResult(makeProgram()))
    mockUseProgramIntent.mockReturnValue({
      ...mockQueryResult(undefined),
      isPending: true,
      isLoading: false,
      isSuccess: false,
      status: "pending",
    })
    mockUseProgramDayCards.mockReturnValue({
      ...mockQueryResult(undefined),
      isPending: true,
      isLoading: false,
      isSuccess: false,
      status: "pending",
    })

    renderAt(`/programs/${VALID_ID}`)

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument()
    expect(
      screen.queryByText("Add a day to see what this program is for."),
    ).not.toBeInTheDocument()
  })

  it("shows not-found for a missing program and does not fabricate Moderate bands", () => {
    mockUseProgram.mockReturnValue(missingProgram())
    mockUseProgramIntent.mockReturnValue(mockQueryResult(undefined))

    renderAt(`/programs/${VALID_ID}`)

    expect(screen.getByText("This program isn’t here.")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Back to programs" }),
    ).toHaveAttribute("href", "/library/programs")
    expect(screen.queryByText("Moderate")).not.toBeInTheDocument()
  })

  it("shows empty.scores for a week with no items and does not show Low", () => {
    mockUseProgram.mockReturnValue(mockQueryResult(makeProgram()))
    mockUseProgramIntent.mockReturnValue(mockQueryResult(emptyScore()))

    renderAt(`/programs/${VALID_ID}`)

    expect(screen.getByText("Add a day to see what this program is for.")).toBeInTheDocument()
    expect(screen.queryByText("Low")).not.toBeInTheDocument()
    expect(screen.queryByText("Moderate")).not.toBeInTheDocument()
  })

  it("renders scores, facts, and day summaries for the owner, without Start", async () => {
    seedLoadedPage()
    const user = userEvent.setup()
    renderAt(`/programs/${VALID_ID}`)

    expect(screen.getByRole("heading", { name: "PPL" })).toBeInTheDocument()
    expect(screen.getByText("Program")).toBeInTheDocument()
    expect(screen.getByText("Active")).toBeInTheDocument()
    await user.click(screen.getAllByRole("button", { name: "Why this goal" })[0])
    expect(
      screen.getByText(
        "Moderate: most muscles you programmed hit 8–20 sets and 2–3 days this week.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("Balance")).toBeInTheDocument()
    expect(screen.getByText("Moderate")).toBeInTheDocument()
    expect(screen.getByText("Low")).toBeInTheDocument()
    expect(screen.getByText("High")).toBeInTheDocument()
    expect(screen.getByText("42")).toBeInTheDocument()
    expect(screen.getByText("Days")).toBeInTheDocument()
    expect(screen.getByText("24")).toBeInTheDocument()
    expect(screen.getByText("Sets")).toBeInTheDocument()
    expect(screen.getByText(/Free weights/)).toBeInTheDocument()
    expect(screen.queryByText(/Bench Press/)).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Push/ }))
    expect(screen.getByText(/Bench Press/)).toBeInTheDocument()
    expect(screen.getByText("Cindy")).toBeInTheDocument()
    expect(screen.getByText("Pull-ups")).toBeInTheDocument()
    expect(screen.getByText("5 reps")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Cindy/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      `/builder/${VALID_ID}`,
    )
    expect(screen.queryByRole("button", { name: /start/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /start/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Open menu" })).not.toBeInTheDocument()
  })

  it("uses the FR contract on the character sheet — not Dans le viseur", async () => {
    seedLoadedPage()
    const user = userEvent.setup()
    renderAt(`/programs/${VALID_ID}`, "fr")

    expect(screen.getByText("Programme")).toBeInTheDocument()
    expect(screen.getByText("Actif")).toBeInTheDocument()
    expect(screen.getByText("Prise de masse")).toBeInTheDocument()
    expect(screen.getByText("Force")).toBeInTheDocument()
    expect(screen.getByText("Endurance")).toBeInTheDocument()
    expect(screen.getByText("Équilibre")).toBeInTheDocument()
    expect(screen.getByText("Faible")).toBeInTheDocument()
    expect(screen.getByText("Modéré")).toBeInTheDocument()
    expect(screen.getByText("Élevé")).toBeInTheDocument()
    expect(screen.getByText("Jour 1")).toBeInTheDocument()
    expect(screen.queryByText(/Dans le viseur/)).not.toBeInTheDocument()
    expect(screen.queryByText(/On target/)).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Éditer" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Push/ }))
    expect(screen.getByText("5 reps")).toBeInTheDocument()
  })

  it("keeps activate and archive in the header menu, not a button row", async () => {
    seedLoadedPage(makeProgram({ is_active: false }), [])
    const user = userEvent.setup()
    renderAt(`/programs/${VALID_ID}`)

    expect(screen.queryByRole("button", { name: "Activate" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Open menu" }))
    expect(screen.getByRole("menuitem", { name: "Activate" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Archive" })).toBeInTheDocument()
  })

  it("opens the switch-program confirm from Activate, and disables it during a session", async () => {
    seedLoadedPage(makeProgram({ is_active: false }), [])
    const user = userEvent.setup()
    const { store } = renderAt(`/programs/${VALID_ID}`)

    await user.click(screen.getByRole("button", { name: "Open menu" }))
    await user.click(screen.getByRole("menuitem", { name: "Activate" }))
    expect(screen.getByText("Switch program?")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Your current program will be deactivated. Workout history stays intact.",
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Cancel" }))
    act(() => {
      store.set(sessionAtom, { ...defaultSessionState, isActive: true })
    })
    await user.click(screen.getByRole("button", { name: "Open menu" }))
    expect(screen.getByRole("menuitem", { name: "Activate" })).toHaveAttribute(
      "aria-disabled",
      "true",
    )
  })

  it("keeps Unarchive in the menu on an archived program and hides Edit", async () => {
    seedLoadedPage(
      makeProgram({
        is_active: false,
        archived_at: "2026-08-01T00:00:00Z",
      }),
    )
    const user = userEvent.setup()
    renderAt(`/programs/${VALID_ID}`)

    expect(screen.getByText("Archived")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Edit Push" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Open menu" }))
    expect(screen.getByRole("menuitem", { name: "Unarchive" })).toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "Activate" })).not.toBeInTheDocument()
  })

  it("opens that day's Builder editor from a day card", async () => {
    seedLoadedPage()
    const user = userEvent.setup()
    renderAt(`/programs/${VALID_ID}`)

    await user.click(screen.getByRole("link", { name: "Edit Push" }))
    expect(screen.getByText(`builder:${VALID_ID}:day-1`)).toBeInTheDocument()
  })

  it("opens the Builder day list from the header Edit", async () => {
    seedLoadedPage(makeProgram(), [])
    const user = userEvent.setup()
    renderAt(`/programs/${VALID_ID}`)

    await user.click(screen.getByRole("link", { name: "Edit" }))
    expect(screen.getByText(`builder:${VALID_ID}:list`)).toBeInTheDocument()
  })

  it("shows loadError and no Moderate when the program query fails", () => {
    mockUseProgram.mockReturnValue({
      ...mockQueryResult(undefined),
      isError: true,
      isSuccess: false,
      status: "error" as const,
      error: { message: "network" },
    })

    renderAt(`/programs/${VALID_ID}`)

    expect(screen.getByText("We couldn’t load this program.")).toBeInTheDocument()
    expect(screen.queryByText("Moderate")).not.toBeInTheDocument()
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
    expect(screen.queryByText("Moderate")).not.toBeInTheDocument()
    expect(screen.queryByText("Low")).not.toBeInTheDocument()
  })

  it("shows loadError when days fail after the program is in", () => {
    mockUseProgram.mockReturnValue(mockQueryResult(makeProgram()))
    mockUseProgramIntent.mockReturnValue(mockQueryResult(scoredWeek()))
    mockUseProgramDayCards.mockReturnValue({
      ...mockQueryResult(undefined),
      isError: true,
      isSuccess: false,
      status: "error" as const,
    })

    renderAt(`/programs/${VALID_ID}`)

    expect(screen.getByText("We couldn’t load this program.")).toBeInTheDocument()
    expect(screen.queryByText("Moderate")).not.toBeInTheDocument()
  })
})
