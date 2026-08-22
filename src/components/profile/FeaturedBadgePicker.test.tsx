import { describe, expect, it, vi, beforeEach } from "vitest"
import { act, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { FeaturedBadgePicker } from "./FeaturedBadgePicker"
import { authAtom } from "@/store/atoms"
import type { BadgeStatusRow } from "@/types/achievements"

const mutate = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

vi.mock("@/hooks/useEquipTitle", () => ({
  useEquipTitle: () => ({ mutate, isPending: false }),
}))

const badges: BadgeStatusRow[] = [
  {
    group_id: "g-bronze",
    group_slug: "consistency_streak",
    group_name_en: "Consistency",
    group_name_fr: "Régularité",
    tier_id: "tier-bronze",
    tier_level: 1,
    rank: "bronze",
    title_en: "That's it?",
    title_fr: "Sérieux, c'est tout ?",
    threshold_value: 5,
    icon_asset_url: null,
    is_unlocked: true,
    granted_at: "2026-01-01",
    current_value: 5,
    progress_pct: 100,
  },
  {
    group_id: "g-gold",
    group_slug: "volume_king",
    group_name_en: "Volume",
    group_name_fr: "Volume",
    tier_id: "tier-gold",
    tier_level: 3,
    rank: "gold",
    title_en: "Golden Grind",
    title_fr: "Meule d'or",
    threshold_value: 50,
    icon_asset_url: null,
    is_unlocked: true,
    granted_at: "2026-03-01",
    current_value: 50,
    progress_pct: 100,
  },
  {
    group_id: "g-locked",
    group_slug: "record_hunter",
    group_name_en: "Records",
    group_name_fr: "Records",
    tier_id: "tier-locked",
    tier_level: 5,
    rank: "diamond",
    title_en: "Locked Star",
    title_fr: "Étoile verrouillée",
    threshold_value: 100,
    icon_asset_url: null,
    is_unlocked: false,
    granted_at: null,
    current_value: 10,
    progress_pct: 10,
  },
]

vi.mock("@/hooks/useBadgeStatus", () => ({
  useBadgeStatus: () => ({ data: badges, isPending: false }),
}))

const bronze = badges[0]

function renderAuthedPicker(locale: "en" | "fr" = "en") {
  const title = locale === "fr" ? bronze.title_fr : bronze.title_en
  const result = renderWithProviders(
    <FeaturedBadgePicker title={title} equipped={bronze} />,
    { locale },
  )
  act(() => {
    result.store.set(authAtom, { id: "user-1", email: "ada@example.com" } as never)
  })
  return result
}

describe("FeaturedBadgePicker", () => {
  beforeEach(() => {
    mutate.mockReset()
  })

  it("hides the edit control when nobody is signed in", () => {
    renderWithProviders(
      <FeaturedBadgePicker title={bronze.title_en} equipped={bronze} />,
    )

    expect(screen.getByText("That's it?")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Change featured badge" }),
    ).not.toBeInTheDocument()
  })

  it("opens won badges only, then updates the hero line on pick", async () => {
    const user = userEvent.setup()
    renderAuthedPicker()

    expect(screen.getByText("That's it?")).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: "Change featured badge" }),
    )

    const list = screen.getByRole("listbox", { name: "Unlocked badges" })
    const options = within(list).getAllByRole("option")
    expect(options.map((option) => option.textContent)).toEqual([
      "Golden Grind",
      "That's it?",
    ])
    expect(within(list).queryByRole("option", { name: "Locked Star" })).not.toBeInTheDocument()

    await user.click(within(list).getByRole("option", { name: "Golden Grind" }))

    expect(screen.getByText("Golden Grind")).toBeInTheDocument()
    expect(screen.queryByText("That's it?")).not.toBeInTheDocument()
    expect(mutate).toHaveBeenCalledWith("tier-gold", expect.any(Object))
  })

  it("labels the edit control in French", async () => {
    const user = userEvent.setup()
    renderAuthedPicker("fr")

    await user.click(
      screen.getByRole("button", { name: "Changer le badge affiché" }),
    )

    expect(
      screen.getByRole("option", { name: "Meule d'or" }),
    ).toBeInTheDocument()
  })
})
