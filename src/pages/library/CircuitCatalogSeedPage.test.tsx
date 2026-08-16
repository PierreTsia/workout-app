import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Route, Routes } from "react-router-dom"
import { renderWithProviders } from "@/test/utils"
import type { CatalogSeedRow } from "@/lib/previewCatalogCircuit"
import type { Exercise } from "@/types/database"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

import { CircuitCatalogSeedPage } from "./CircuitCatalogSeedPage"

const PULL_ID = "11111111-1111-4111-8111-111111111111"
const PUSH_ID = "22222222-2222-4222-8222-222222222222"
const SQUAT_ID = "33333333-3333-4333-8333-333333333333"

function makeCindySeed(overrides: Partial<CatalogSeedRow> = {}): CatalogSeedRow {
  return {
    id: "cindy-id",
    slug: "cindy",
    label: "Cindy",
    aliases: ["holland"],
    rx: {
      mode: "amrap",
      cap_seconds: 1200,
      exercises: [
        { exercise_id: PULL_ID, amount: 5, weight: 0 },
        { exercise_id: PUSH_ID, amount: 10, weight: 0 },
        { exercise_id: SQUAT_ID, amount: 15, weight: 0 },
      ],
    },
    tagline_fr: "Le WOD de Tom Holland. 20 min.",
    tagline_en: "Tom Holland’s WOD. 20 min.",
    story_fr:
      "Cinq tractions, dix pompes, quinze squats. Autant de tours que possible.",
    story_en:
      "Five pull-ups, ten push-ups, fifteen squats. As many rounds as possible.",
    reference: { name: "Tom Holland", score: "27" },
    ...overrides,
  }
}

function makeExercise(
  id: string,
  name: string,
  name_en: string,
): Exercise {
  return {
    id,
    name,
    name_en,
    muscle_group: "full_body",
    emoji: "🏋️",
    is_system: true,
    created_at: "2025-01-01T00:00:00Z",
    youtube_url: null,
    instructions: null,
    image_url: null,
    equipment: "bodyweight",
    difficulty_level: null,
    source: null,
    secondary_muscles: null,
    reviewed_at: null,
    reviewed_by: null,
  }
}

const mockUseBenchmarkSeed = vi.fn()
const mockUseExerciseBatch = vi.fn()
const mockUseBenchmarkCompletionHistory = vi.fn()
const mockUseOnlineStatus = vi.fn(() => true)

vi.mock("@/hooks/useBenchmarkSeed", () => ({
  useBenchmarkSeed: (slug: string | undefined) => mockUseBenchmarkSeed(slug),
}))

vi.mock("@/hooks/useExerciseBatch", () => ({
  useExerciseBatch: (ids: readonly string[]) => mockUseExerciseBatch(ids),
}))

vi.mock("@/hooks/useBenchmarkCompletionHistory", () => ({
  useBenchmarkCompletionHistory: (open: boolean, catalogId: string | undefined) =>
    mockUseBenchmarkCompletionHistory(open, catalogId),
}))

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}))

function renderAt(path: string, locale: "en" | "fr" = "en") {
  return renderWithProviders(
    <Routes>
      <Route path="/library/circuits/:slug" element={<CircuitCatalogSeedPage />} />
    </Routes>,
    { initialEntries: [path], locale },
  )
}

