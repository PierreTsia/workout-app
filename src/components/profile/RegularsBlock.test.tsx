import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { ProfileWindowProvider } from "@/components/profile/ProfileWindowContext"
import { RegularsBlock, type RegularsFixtureMode } from "./RegularsBlock"
import type { ProfileWindowKind } from "@/lib/profile/window"
import { addIsoDays, isoDayInTimeZone } from "@/lib/profile/windowRange"
import { authAtom } from "@/store/atoms"

const mockRpc = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

vi.mock("@/lib/trainingActivityTimezone", () => ({
  getResolvedIANATimeZone: () => "UTC",
}))

function renderRegulars(
  mode: RegularsFixtureMode,
  kind: ProfileWindowKind = "100",
) {
  return renderWithProviders(
    <ProfileWindowProvider kind={kind} setKind={() => undefined}>
      <RegularsBlock mode={mode} />
    </ProfileWindowProvider>,
  )
}

function regularsCard(): HTMLElement {
  const heading = screen.getByRole("heading", { name: "Regulars" })
  const card = heading.closest(".bg-card")
  if (!(card instanceof HTMLElement)) throw new Error("expected Regulars card")
  return card
}

function sessionFact(
  id: string,
  finishedAt: string,
  hasCatalogCircuit = false,
) {
  return {
    id,
    started_at: finishedAt,
    finished_at: finishedAt,
    active_duration_ms: 40 * 60_000,
    program_id: null,
    has_catalog_circuit: hasCatalogCircuit,
  }
}

function setFact(
  sessionId: string,
  exerciseId: string,
  reps: string,
  blockExerciseId: string | null = null,
  weightLogged = 0,
) {
  return {
    session_id: sessionId,
    exercise_id: exerciseId,
    was_pr: false,
    rir: null,
    weight_logged: weightLogged,
    reps,
    duration_seconds: null,
    block_exercise_id: blockExerciseId,
  }
}

function liveSnapshot() {
  const today = isoDayInTimeZone(new Date(), "UTC")
  return {
    sessions: [
      sessionFact("week-a", `${addIsoDays(today, -3)}T11:00:00.000Z`),
      sessionFact("week-b", `${addIsoDays(today, -1)}T11:00:00.000Z`),
      sessionFact("old-a", `${addIsoDays(today, -90)}T11:00:00.000Z`),
      sessionFact("old-b", `${addIsoDays(today, -88)}T11:00:00.000Z`),
    ],
    sets: [
      setFact("week-a", "Trap bar", "16", null, 80),
      setFact("week-b", "Trap bar", "17", null, 82),
      setFact("old-a", "Ring row", "388"),
      setFact("old-b", "Ring row", "389"),
      setFact("old-a", "cindy-pull", "5", "station-pull"),
      setFact("old-b", "cindy-pull", "6", "station-pull"),
    ],
  }
}

