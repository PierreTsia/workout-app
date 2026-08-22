import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { HeroBlock } from "@/components/profile/HeroBlock"
import { SuccesBlock } from "@/components/profile/SuccesBlock"
import { ProfileWindowProvider } from "@/components/profile/ProfileWindowContext"
import { authAtom } from "@/store/atoms"
import type { SessionFact } from "@/lib/profile/types"
import type { BadgeStatusRow } from "@/types/achievements"
import type { ProfileWindowKind } from "@/lib/profile/window"
import type { UserProfile } from "@/types/onboarding"

const state = vi.hoisted(() => ({
  firstFinishedAt: "2026-08-01T08:00:00.000Z" as string | null,
  sessions: [] as SessionFact[],
  badges: [] as BadgeStatusRow[],
}))

const mockRpc = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: () => ({
    data: {
      user_id: "user-1",
      display_name: "Ada",
      avatar_url: null,
      session_duration_minutes: 60,
      created_at: "2023-01-01T00:00:00.000Z",
      active_title_tier_id: null,
    } satisfies Partial<UserProfile>,
    isLoading: false,
    isError: false,
  }),
}))

vi.mock("@/hooks/useFirstFinishedSessionAt", () => ({
  useFirstFinishedSessionAt: () => ({
    data: state.firstFinishedAt,
    isPending: false,
    isError: false,
    isSuccess: true,
  }),
}))

vi.mock("@/hooks/useActiveProgram", () => ({
  useActiveProgram: () => ({
    data: { id: "upper-lower", name: "Upper/Lower" },
    isPending: false,
    isError: false,
  }),
}))

vi.mock("@/hooks/useUserPrograms", () => ({
  useUserPrograms: () => ({
    data: [
      { id: "upper-lower", name: "Upper/Lower" },
      { id: "ppl", name: "PPL" },
    ],
    isPending: false,
    isError: false,
  }),
}))

vi.mock("@/hooks/useBadgeStatus", () => ({
  useBadgeStatus: () => ({
    data: state.badges,
    isPending: false,
    isError: false,
    isSuccess: true,
  }),
}))

vi.mock("@/lib/trainingActivityTimezone", () => ({
  getResolvedIANATimeZone: () => "UTC",
}))

function session(overrides: Partial<SessionFact>): SessionFact {
  return {
    id: "s1",
    started_at: "2026-08-20T10:00:00.000Z",
    finished_at: "2026-08-20T11:00:00.000Z",
    active_duration_ms: 40 * 60_000,
    program_id: "upper-lower",
    has_catalog_circuit: false,
    ...overrides,
  }
}

function badge(
  overrides: Pick<BadgeStatusRow, "tier_id" | "title_en" | "rank" | "tier_level" | "granted_at"> &
    Partial<BadgeStatusRow>,
): BadgeStatusRow {
  return {
    group_id: overrides.group_slug ?? "circuit_runner",
    group_slug: overrides.group_slug ?? "circuit_runner",
    group_name_en: "Circuit Runner",
    group_name_fr: "Circuit runner",
    title_fr: overrides.title_fr ?? overrides.title_en,
    threshold_value: 1,
    icon_asset_url: null,
    is_unlocked: true,
    current_value: 1,
    progress_pct: 100,
    ...overrides,
  }
}

const CAREER_BADGES = [
  badge({
    tier_id: "recent-bronze",
    title_en: "Baby Spidey",
    group_slug: "spidey",
    rank: "bronze",
    tier_level: 1,
    granted_at: "2026-08-18T12:00:00.000Z",
  }),
  badge({
    tier_id: "old-diamond",
    title_en: "Circuit Star",
    rank: "diamond",
    tier_level: 5,
    granted_at: "2026-06-01T12:00:00.000Z",
  }),
]

function Fold() {
  const [kind, setKind] = useState<ProfileWindowKind>("7")
  return (
    <ProfileWindowProvider kind={kind} setKind={setKind}>
      <button type="button" onClick={() => setKind("100")}>
        This quarter
      </button>
      <HeroBlock mode="pierre" />
      <SuccesBlock mode="pierre" />
    </ProfileWindowProvider>
  )
}

