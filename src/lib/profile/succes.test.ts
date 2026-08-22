import { describe, expect, it } from "vitest"
import {
  buildSuccesVm,
  formatBadgePerformance,
  grantedInWindow,
  PERFORMANCE_MAX_CHARS,
  succesListPreview,
} from "./succes"
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

describe("grantedInWindow", () => {
  const rows = [
    makeBadge({
      tier_id: "in-window",
      title_en: "Baby Spidey",
      granted_at: "2026-08-18T12:00:00.000Z",
    }),
    makeBadge({
      tier_id: "before-window",
      title_en: "Circuit Star",
      granted_at: "2026-06-01T12:00:00.000Z",
    }),
    makeBadge({
      tier_id: "locked",
      title_en: "Locked",
      is_unlocked: false,
      granted_at: null,
    }),
  ]

  it("keeps grants whose local day sits inside the window", () => {
    expect(grantedInWindow(rows, WINDOW).map((badge) => badge.title_en)).toEqual([
      "Baby Spidey",
    ])
  })

  it("returns empty when nothing was earned in the window", () => {
    expect(
      grantedInWindow(rows, {
        from: "2026-07-01",
        to: "2026-07-07",
        timeZone: "UTC",
      }),
    ).toEqual([])
  })
})

describe("buildSuccesVm", () => {
  it("scopes Latest, Highest, and ranks to grants inside the window", () => {
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
    expect(vm.latest.title_en).toBe("Baby Spidey")
    expect(vm.highest.title_en).toBe("Baby Spidey")
    expect(vm.unlocked).toBe(1)
    expect(vm.recent.map((badge) => badge.title_en)).toEqual([])
    expect(vm.recent.map((badge) => badge.title_en)).not.toContain("Circuit Star")
    expect(vm.nextHighest.map((badge) => badge.title_en)).not.toContain("Circuit Star")
    expect(vm.byRank).toEqual([{ rank: "bronze", count: 1 }])
  })

  it("is empty when the career has badges but none in this window", () => {
    const vm = buildSuccesVm(
      [
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

    expect(vm).toEqual({ status: "empty" })
  })

  it("drops Latest from Recently earned so the next grant can take the slot", () => {
    const vm = buildSuccesVm(
      [
        makeBadge({
          tier_id: "ceiling",
          title_en: "Ceiling Breaker",
          granted_at: "2026-08-21T20:24:08.000Z",
        }),
        makeBadge({
          tier_id: "volume",
          title_en: "Is That All You Got?",
          granted_at: "2026-08-21T20:24:07.519549+00:00",
        }),
        makeBadge({
          tier_id: "squat",
          title_en: "Squat Survivor",
          granted_at: "2026-08-20T12:00:00.000Z",
        }),
        makeBadge({
          tier_id: "older",
          title_en: "Nose to Floor",
          granted_at: "2026-08-16T12:00:00.000Z",
        }),
      ],
      WINDOW,
    )

    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.latest.title_en).toBe("Ceiling Breaker")
    expect(vm.recent.map((badge) => badge.title_en)).toEqual([
      "Is That All You Got?",
      "Squat Survivor",
      "Nose to Floor",
    ])
    expect(succesListPreview(vm.recent).shown.map((badge) => badge.title_en)).toEqual([
      "Is That All You Got?",
      "Squat Survivor",
      "Nose to Floor",
    ])
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
          granted_at: "2026-08-16T12:00:00.000Z",
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
    expect(vm.highest.title_en).toBe("No Break")
    expect(vm.recent.map((badge) => badge.title_en)).toEqual(["No Break"])
    expect(vm.nextHighest.map((badge) => badge.title_en)).toEqual(["Baby Spidey"])
    expect(vm.unlocked).toBe(2)
    expect(vm.total).toBe(3)
    expect(vm.byRank).toEqual([
      { rank: "bronze", count: 1 },
      { rank: "gold", count: 1 },
    ])
  })

  it("counts window ranks and skips empty ladders", () => {
    const vm = buildSuccesVm(
      [
        makeBadge({
          tier_id: "b1",
          title_en: "Bronze A",
          rank: "bronze",
          granted_at: "2026-08-18T12:00:00.000Z",
        }),
        makeBadge({
          tier_id: "b2",
          title_en: "Bronze B",
          rank: "bronze",
          granted_at: "2026-08-16T12:00:00.000Z",
        }),
        makeBadge({
          tier_id: "g1",
          title_en: "Gold A",
          rank: "gold",
          granted_at: "2026-08-17T12:00:00.000Z",
        }),
        makeBadge({
          tier_id: "locked",
          title_en: "Locked Silver",
          rank: "silver",
          is_unlocked: false,
          granted_at: null,
        }),
      ],
      WINDOW,
    )

    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.byRank).toEqual([
      { rank: "bronze", count: 2 },
      { rank: "gold", count: 1 },
    ])
  })

  it("picks Latest from the parsed timestamptz, not a calendar-day string compare", () => {
    const vm = buildSuccesVm(
      [
        makeBadge({
          tier_id: "volume-earlier",
          title_en: "Is That All You Got?",
          granted_at: "2026-08-21T10:15:00.000Z",
        }),
        makeBadge({
          tier_id: "ceiling-later",
          title_en: "Ceiling Breaker",
          granted_at: "2026-08-21T16:42:08+00:00",
        }),
      ],
      WINDOW,
    )

    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.latest.title_en).toBe("Ceiling Breaker")
    expect(vm.recent.map((badge) => badge.title_en)).toEqual(["Is That All You Got?"])
  })

  it("does not repeat Latest in Recently earned when two grants share a stamp", () => {
    const stamp = "2026-08-21T20:24:07.519549+00:00"
    const vm = buildSuccesVm(
      [
        makeBadge({
          tier_id: "volume-king",
          title_en: "Is That All You Got?",
          granted_at: stamp,
        }),
        makeBadge({
          tier_id: "record-hunter",
          title_en: "Ceiling Breaker",
          granted_at: stamp,
        }),
      ],
      WINDOW,
    )

    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.latest.title_en).toBe("Ceiling Breaker")
    expect(vm.recent.map((badge) => badge.title_en)).toEqual(["Is That All You Got?"])
  })

  it("keeps a 3-badge recent preview and a leftover count", () => {
    const recent = ["A", "B", "C", "D", "E"].map((title, i) =>
      makeBadge({
        tier_id: `r-${title}`,
        title_en: title,
        granted_at: `2026-08-2${i}T12:00:00.000Z`,
      }),
    )
    const preview = succesListPreview(recent)
    expect(preview.shown.map((badge) => badge.title_en)).toEqual(["A", "B", "C"])
    expect(preview.more).toBe(2)
  })
})

