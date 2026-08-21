import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, screen, waitFor, within } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { BalanceTonnageRow } from "@/components/profile/BalanceTonnageRow"
import { ProfileWindowProvider } from "@/components/profile/ProfileWindowContext"
import {
  restoreChartLayout,
  stubChartLayout,
} from "@/components/profile/charts/chartTestLayout"
import { MUSCLE_TAXONOMY } from "@/lib/trainingBalance"
import { authAtom } from "@/store/atoms"

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

vi.mock("@/lib/trainingActivityTimezone", () => ({
  getResolvedIANATimeZone: () => "UTC",
}))

function sectionCard(name: string): HTMLElement {
  const heading = screen.getByRole("heading", { name })
  const card = heading.closest(".bg-card")
  if (!(card instanceof HTMLElement)) throw new Error(`expected ${name} card`)
  return card
}

function session(id: string, finishedAt: string) {
  return {
    id,
    started_at: finishedAt,
    finished_at: finishedAt,
    active_duration_ms: 40 * 60_000,
    program_id: null,
    has_catalog_circuit: id.startsWith("circuit"),
  }
}

function set(input: {
  session_id: string
  weight_logged: number
  reps: string | null
  duration_seconds?: number | null
  block_exercise_id?: string | null
}) {
  return {
    session_id: input.session_id,
    exercise_id: "ex-1",
    was_pr: false,
    rir: 2,
    weight_logged: input.weight_logged,
    reps: input.reps,
    duration_seconds: input.duration_seconds ?? null,
    block_exercise_id: input.block_exercise_id ?? null,
  }
}

function volume(sessions: number, pecsSets: number, pecsKg: number) {
  return {
    finished_sessions: sessions,
    muscles: MUSCLE_TAXONOMY.map((muscle) => ({
      muscle_group: muscle,
      total_sets: muscle === "Pectoraux" ? pecsSets : 0,
      total_volume_kg: muscle === "Pectoraux" ? pecsKg : 0,
      exercise_count: pecsSets > 0 ? 1 : 0,
    })),
  }
}

function mockProfileRpcs(input: {
  sessions: ReturnType<typeof session>[]
  sets: ReturnType<typeof set>[]
  currentVolume: ReturnType<typeof volume>
  previousVolume?: ReturnType<typeof volume>
}) {
  mockRpc.mockImplementation((name: string, args?: { p_offset_days?: number }) => {
    if (name === "get_profile_snapshot") {
      return Promise.resolve({
        data: { sessions: input.sessions, sets: input.sets },
        error: null,
      })
    }
    if (name === "get_volume_by_muscle_group") {
      const prior = args?.p_offset_days != null && args.p_offset_days > 0
      return Promise.resolve({
        data: prior ? (input.previousVolume ?? volume(0, 0, 0)) : input.currentVolume,
        error: null,
      })
    }
    return Promise.resolve({ data: null, error: null })
  })
}

describe("profile Équilibre + Tonnage wiring", () => {
  beforeEach(() => {
    stubChartLayout()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"))
    mockRpc.mockReset()
  })

  afterEach(() => {
    restoreChartLayout()
    vi.useRealTimers()
  })

  it("keeps Équilibre empty at 2 sessions while Tonnage still renders loaded iron", async () => {
    mockProfileRpcs({
      sessions: [
        session("s1", "2026-08-20T11:00:00.000Z"),
        session("circuit-dl", "2026-08-21T11:00:00.000Z"),
      ],
      sets: [
        set({
          session_id: "circuit-dl",
          weight_logged: 140,
          reps: "3",
          block_exercise_id: "be-dl",
        }),
      ],
      currentVolume: volume(2, 12, 9_999),
    })

    const { store } = renderWithProviders(
      <ProfileWindowProvider kind="7" setKind={() => undefined}>
        <BalanceTonnageRow mode="pierre" />
      </ProfileWindowProvider>,
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => {
      expect(within(sectionCard("Tonnage")).getByText("0.42 t")).toBeInTheDocument()
    })

    const balance = within(sectionCard("Balance"))
    expect(balance.getByText("Not enough sessions for a score.")).toBeInTheDocument()
    expect(balance.queryByText("67 / 100")).not.toBeInTheDocument()
    expect(balance.queryByRole("img", { name: /Muscle balance/ })).not.toBeInTheDocument()
    expect(within(sectionCard("Tonnage")).queryByText("18.4 t")).not.toBeInTheDocument()
    expect(sectionCard("Balance").parentElement?.className).toMatch(
      /lg:grid-cols-2/,
    )
  })

  it("leaves Tonnage empty on Cindy 0 kg even when radar kg is huge", async () => {
    mockProfileRpcs({
      sessions: [
        session("s1", "2026-08-19T11:00:00.000Z"),
        session("s2", "2026-08-20T11:00:00.000Z"),
        session("circuit-cindy", "2026-08-21T11:00:00.000Z"),
      ],
      sets: [
        set({
          session_id: "circuit-cindy",
          weight_logged: 0,
          reps: "15",
          block_exercise_id: "be-cindy",
        }),
      ],
      currentVolume: volume(3, 12, 50_000),
    })

    const { store } = renderWithProviders(
      <ProfileWindowProvider kind="7" setKind={() => undefined}>
        <BalanceTonnageRow mode="pierre" />
      </ProfileWindowProvider>,
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => {
      expect(
        within(sectionCard("Tonnage")).getByText("No loaded sets in this window."),
      ).toBeInTheDocument()
    })
    expect(within(sectionCard("Tonnage")).queryByText(/50/)).not.toBeInTheDocument()
    expect(within(sectionCard("Balance")).queryByText("Not enough sessions for a score.")).not.toBeInTheDocument()
    expect(within(sectionCard("Balance")).getByRole("img", { name: /Muscle balance/ })).toBeInTheDocument()
    expect(within(sectionCard("Balance")).getAllByText("Chest").length).toBeGreaterThan(0)
    expect(within(sectionCard("Balance")).queryByText("Pectoraux")).not.toBeInTheDocument()
  })
})