describe("CircuitCatalogSeedPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseBenchmarkSeed.mockReturnValue({
      data: makeCindySeed(),
      isLoading: false,
      isError: false,
    })
    mockUseExerciseBatch.mockReturnValue({
      data: [
        makeExercise(PULL_ID, "Tractions", "Pull-ups"),
        makeExercise(PUSH_ID, "Pompes", "Push-ups"),
        makeExercise(SQUAT_ID, "Squats", "Air squats"),
      ],
      isLoading: false,
    })
    mockUseOnlineStatus.mockReturnValue(true)
    mockUseBenchmarkCompletionHistory.mockReturnValue({
      data: { copy: null, amrapViews: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
  })

  it("shows the seed label, Holland story, and catalog Rx stations", () => {
    renderAt("/library/circuits/cindy")

    expect(mockUseBenchmarkSeed).toHaveBeenCalledWith("cindy")
    expect(screen.getByRole("heading", { name: "Cindy" })).toBeInTheDocument()
    expect(screen.getByText("Tom Holland’s WOD. 20 min.")).toBeInTheDocument()
    expect(
      screen.getByText(/Five pull-ups, ten push-ups, fifteen squats/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Tom Holland — 27 rounds/)).toBeInTheDocument()

    const stations = screen.getAllByRole("listitem")
    expect(stations).toHaveLength(3)
    expect(stations[0]).toHaveTextContent("5")
    expect(stations[0]).toHaveTextContent("Pull-ups")
    expect(stations[1]).toHaveTextContent("10")
    expect(stations[1]).toHaveTextContent("Push-ups")
    expect(stations[2]).toHaveTextContent("15")
    expect(stations[2]).toHaveTextContent("Air squats")
  })

  it("shows not-found with a back link when the slug is unknown", () => {
    mockUseBenchmarkSeed.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    })

    renderAt("/library/circuits/not-a-seed")

    expect(screen.getByText("Circuit not found.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /back to circuits/i })).toHaveAttribute(
      "href",
      "/library/circuits",
    )
    expect(screen.queryByRole("heading", { name: "Cindy" })).not.toBeInTheDocument()
  })

  it("shows not-found when the slug is empty", () => {
    mockUseBenchmarkSeed.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    })

    renderWithProviders(<CircuitCatalogSeedPage />, {
      initialEntries: ["/library/circuits/"],
    })

    expect(mockUseBenchmarkSeed).toHaveBeenCalledWith("")
    expect(screen.getByText("Circuit not found.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /back to circuits/i })).toHaveAttribute(
      "href",
      "/library/circuits",
    )
  })

  it("shows noPrYet on a first visit while the story stays visible", () => {
    renderAt("/library/circuits/cindy")

    expect(mockUseBenchmarkCompletionHistory).toHaveBeenCalledWith(true, "cindy-id")
    expect(screen.getByText("No PR yet")).toBeInTheDocument()
    expect(screen.queryByText(/No completed runs yet/)).not.toBeInTheDocument()
    expect(screen.getByText("Tom Holland’s WOD. 20 min.")).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("renders catalog-keyed AMRAP scores with the shared run row", () => {
    mockUseBenchmarkCompletionHistory.mockReturnValue({
      data: {
        copy: null,
        amrapViews: [
          {
            sessionId: "s2",
            date: "2026-08-15T10:00:00.000Z",
            fingerprint: "amrap|1200|ex-1:5:0",
            isComplete: true,
            score: { fullRounds: 27, leftover: 3, leftoverName: "push-ups" },
            deltaRounds: 2,
            isPb: true,
            shapeChanged: false,
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })

    renderAt("/library/circuits/cindy")

    expect(screen.getByText("27+3")).toBeInTheDocument()
    expect(screen.getByText("PB")).toBeInTheDocument()
    expect(screen.getByText(/2 rounds/)).toBeInTheDocument()
    expect(screen.queryByText("No PR yet")).not.toBeInTheDocument()
    expect(screen.queryByText("Circuit times")).not.toBeInTheDocument()
  })

  it("opens station instructions in a sheet without leaving the encyclopedia", async () => {
    mockUseExerciseBatch.mockReturnValue({
      data: [
        {
          ...makeExercise(PULL_ID, "Tractions", "Pull-ups"),
          instructions: {
            setup: ["Suspends-toi à la barre"],
            movement: ["Tire"],
            breathing: ["Expire"],
            common_mistakes: ["Kipping"],
          },
          instructions_en: {
            setup: ["Hang from the bar"],
            movement: ["Pull"],
            breathing: ["Exhale"],
            common_mistakes: ["Kipping"],
          },
          instructions_en_status: "clean",
        },
        makeExercise(PUSH_ID, "Pompes", "Push-ups"),
        makeExercise(SQUAT_ID, "Squats", "Air squats"),
      ],
      isLoading: false,
    })

    renderAt("/library/circuits/cindy")
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Instructions: Pull-ups" }))

    expect(screen.getByRole("dialog", { name: /Pull-ups/ })).toBeInTheDocument()
    expect(screen.getByText("Hang from the bar")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Cindy", hidden: true }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.getByRole("heading", { name: "Cindy" })).toBeInTheDocument()
    expect(screen.queryByText("Hang from the bar")).not.toBeInTheDocument()
  })

  it("shows the circuit offline string instead of a fake PB", () => {
    mockUseOnlineStatus.mockReturnValue(false)

    renderAt("/library/circuits/cindy")

    expect(
      screen.getByText("Connect to the internet to see your circuit times."),
    ).toBeInTheDocument()
    expect(screen.queryByText("No PR yet")).not.toBeInTheDocument()
    expect(screen.queryByText("PB")).not.toBeInTheDocument()
    expect(screen.getByText("Tom Holland’s WOD. 20 min.")).toBeInTheDocument()
  })
})
