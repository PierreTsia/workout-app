import { describe, expect, it, vi, afterEach } from "vitest"
import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import {
  achievementUnlockQueueAtom,
  achievementShownIdsAtom,
} from "@/store/atoms"
import { AchievementUnlockOverlay } from "./AchievementUnlockOverlay"
import type { UnlockedAchievement } from "@/types/achievements"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

function makeUnlock(
  overrides: Partial<UnlockedAchievement> = {},
): UnlockedAchievement {
  return {
    tier_id: "tier-gold",
    group_slug: "volume_king",
    rank: "gold",
    title_en: "Volume King",
    title_fr: "Roi du Volume",
    icon_asset_url: null,
    threshold_value: 5000,
    ...overrides,
  }
}

function renderCeremony(queue: UnlockedAchievement[]) {
  const result = renderWithProviders(<AchievementUnlockOverlay />)
  act(() => {
    result.store.set(achievementUnlockQueueAtom, queue)
  })
  return result
}

describe("AchievementUnlockOverlay", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows a single-grant ceremony with hero title, rank chip, track, and threshold", () => {
    renderCeremony([makeUnlock()])

    expect(screen.getByText("Unlocked")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Volume King" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Gold")).toBeInTheDocument()
    expect(screen.getByText("Volume")).toBeInTheDocument()
    expect(screen.getByText("Lift 5,000 kg total")).toBeInTheDocument()
    expect(screen.getByText("Tap to continue")).toBeInTheDocument()
    expect(
      screen.queryByText("Total volume lifted (kg)"),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
  })

  it("treats Silver as the only hero when a Bronze grant overlaps it", () => {
    renderCeremony([
      makeUnlock({
        tier_id: "bronze",
        rank: "bronze",
        title_en: "First Steps",
        group_slug: "consistency_streak",
        threshold_value: 3,
      }),
      makeUnlock({
        tier_id: "silver",
        rank: "silver",
        title_en: "Quiet Strength",
        group_slug: "volume_king",
        threshold_value: 10_000,
      }),
    ])

    expect(screen.getByText("2 unlocked")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Quiet Strength" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "First Steps" }),
    ).not.toBeInTheDocument()
    expect(screen.getByText("Silver")).toBeInTheDocument()
    expect(screen.getByLabelText("First Steps")).toBeInTheDocument()
    expect(screen.getAllByRole("heading")).toHaveLength(1)
  })

  it("shows a Diamond hero with three supporting medals in one row, not a 2×2", () => {
    renderCeremony([
      makeUnlock({
        tier_id: "bronze",
        rank: "bronze",
        title_en: "First Steps",
        group_slug: "consistency_streak",
        threshold_value: 3,
      }),
      makeUnlock({
        tier_id: "silver",
        rank: "silver",
        title_en: "Quiet Strength",
        group_slug: "rhythm_master",
        threshold_value: 12,
      }),
      makeUnlock({
        tier_id: "gold",
        rank: "gold",
        title_en: "Volume King",
        group_slug: "volume_king",
        threshold_value: 5000,
      }),
      makeUnlock({
        tier_id: "diamond",
        rank: "diamond",
        title_en: "The Spider",
        group_slug: "spidey",
        threshold_value: 27,
      }),
    ])

    expect(screen.getByText("4 unlocked")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "The Spider" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Diamond")).toBeInTheDocument()
    expect(screen.getByText("Spidey")).toBeInTheDocument()
    expect(screen.getByText("Reach 27")).toBeInTheDocument()
    expect(screen.getAllByRole("heading")).toHaveLength(1)
    expect(screen.getAllByRole("listitem")).toHaveLength(3)
    expect(
      screen.getByRole("listitem", { name: /First Steps/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("listitem", { name: /Quiet Strength/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("listitem", { name: /Volume King/ }),
    ).toBeInTheDocument()
  })

  it("shows a +N overflow tile when more than three supporting medals", () => {
    const extras = ["s1", "s2", "s3", "s4", "s5"].map((id) =>
      makeUnlock({
        tier_id: id,
        rank: "gold",
        title_en: `Support ${id}`,
        group_slug: "volume_king",
        threshold_value: 5000,
      }),
    )
    renderCeremony([
      makeUnlock({
        tier_id: "diamond",
        rank: "diamond",
        title_en: "The Spider",
        group_slug: "spidey",
        threshold_value: 27,
      }),
      ...extras,
    ])

    expect(screen.getByText("6 unlocked")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "The Spider" }),
    ).toBeInTheDocument()
    expect(screen.getByText("+2")).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(4)
  })

  it("dismisses the whole batch when the overlay is tapped", async () => {
    const user = userEvent.setup()
    const batch = [
      makeUnlock({
        tier_id: "bronze",
        rank: "bronze",
        title_en: "First Steps",
      }),
      makeUnlock({ tier_id: "gold", rank: "gold", title_en: "Volume King" }),
    ]
    const { store } = renderCeremony(batch)

    await user.click(screen.getByRole("dialog"))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(store.get(achievementUnlockQueueAtom)).toEqual([])
    expect(store.get(achievementShownIdsAtom)).toEqual(
      new Set(["bronze", "gold"]),
    )
  })

  it("dismisses the whole batch on Escape", async () => {
    const user = userEvent.setup()
    const batch = [
      makeUnlock({
        tier_id: "bronze",
        rank: "bronze",
        title_en: "First Steps",
      }),
      makeUnlock({ tier_id: "gold", rank: "gold", title_en: "Volume King" }),
    ]
    const { store } = renderCeremony(batch)

    await user.keyboard("{Escape}")

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(store.get(achievementUnlockQueueAtom)).toEqual([])
  })

  it("leaves grants that arrive after the snapshot for the next ceremony", async () => {
    const user = userEvent.setup()
    const first = makeUnlock({
      tier_id: "gold",
      rank: "gold",
      title_en: "Volume King",
    })
    const late = makeUnlock({
      tier_id: "diamond",
      rank: "diamond",
      title_en: "The Spider",
      group_slug: "spidey",
      threshold_value: 27,
    })
    const { store } = renderCeremony([first])

    expect(
      screen.getByRole("heading", { name: "Volume King" }),
    ).toBeInTheDocument()

    act(() => {
      store.set(achievementUnlockQueueAtom, [first, late])
    })

    expect(
      screen.getByRole("heading", { name: "Volume King" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "The Spider" }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("2 unlocked")).not.toBeInTheDocument()

    await user.click(screen.getByRole("dialog"))

    expect(
      screen.getByRole("heading", { name: "The Spider" }),
    ).toBeInTheDocument()
    expect(store.get(achievementUnlockQueueAtom)).toEqual([late])
  })

  it("does not auto-dismiss after 4 seconds", () => {
    vi.useFakeTimers()
    renderCeremony([makeUnlock()])

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(
      screen.getByRole("heading", { name: "Volume King" }),
    ).toBeInTheDocument()
  })
})
