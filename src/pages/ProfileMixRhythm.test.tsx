import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { ProfilePage } from "@/pages/ProfilePage"
import {
  restoreChartLayout,
  stubChartLayout,
} from "@/components/profile/charts/chartTestLayout"
import { authAtom } from "@/store/atoms"
import type { User } from "@/types/auth"

const mockRpc = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: () => ({
    data: { session_duration_minutes: 60 },
    isLoading: false,
    isError: false,
  }),
}))

vi.mock("@/hooks/useProfileCircuitLedger", () => ({
  useProfileCircuitLedger: () => ({
    data: [],
    isSuccess: false,
    isPending: false,
    isError: false,
    fetchStatus: "idle",
  }),
}))

vi.mock("@/hooks/useBadgeStatus", () => ({
  useBadgeStatus: () => ({
    data: [],
    isPending: false,
    isError: false,
    isSuccess: true,
  }),
}))

function sectionCard(name: string): HTMLElement {
  const heading = screen.getByRole("heading", { name })
  const card = heading.closest(".bg-card")
  if (!(card instanceof HTMLElement)) throw new Error(`expected ${name} card`)
  return card
}

function testUser(): User {
  return {
    id: "user-1",
    aud: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
  }
}

function session(input: {
  id: string
  finishedAt: string
  program_id: string | null
  has_catalog_circuit: boolean
}) {
  return {
    id: input.id,
    started_at: input.finishedAt,
    finished_at: input.finishedAt,
    active_duration_ms: 40 * 60_000,
    program_id: input.program_id,
    has_catalog_circuit: input.has_catalog_circuit,
  }
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

describe("profile Mix and Rhythm from snapshot", () => {
  beforeEach(() => {
    stubChartLayout()
    mockRpc.mockReset()
    mockRpc.mockResolvedValue({ data: { sessions: [], sets: [] }, error: null })
    Object.assign(Element.prototype, {
      hasPointerCapture: () => false,
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
      scrollIntoView: () => undefined,
    })
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  afterEach(() => {
    restoreChartLayout()
  })

  it("shows Mix empty and Rhythm all-empty rings when the live window has no sessions", async () => {
    const { store } = renderWithProviders(<ProfilePage />)
    act(() => {
      store.set(authAtom, testUser())
    })

    await waitFor(() => {
      expect(within(sectionCard("Mix")).getByText("No sessions in this window.")).toBeInTheDocument()
    })
    expect(within(sectionCard("Mix")).queryByRole("img", { name: "Mix" })).not.toBeInTheDocument()

    const rhythm = within(sectionCard("Rhythm"))
    expect(rhythm.queryByText("No sessions in this window.")).not.toBeInTheDocument()
    expect(rhythm.getAllByRole("listitem")).toHaveLength(7)
    const dots = rhythm.getByRole("list", { name: "Rhythm" }).querySelectorAll("[data-rhythm-dot]")
    expect(dots).toHaveLength(7)
    expect([...dots].every((dot) => dot.getAttribute("data-rhythm-dot") === "off")).toBe(true)
  })

  it("stacks QW, Programme, and a catalog Circuit instead of dumping them into Programme", async () => {
    mockRpc.mockResolvedValue({
      data: {
        sessions: [
          session({
            id: "cindy",
            finishedAt: daysAgoIso(4),
            program_id: "upper-lower",
            has_catalog_circuit: true,
          }),
          session({
            id: "qw",
            finishedAt: daysAgoIso(2),
            program_id: null,
            has_catalog_circuit: false,
          }),
          session({
            id: "program",
            finishedAt: daysAgoIso(0),
            program_id: "upper-lower",
            has_catalog_circuit: false,
          }),
        ],
        sets: [],
      },
      error: null,
    })
    const { store } = renderWithProviders(<ProfilePage />)
    act(() => {
      store.set(authAtom, testUser())
    })

    const mix = await waitFor(() => {
      const chart = within(sectionCard("Mix")).getByRole("img", { name: "Mix" })
      expect(chart.querySelectorAll(".recharts-bar")).toHaveLength(3)
      return chart
    })
    expect(within(sectionCard("Mix")).queryByText("No sessions in this window.")).not.toBeInTheDocument()
    expect(mix.querySelectorAll(".recharts-bar")).toHaveLength(3)
    expect(within(sectionCard("Mix")).getByText("Programme")).toBeInTheDocument()
    expect(within(sectionCard("Mix")).getByText("Quick Workout")).toBeInTheDocument()
    expect(within(sectionCard("Mix")).getByText("Circuits")).toBeInTheDocument()
  })

  it("renders Toujours Mix as year buckets from rollups, not a snapshot dump", async () => {
    const user = userEvent.setup()
    mockRpc.mockImplementation((name: string) => {
      if (name === "get_profile_all_time_rollups") {
        return Promise.resolve({
          data: {
            years: [
              {
                year: 2023,
                mix: { programme: 10, quickWorkout: 2, circuits: 1 },
                tonnage_kg: 1000,
                pr_pairs: 4,
                rir0_num: 1,
                rir0_den: 8,
                session_count: 13,
                duration_ms: 13 * 40 * 60_000,
              },
              {
                year: 2026,
                mix: { programme: 4, quickWorkout: 1, circuits: 0 },
                tonnage_kg: 400,
                pr_pairs: 2,
                rir0_num: 0,
                rir0_den: 4,
                session_count: 5,
                duration_ms: 5 * 40 * 60_000,
              },
            ],
            program_ids: [],
            regulars: [],
          },
          error: null,
        })
      }
      if (name === "get_profile_snapshot") {
        return Promise.resolve({ data: { sessions: [], sets: [] }, error: null })
      }
      return Promise.resolve({ data: [], error: null })
    })
    const { store } = renderWithProviders(<ProfilePage />)
    act(() => {
      store.set(authAtom, testUser())
    })

    await user.click(screen.getByRole("combobox", { name: "Window" }))
    await user.click(await screen.findByRole("option", { name: "All time" }))

    const mix = within(sectionCard("Mix"))
    const chart = await waitFor(() => {
      const img = mix.getByRole("img", { name: "Mix" })
      expect(img.querySelectorAll(".recharts-cartesian-axis-tick")).toHaveLength(2)
      return img
    })
    expect(mix.getByText("2023")).toBeInTheDocument()
    expect(mix.getByText("2026")).toBeInTheDocument()
    expect(mix.queryByText("2024")).not.toBeInTheDocument()
    expect(mix.queryByText("No sessions in this window.")).not.toBeInTheDocument()
    expect(chart.querySelectorAll(".recharts-cartesian-axis-tick")).toHaveLength(2)
    expect(
      mockRpc.mock.calls.some((call) => call[0] === "get_profile_all_time_rollups"),
    ).toBe(true)
    expect(
      mockRpc.mock.calls.some(
        (call) =>
          call[0] === "get_profile_snapshot" &&
          typeof call[1] === "object" &&
          call[1] != null &&
          "p_from" in call[1] &&
          typeof call[1].p_from === "string" &&
          call[1].p_from < "2020-01-01",
      ),
    ).toBe(false)
  })
})
