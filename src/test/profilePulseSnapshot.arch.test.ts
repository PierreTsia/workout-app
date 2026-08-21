import { describe, expect, it } from "vitest"

const profileSources = import.meta.glob(
  "../{hooks/useProfileSnapshot.ts,lib/profile/pulse.ts,components/profile/PulseBlock.tsx,pages/ProfilePage.tsx}",
  {
    query: "?raw",
    eager: true,
    import: "default",
  },
)

const migrationSources = import.meta.glob("../../supabase/migrations/*.sql", {
  query: "?raw",
  eager: true,
  import: "default",
})

describe("profile pulse duration source", () => {
  it("does not bind Session time to get_training_activity_by_day.minutes", () => {
    const files = Object.entries(profileSources)
    expect(files.length).toBe(4)

    const offenders = files.filter(([, source]) => {
      if (typeof source !== "string") return true
      return (
        source.includes("useTrainingActivityByDay") ||
        source.includes("get_training_activity_by_day")
      )
    })

    expect(offenders.map(([path]) => path)).toEqual([])

    const pulse = files.find(([path]) => path.includes("pulse.ts"))
    expect(typeof pulse?.[1]).toBe("string")
    if (typeof pulse?.[1] !== "string") return
    expect(pulse[1]).toContain("active_duration_ms")
  })

  it("ships get_profile_snapshot as SECURITY INVOKER scoped to auth.uid()", () => {
    const migration = Object.entries(migrationSources).find(
      ([path, sql]) =>
        path.includes("profile_snapshot") &&
        typeof sql === "string" &&
        sql.includes("get_profile_snapshot"),
    )

    expect(migration).toBeDefined()
    const sql = migration?.[1]
    expect(typeof sql).toBe("string")
    if (typeof sql !== "string") return

    expect(sql).toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+.*get_profile_snapshot/i)
    expect(sql).toMatch(/SECURITY\s+INVOKER/i)
    expect(sql).not.toMatch(/SECURITY\s+DEFINER/i)
    expect(sql).toMatch(/user_id\s*=\s*auth\.uid\s*\(\s*\)/i)
    expect(sql).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+.*get_profile_snapshot/i)
  })
})
