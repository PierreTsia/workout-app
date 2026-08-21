import { describe, expect, it } from "vitest"
import { MIX_SLICE_SQL } from "@/lib/profile/mixSlice"

const migrations = import.meta.glob("../../supabase/migrations/*.sql", {
  query: "?raw",
  eager: true,
  import: "default",
})

function rollupSql(): string {
  const hit = Object.entries(migrations).find(
    ([path, sql]) =>
      path.includes("all_time_rollups") &&
      typeof sql === "string" &&
      sql.includes("get_profile_all_time_rollups"),
  )
  if (typeof hit?.[1] !== "string") {
    throw new Error("missing get_profile_all_time_rollups migration")
  }
  return hit[1]
}

describe("profile all-time rollup SQL", () => {
  it("ships both RPCs as SECURITY INVOKER scoped to auth.uid()", () => {
    const sql = rollupSql()
    expect(sql).toMatch(/SECURITY\s+INVOKER/i)
    expect(sql.replace(/--[^\n]*/g, "")).not.toMatch(/SECURITY\s+DEFINER/i)
    expect(sql).toMatch(/user_id\s*=\s*auth\.uid\s*\(\s*\)/i)
    expect(sql).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+.*get_profile_all_time_rollups/i)
    expect(sql).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+.*get_volume_by_muscle_group_all_time/i)
    expect(sql).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+.*get_profile_all_time_rollups/i)
    expect(sql).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+.*get_volume_by_muscle_group_all_time/i)
  })

  it("keeps Mix SQL precedence identical to MIX_SLICE_SQL / mixSlice", () => {
    const sql = rollupSql()
    expect(sql).toContain("WHEN has_catalog_circuit THEN 'circuits'")
    expect(sql).toContain("WHEN program_id IS NULL THEN 'quickWorkout'")
    expect(sql).toContain("ELSE 'programme'")
    expect(MIX_SLICE_SQL).toContain("WHEN has_catalog_circuit THEN 'circuits'")
    expect(MIX_SLICE_SQL.indexOf("'circuits'")).toBeLessThan(
      MIX_SLICE_SQL.indexOf("'quickWorkout'"),
    )
    expect(MIX_SLICE_SQL.indexOf("'quickWorkout'")).toBeLessThan(
      MIX_SLICE_SQL.indexOf("'programme'"),
    )
    expect(sql.indexOf("'circuits'")).toBeLessThan(sql.indexOf("'quickWorkout'"))
    expect(sql.indexOf("'quickWorkout'")).toBeLessThan(sql.indexOf("'programme'"))
  })

  it("does not clamp the unbounded volume RPC at 365 days", () => {
    const sql = rollupSql()
    const volumeStart = sql.indexOf("get_volume_by_muscle_group_all_time")
    const volumeBody = sql.slice(volumeStart)
    expect(volumeBody).not.toContain("LEAST(GREATEST(p_days, 1), 365)")
    expect(volumeBody).not.toContain("make_interval")
  })
})

const historyVolume = import.meta.glob("../../supabase/migrations/*volume_by_muscle_group.sql", {
  query: "?raw",
  eager: true,
  import: "default",
})

describe("History volume clamp", () => {
  it("leaves get_volume_by_muscle_group capped at 365", () => {
    const hit = Object.entries(historyVolume).find(
      ([, sql]) => typeof sql === "string" && sql.includes("LEAST(GREATEST(p_days, 1), 365)"),
    )
    expect(hit).toBeDefined()
    expect(typeof hit?.[1]).toBe("string")
    if (typeof hit?.[1] !== "string") return
    expect(hit[1]).toContain("LEAST(GREATEST(p_days, 1), 365)")
    expect(hit[1]).not.toContain("get_volume_by_muscle_group_all_time")
  })
})
