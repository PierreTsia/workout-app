import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { AchievementsPage } from "./AchievementsPage"
import type { BadgeStatusRow } from "@/types/achievements"

const mockRows: BadgeStatusRow[] = [
  {
    group_id: "g1",
    group_slug: "consistency_streak",
    group_name_en: "Consistency",
    group_name_fr: "Régularité",
    tier_id: "t1",
    tier_level: 1,
    rank: "bronze",
    title_en: "First Steps",
    title_fr: "Premiers pas",
    threshold_value: 5,
    icon_asset_url: null,
    is_unlocked: true,
    granted_at: "2026-01-01",
    current_value: 10,
    progress_pct: 100,
  },
  {
    group_id: "g1",
    group_slug: "consistency_streak",
    group_name_en: "Consistency",
    group_name_fr: "Régularité",
    tier_id: "t2",
    tier_level: 2,
    rank: "silver",
    title_en: "Getting Serious",
    title_fr: "Ça devient sérieux",
    threshold_value: 25,
    icon_asset_url: null,
    is_unlocked: false,
    granted_at: null,
    current_value: 10,
    progress_pct: 40,
  },
  {
    group_id: "g2",
    group_slug: "volume_king",
    group_name_en: "Volume",
    group_name_fr: "Volume",
    tier_id: "t3",
    tier_level: 1,
    rank: "bronze",
    title_en: "Warm Up",
    title_fr: "Échauffement",
    threshold_value: 1000,
    icon_asset_url: null,
    is_unlocked: false,
    granted_at: null,
    current_value: 200,
    progress_pct: 20,
  },
]

vi.mock("@/hooks/useBadgeStatus", () => ({
  useBadgeStatus: () => ({ data: mockRows, isLoading: false, isError: false }),
}))

vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: () => ({ data: null }),
}))

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(),
    },
  },
}))

describe("AchievementsPage", () => {
  it("renders page title and accordion groups", () => {
    renderWithProviders(<AchievementsPage />)
    expect(screen.getByText("Achievements")).toBeInTheDocument()
    expect(screen.getByText("Consistency")).toBeInTheDocument()
    expect(screen.getByText("Volume")).toBeInTheDocument()
  })

  it("auto-expands group with partial progress (consistency)", () => {
    renderWithProviders(<AchievementsPage />)
    expect(screen.getByText("10 / 25")).toBeInTheDocument()
  })

  it("keeps fully-locked group collapsed (volume has 0 unlocked)", () => {
    renderWithProviders(<AchievementsPage />)
    expect(screen.queryByText("Warm Up")).not.toBeInTheDocument()
  })

  it("opens BadgeDetailDrawer when clicking a tier badge", async () => {
    const user = userEvent.setup()
    renderWithProviders(<AchievementsPage />)
    const tierButtons = screen.getAllByRole("button").filter(
      (btn) => btn.classList.contains("active:scale-95"),
    )
    await user.click(tierButtons[0])
    expect(screen.getByText("Equip title")).toBeInTheDocument()
  })
})
