import { describe, expect, it } from "vitest"
import { buildSuccesVm } from "./succes"
import type { AchievementRank, BadgeStatusRow } from "@/types/achievements"

function makeBadge(
  overrides: Partial<BadgeStatusRow> & Pick<BadgeStatusRow, "tier_id" | "title_en">,
): BadgeStatusRow {
  const rank: AchievementRank = overrides.rank ?? "bronze"
  return {
    group_id: overrides.group_id ?? "g1",
    group_slug: overrides.group_slug ?? "group",
    group_name_en: overrides.group_name_en ?? "Group",
    group_name_fr: overrides.group_name_fr ?? "Groupe",
    tier_id: overrides.tier_id,
    tier_level: overrides.tier_level ?? 1,
    rank,
    title_en: overrides.title_en,
    title_fr: overrides.title_fr ?? overrides.title_en,
    threshold_value: overrides.threshold_value ?? 1,
    icon_asset_url: overrides.icon_asset_url ?? null,
    is_unlocked: overrides.is_unlocked ?? true,
    granted_at: overrides.granted_at ?? "2026-08-18T00:00:00.000Z",
    current_value: overrides.current_value ?? 1,
    progress_pct: overrides.progress_pct ?? 100,
  }
}

const WINDOW = { from: "2026-08-15", to: "2026-08-21", timeZone: "UTC" }

describe("buildSuccesVm", () => {
  it("keeps Recently earned to grants inside the window, not career-only badges", () => {
    const vm = buildSuccesVm(
      [
        makeBadge({
          tier_id: "recent-bronze",
          title_en: "Baby Spidey",
          granted_at: "2026-08-18T12:00:00.000Z",
          rank: "bronze",
          tier_level: 1,
        }),
        makeBadge({
          tier_id: "old-diamond",
          title_en: "Circuit Star",
          granted_at: "2026-06-01T12:00:00.000Z",
          rank: "diamond",
          tier_level: 5,
        }),
      ],
      WINDOW,
    )

    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.recent.map((badge) => badge.title_en)).toEqual(["Baby Spidey"])
    expect(vm.recent.map((badge) => badge.title_en)).not.toContain("Circuit Star")
  })

  it("picks Latest by granted_at and Highest by rank, not Account's top-3-by-tier", () => {
    const vm = buildSuccesVm(
      [
        makeBadge({
          tier_id: "recent-bronze",
          title_en: "Baby Spidey",
          granted_at: "2026-08-18T12:00:00.000Z",
          rank: "bronze",
          tier_level: 1,
        }),
        makeBadge({
          tier_id: "mid-gold",
          title_en: "No Break",
          granted_at: "2026-08-10T12:00:00.000Z",
          rank: "gold",
          tier_level: 3,
        }),
        makeBadge({
          tier_id: "old-diamond",
          title_en: "Circuit Star",
          granted_at: "2026-06-01T12:00:00.000Z",
          rank: "diamond",
          tier_level: 5,
        }),
      ],
      WINDOW,
    )

    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.latest.title_en).toBe("Baby Spidey")
    expect(vm.highest.title_en).toBe("Circuit Star")
    expect(vm.unlocked).toBe(3)
    expect(vm.total).toBe(3)
  })
})