function renderFold() {
  const result = renderWithProviders(<Fold />)
  act(() => {
    result.store.set(authAtom, { id: "user-1", email: "ada@example.com" } as never)
  })
  return result
}

describe("profile hero tenure, hop, and Succès", () => {
  beforeEach(() => {
    state.firstFinishedAt = "2026-08-01T08:00:00.000Z"
    state.sessions = [
      session({ id: "ul", program_id: "upper-lower" }),
      session({
        id: "qw",
        program_id: null,
        finished_at: "2026-08-19T11:00:00.000Z",
      }),
    ]
    state.badges = CAREER_BADGES
    mockRpc.mockReset()
    mockRpc.mockImplementation((name: string) => {
      if (name === "get_profile_snapshot") {
        return Promise.resolve({
          data: { sessions: state.sessions, sets: [] },
          error: null,
        })
      }
      return Promise.resolve({ data: [], error: null })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows Profil tenure from the first finished session, not account created_at or a streak", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 7, 21))
    renderFold()

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Ada" })).toHaveTextContent(
        "Active since 20 days",
      )
    })
    expect(screen.queryByText(/Streak/)).not.toBeInTheDocument()
    expect(screen.queryByText(/2½ years/)).not.toBeInTheDocument()
  })

  it("falls back to profile created_at when there is no finished session", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 7, 21))
    state.firstFinishedAt = null
    renderFold()

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Ada" })).toHaveTextContent(
        "Active since 3½ years",
      )
    })
    expect(screen.queryByText("Active since 20 days")).not.toBeInTheDocument()
  })

  it("hides the hop line for one Program plus Quick Workout in this window", async () => {
    renderFold()

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Ada" })).toBeInTheDocument()
    })
    expect(screen.queryByText(/Also PPL/)).not.toBeInTheDocument()
  })

  it("shows the hop line when two Programs produced sessions in this window", async () => {
    state.sessions = [
      session({ id: "ul", program_id: "upper-lower" }),
      session({
        id: "ppl",
        program_id: "ppl",
        finished_at: "2026-08-18T11:00:00.000Z",
      }),
    ]
    renderFold()

    await waitFor(() => {
      expect(screen.getByText("Also PPL this week")).toBeInTheDocument()
    })
  })

  it("toggles hop with 7d vs 100d without changing the career Latest badge", async () => {
    state.sessions = [
      session({ id: "ul", program_id: "upper-lower" }),
      session({
        id: "ppl",
        program_id: "ppl",
        finished_at: "2026-07-01T11:00:00.000Z",
      }),
    ]
    const user = userEvent.setup()
    renderFold()

    await waitFor(() => {
      expect(screen.getByText("2 / 2")).toBeInTheDocument()
    })
    expect(screen.getByText("Latest").closest("button")).toHaveAccessibleName("Baby Spidey")
    expect(screen.getByRole("button", { name: "Circuit Star" })).toBeInTheDocument()
    expect(screen.queryByText(/Also PPL/)).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "This quarter" }))

    await waitFor(() => {
      expect(screen.getByText("Also PPL this week")).toBeInTheDocument()
    })
    expect(screen.getByText("Latest").closest("button")).toHaveAccessibleName("Baby Spidey")
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute(
      "href",
      "/achievements",
    )
  })

  it("keeps Recently earned inside the window and does not copy Account top-3-by-tier", async () => {
    state.badges = [
      ...CAREER_BADGES,
      badge({
        tier_id: "mid-window",
        title_en: "Squat Survivor",
        rank: "bronze",
        tier_level: 1,
        granted_at: "2026-08-17T12:00:00.000Z",
      }),
    ]
    renderFold()

    await waitFor(() => {
      expect(screen.getByRole("list", { name: "Recent" })).toBeInTheDocument()
    })
    const recent = screen.getByRole("list", { name: "Recent" })
    expect(recent.textContent).toContain("Squat Survivor")
    expect(recent.textContent).not.toContain("Baby Spidey")
    expect(recent.textContent).not.toContain("Circuit Star")
    expect(screen.getByText("Latest").closest("button")).toHaveAccessibleName("Baby Spidey")
    expect(screen.getByRole("button", { name: "Circuit Star" })).toBeInTheDocument()
  })

  it("shows three recently earned rows with rank badges and an and-more remainder", async () => {
    state.badges = [
      badge({
        tier_id: "r1",
        title_en: "Alpha",
        rank: "gold",
        tier_level: 3,
        granted_at: "2026-08-20T12:00:00.000Z",
      }),
      badge({
        tier_id: "r2",
        title_en: "Bravo",
        rank: "silver",
        tier_level: 2,
        granted_at: "2026-08-19T12:00:00.000Z",
      }),
      badge({
        tier_id: "r3",
        title_en: "Charlie",
        rank: "bronze",
        tier_level: 1,
        granted_at: "2026-08-18T12:00:00.000Z",
      }),
      badge({
        tier_id: "r4",
        title_en: "Delta",
        rank: "bronze",
        tier_level: 1,
        granted_at: "2026-08-17T12:00:00.000Z",
      }),
      badge({
        tier_id: "r5",
        title_en: "Echo",
        rank: "platinum",
        tier_level: 4,
        granted_at: "2026-08-16T12:00:00.000Z",
      }),
    ]
    renderFold()

    await waitFor(() => {
      expect(screen.getByRole("list", { name: "Recent" })).toBeInTheDocument()
    })
    const recent = screen.getByRole("list", { name: "Recent" })
    expect(recent.textContent).not.toContain("Alpha")
    expect(recent.textContent).toContain("Bravo")
    expect(recent.textContent).toContain("Silver")
    expect(recent.textContent).toMatch(/Aug 19/)
    expect(recent.textContent).toContain("GymLogic circuit runs (1+ round)")
    expect(recent.textContent).toContain("Charlie")
    expect(recent.textContent).toContain("Delta")
    expect(recent.textContent).not.toContain("Echo")
    expect(screen.getByRole("link", { name: "and 1 more…" })).toHaveAttribute(
      "href",
      "/achievements",
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole("radio", { name: "Highest" }))
    const top = screen.getByRole("list", { name: "Highest" })
    expect(top.textContent).toContain("Alpha")
    expect(top.textContent).toContain("Gold")
    expect(top.textContent).toContain("Bravo")
    expect(top.textContent).toContain("Charlie")
    expect(top.textContent).not.toContain("Echo")
    expect(top.textContent).not.toContain("Delta")
    const byRank = screen.getByRole("list", { name: "By rank" })
    expect(byRank.textContent).toContain("Bronze 2")
    expect(byRank.textContent).toContain("Silver 1")
    expect(byRank.textContent).toContain("Gold 1")
    expect(byRank.textContent).toContain("Platinum 1")
    expect(byRank.textContent).not.toContain("Diamond")
  })

  it("shows the unlocking performance on featured badges and list rows", async () => {
    state.badges = [
      badge({
        tier_id: "volume",
        title_en: "Is That All You Got?",
        group_slug: "volume_king",
        rank: "bronze",
        tier_level: 1,
        threshold_value: 1000,
        granted_at: "2026-08-20T12:00:00.000Z",
      }),
      badge({
        tier_id: "streak",
        title_en: "Iron Routine",
        group_slug: "consistency_streak",
        rank: "silver",
        tier_level: 2,
        threshold_value: 13,
        granted_at: "2026-08-18T12:00:00.000Z",
      }),
    ]
    renderFold()

    await waitFor(() => {
      expect(screen.getByRole("list", { name: "Recent" })).toBeInTheDocument()
    })
    expect(screen.getByText("Latest").closest("button")).toHaveTextContent("1 t")
    screen.getAllByRole("button", { name: "Iron Routine" }).forEach((row) => {
      expect(row).toHaveTextContent("13")
    })
    const recent = screen.getByRole("list", { name: "Recent" })
    expect(recent.textContent).toContain("Iron Routine")
    expect(recent.textContent).toContain("13")
    expect(recent.textContent).not.toContain("1 t")
    const byRank = screen.getByRole("list", { name: "By rank" })
    expect(byRank.textContent).toContain("Bronze 1")
    expect(byRank.textContent).toContain("Silver 1")
    expect(byRank.textContent).not.toContain("1 t")
    expect(byRank.textContent).not.toContain("13")
  })
})