describe("RegularsBlock", () => {
  beforeEach(() => {
    mockRpc.mockReset()
    mockRpc.mockResolvedValue({ data: { sessions: [], sets: [] }, error: null })
  })

  it("shows name and window evolution, not program pills", () => {
    renderRegulars("pierre")

    expect(screen.getByText("Squat")).toBeInTheDocument()
    expect(screen.getByText("Squat").className).toMatch(/truncate/)
    expect(screen.getByText("Squat").className).toMatch(/min-w-0/)
    expect(screen.getAllByText("+2 kg").length).toBeGreaterThan(0)
    expect(screen.queryByText("On program")).not.toBeInTheDocument()
    expect(screen.queryByText("Off program")).not.toBeInTheDocument()
    expect(
      screen.getAllByRole("button", {
        name: "+2 kg vs the first log in this window",
      }).length,
    ).toBeGreaterThan(0)
  })

  it("keeps the evolution explanation open after a tap", async () => {
    const user = userEvent.setup()
    renderRegulars("pierre", "7")

    const [trigger] = screen.getAllByRole("button", {
      name: "+2 kg vs the first log in this window",
    })
    if (trigger == null) throw new Error("expected a Regulars evolution mark")
    await user.click(trigger)
    const tip = await screen.findByText("+2 kg vs the first log in this window")
    expect(tip).toBeVisible()

    await user.click(screen.getByRole("heading", { name: "Regulars" }))
    expect(
      screen.queryByText("+2 kg vs the first log in this window"),
    ).not.toBeInTheDocument()
  })

  it("labels weight and reps marks against the first log in the window", () => {
    renderRegulars("pierre", "100")

    const card = regularsCard()
    expect(
      within(card).getAllByRole("button", {
        name: "+2 kg vs the first log in this window",
      }).length,
    ).toBeGreaterThan(0)
    expect(
      within(card).getByRole("button", {
        name: "+2.5 kg vs the first log in this window",
      }),
    ).toBeInTheDocument()
    expect(
      within(card).getByRole("button", {
        name: "−2 kg vs the first log in this window",
      }),
    ).toBeInTheDocument()
    expect(
      within(card).getAllByRole("button", {
        name: "+2 reps vs the first log in this window",
      }).length,
    ).toBeGreaterThan(0)
  })

  it("shows empty copy when there are not enough logs", () => {
    renderRegulars("empty")

    expect(
      screen.getByText("Not enough logs in this period."),
    ).toBeInTheDocument()
    expect(screen.queryByText("Squat")).not.toBeInTheDocument()
    expect(screen.queryByText("+2 kg")).not.toBeInTheDocument()
  })

  it("ranks 100d by rep count with Pull-up on top", () => {
    renderRegulars("pierre", "100")

    const card = regularsCard()
    const items = within(card).getAllByRole("listitem")
    expect(items).toHaveLength(8)
    expect(within(items[0]).getByText("Pull-up")).toBeInTheDocument()
    expect(within(items[0]).getByText("400")).toBeInTheDocument()
    expect(within(items[items.length - 1]).getByText("Walking lunge")).toBeInTheDocument()
    expect(within(card).getByText("Most logged · Last 100 days")).toBeInTheDocument()
  })

  it("follows the window: 7d is a shorter list with Squat on top", () => {
    renderRegulars("pierre", "7")

    const card = regularsCard()
    const items = within(card).getAllByRole("listitem")
    expect(items).toHaveLength(5)
    expect(within(items[0]).getByText("Squat")).toBeInTheDocument()
    expect(within(items[0]).getByText("48")).toBeInTheDocument()
    expect(within(card).getByText("Most logged · Last 7 days")).toBeInTheDocument()
    expect(screen.queryByText("Walking lunge")).not.toBeInTheDocument()
    expect(screen.queryByText("400")).not.toBeInTheDocument()
  })

  it("ranks the live 7d window from the snapshot, not the Pierre fixture", async () => {
    mockRpc.mockResolvedValue({ data: liveSnapshot(), error: null })
    const { store } = renderRegulars("pierre", "7")
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => {
      expect(screen.getByText("Trap bar")).toBeInTheDocument()
    })
    const card = regularsCard()
    const items = within(card).getAllByRole("listitem")
    expect(items).toHaveLength(1)
    expect(within(items[0]).getByText("33")).toBeInTheDocument()
    expect(within(items[0]).getByText("+2 kg")).toBeInTheDocument()
    expect(items[0].className).toMatch(/auto_4\.5rem/)
    expect(within(card).getByText("Most logged · Last 7 days")).toBeInTheDocument()
    expect(screen.queryByText("Squat")).not.toBeInTheDocument()
    expect(screen.queryByText("Ring row")).not.toBeInTheDocument()
    expect(screen.queryByText("On program")).not.toBeInTheDocument()
  })

  it("changes the live list and the lead count when the window is 100d", async () => {
    mockRpc.mockResolvedValue({ data: liveSnapshot(), error: null })
    const { store } = renderRegulars("pierre", "100")
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => {
      expect(screen.getByText("Ring row")).toBeInTheDocument()
    })
    const card = regularsCard()
    const items = within(card).getAllByRole("listitem")
    expect(items).toHaveLength(3)
    expect(within(items[0]).getByText("Ring row")).toBeInTheDocument()
    expect(within(items[0]).getByText("777")).toBeInTheDocument()
    expect(within(items[0]).getByText("+1")).toBeInTheDocument()
    expect(within(card).getByText("cindy-pull")).toBeInTheDocument()
    expect(within(card).getByText("Trap bar")).toBeInTheDocument()
    expect(within(card).getByText("Most logged · Last 100 days")).toBeInTheDocument()
    expect(screen.queryByText("Pull-up")).not.toBeInTheDocument()
    expect(screen.queryByText("400")).not.toBeInTheDocument()
  })

  it("does not invent a 100d Regulars list on Toujours", async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === "get_profile_all_time_rollups") {
        return Promise.resolve({
          data: {
            years: [
              {
                year: 2024,
                mix: { programme: 1, quickWorkout: 0, circuits: 0 },
                tonnage_kg: 0,
                pr_pairs: 0,
                rir0_num: 0,
                rir0_den: 0,
                session_count: 2,
                duration_ms: 80 * 60_000,
              },
            ],
            program_ids: [],
            regulars: [
              {
                exercise_id: "career-squat",
                reps: 1240,
                last_logged_at: "2024-01-01T11:00:00.000Z",
              },
            ],
          },
          error: null,
        })
      }
      return Promise.resolve({ data: liveSnapshot(), error: null })
    })
    const { store } = renderRegulars("pierre", "all")
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => {
      expect(screen.getByText("career-squat")).toBeInTheDocument()
    })
    expect(screen.getByText("1,240")).toBeInTheDocument()
    expect(screen.getByText("Most logged · All time")).toBeInTheDocument()
    expect(regularsCard().querySelector("li")?.className).toMatch(
      /grid-cols-\[minmax\(0,1fr\)_4\.5rem\]/,
    )
    expect(regularsCard().querySelector("li")?.className).not.toMatch(/auto_4\.5rem/)
    expect(screen.queryByText("Walking lunge")).not.toBeInTheDocument()
    expect(screen.queryByText("Ring row")).not.toBeInTheDocument()
    expect(screen.queryByText("777")).not.toBeInTheDocument()
    expect(mockRpc).toHaveBeenCalledWith("get_profile_all_time_rollups", {
      p_tz: "UTC",
    })
    expect(
      mockRpc.mock.calls.some((call) => call[0] === "get_profile_snapshot"),
    ).toBe(false)
  })

  it("shows empty when the live window has no habit, not a fake top-8", async () => {
    mockRpc.mockResolvedValue({
      data: {
        sessions: [sessionFact("once", `${isoDayInTimeZone(new Date(), "UTC")}T11:00:00.000Z`)],
        sets: [setFact("once", "Trap bar", "40")],
      },
      error: null,
    })
    const { store } = renderRegulars("pierre", "7")
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => {
      expect(screen.getByText("Not enough logs in this period.")).toBeInTheDocument()
    })
    expect(screen.queryByText("Trap bar")).not.toBeInTheDocument()
    expect(screen.queryByText("Squat")).not.toBeInTheDocument()
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument()
  })
})
