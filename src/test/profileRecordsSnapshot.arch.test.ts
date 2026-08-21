import { describe, expect, it } from "vitest"

const recordsSources = import.meta.glob(
  "../{lib/profile/prPairs.ts,lib/profile/rir0.ts,lib/profile/records.ts,components/profile/RecordsBlock.tsx,pages/ProfilePage.tsx}",
  {
    query: "?raw",
    eager: true,
    import: "default",
  },
)

describe("profile Records source", () => {
  it("counts Profil PRs from snapshot was_pr, not get_cycle_stats", () => {
    const files = Object.entries(recordsSources)
    expect(files.length).toBe(5)

    const offenders = files.filter(([, source]) => {
      if (typeof source !== "string") return true
      return source.includes("get_cycle_stats") || source.includes("useCycleStats")
    })
    expect(offenders.map(([path]) => path)).toEqual([])

    const pairs = files.find(([path]) => path.includes("prPairs.ts"))
    expect(typeof pairs?.[1]).toBe("string")
    if (typeof pairs?.[1] !== "string") return
    expect(pairs[1]).toContain("was_pr")
  })
})