describe("formatBadgePerformance", () => {
  it.each([
    { slug: "volume_king", n: 0, locale: "en", expected: "0 kg" },
    { slug: "volume_king", n: 13, locale: "en", expected: "13 kg" },
    { slug: "volume_king", n: 100, locale: "fr", expected: "100 kg" },
    { slug: "volume_king", n: 1_000, locale: "en", expected: "1 t" },
    { slug: "volume_king", n: 1_000, locale: "fr", expected: "1 t" },
    { slug: "volume_king", n: 1_000_000, locale: "en", expected: "1 kt" },
    { slug: "volume_king", n: 1_000_000, locale: "fr", expected: "1 kt" },
    { slug: "volume_king", n: 12_500_000, locale: "en", expected: "12.5 kt" },
    { slug: "volume_king", n: 12_500_000, locale: "fr", expected: "12,5 kt" },
    { slug: "circuit_runner", n: 0, locale: "en", expected: "0" },
    { slug: "circuit_runner", n: 15, locale: "en", expected: "15" },
    { slug: "consistency_streak", n: 13, locale: "en", expected: "13" },
    { slug: "consistency_streak", n: 12_500, locale: "en", expected: "12.5K" },
  ] as const)(
    "compacts $slug $n ($locale) to $expected",
    ({ slug, n, locale, expected }) => {
      const label = formatBadgePerformance(
        makeBadge({
          tier_id: `${slug}-${n}-${locale}`,
          title_en: "Feat",
          group_slug: slug,
          threshold_value: n,
        }),
        locale,
      )
      expect(label).toBe(expected)
      expect(label).not.toMatch(/1[ \u00A0\u202F]?000[ \u00A0\u202F]?000/)
      expect(label?.length).toBeLessThanOrEqual(PERFORMANCE_MAX_CHARS)
    },
  )

  it("still shows the threshold for a locked row, not current_value", () => {
    expect(
      formatBadgePerformance(
        makeBadge({
          tier_id: "locked",
          title_en: "Locked Silver",
          group_slug: "push_ups",
          threshold_value: 500,
          current_value: 120,
          is_unlocked: false,
          granted_at: null,
        }),
        "en",
      ),
    ).toBe("500")
  })
})
