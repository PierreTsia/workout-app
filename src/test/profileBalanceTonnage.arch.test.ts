import { describe, expect, it } from "vitest"

const sources = import.meta.glob(
  "../{lib/profile/balance.ts,lib/profile/tonnage.ts,components/profile/BalanceTonnageRow.tsx,hooks/useVolumeDistribution.ts,pages/ProfilePage.tsx}",
  {
    query: "?raw",
    eager: true,
    import: "default",
  },
)

describe("profile Équilibre + Tonnage sources", () => {
  it("does not import History BalanceTab or raise the 365 volume clamp", () => {
    const files = Object.entries(sources)
    expect(files.length).toBe(5)

    const offenders = files.filter(([path, source]) => {
      if (typeof source !== "string") return true
      const historyLeak =
        source.includes("BalanceTab") ||
        source.includes("p_days: 366") ||
        source.includes("p_days: 730")
      const unboundedInHistoryHook =
        path.includes("useVolumeDistribution.ts") &&
        source.includes("get_volume_by_muscle_group_all_time")
      return historyLeak || unboundedInHistoryHook
    })
    expect(offenders.map(([path]) => path)).toEqual([])

    const hook = files.find(([path]) => path.includes("useVolumeDistribution.ts"))
    expect(typeof hook?.[1]).toBe("string")
    if (typeof hook?.[1] !== "string") return
    expect(hook[1]).toContain("Math.min(Math.max(days, 1), 365)")
    expect(hook[1]).not.toContain("get_volume_by_muscle_group_all_time")

    const row = files.find(([path]) => path.includes("BalanceTonnageRow.tsx"))
    expect(typeof row?.[1]).toBe("string")
    if (typeof row?.[1] !== "string") return
    expect(row[1]).toContain("useVolumeByMuscleGroupAllTime")
  })

  it("does not sum radar kg for Tonnage", () => {
    const tonnage = Object.entries(sources).find(([path]) =>
      path.includes("lib/profile/tonnage.ts"),
    )
    expect(typeof tonnage?.[1]).toBe("string")
    if (typeof tonnage?.[1] !== "string") return
    expect(tonnage[1]).not.toContain("total_volume_kg")
    expect(tonnage[1]).toContain("weight_logged")
  })
})
