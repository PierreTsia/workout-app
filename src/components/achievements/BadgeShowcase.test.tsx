import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { BadgeShowcase } from "./BadgeShowcase"
import type { BadgeStatusRow } from "@/types/achievements"

const makeRow = (overrides: Partial<BadgeStatusRow>): BadgeStatusRow => ({
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
  ...overrides,
})

const mockRows: BadgeStatusRow[] = [
  makeRow({ tier_id: "t1", tier_level: 1, rank: "bronze", title_en: "First Steps" }),
  makeRow({ tier_id: "t2", tier_level: 2, rank: "silver", title_en: "Getting Serious", group_slug: "volume_king", group_name_en: "Volume" }),
  makeRow({ tier_id: "t3", tier_level: 3, rank: "gold", title_en: "Golden Grind", group_slug: "record_hunter", group_name_en: "Records" }),
  makeRow({ tier_id: "t4", tier_level: 1, rank: "bronze", title_en: "Locked One", is_unlocked: false, granted_at: null }),
]

vi.mock("@/hooks/useBadgeStatus", () => ({
  useBadgeStatus: () => ({ data: mockRows, isLoading: false }),
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

describe("BadgeShowcase", () => {
  it("shows top 3 unlocked badges sorted by tier level", () => {
    renderWithProviders(<BadgeShowcase />)
    expect(screen.getByText("Golden Grind")).toBeInTheDocument()
    expect(screen.getByText("Getting Serious")).toBeInTheDocument()
    expect(screen.getByText("First Steps")).toBeInTheDocument()
    expect(screen.queryByText("Locked One")).not.toBeInTheDocument()
  })

  it("renders 'See all' link to /achievements", () => {
    renderWithProviders(<BadgeShowcase />)
    const link = screen.getByText("See all")
    expect(link.closest("a")).toHaveAttribute("href", "/achievements")
  })

  it("shows unlock count", () => {
    renderWithProviders(<BadgeShowcase />)
    expect(screen.getByText("3/4")).toBeInTheDocument()
  })
})
