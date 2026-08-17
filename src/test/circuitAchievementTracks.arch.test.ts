import { describe, expect, it } from "vitest"
import enAchievements from "@/locales/en/achievements.json"
import frAchievements from "@/locales/fr/achievements.json"

/**
 * #482 / T209 oracle: the circuit achievement migration must seed five tracks
 * and wire identical `qualifying_runs` + metric branches into both RPCs.
 * T210 hardens catalog isolation; this file only pins the SQL/i18n contract.
 */

const migrationSources = import.meta.glob("../../supabase/migrations/*.sql", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

const CIRCUIT_METRICS = [
  "circuit_runner",
  "spidey",
  "olympians",
  "heroes",
  "pantheoniste",
] as const

const OLYMPIAN_SLUGS = ["zeus", "ares", "athena", "hades"] as const
const HERO_SLUGS = ["heracles", "theseus", "atlas", "achilles"] as const

const circuitMigrationEntry = Object.entries(migrationSources).find(([path]) =>
  path.includes("circuit_achievement_tracks"),
)

const circuitSql = circuitMigrationEntry?.[1] ?? ""

const extractFunctionBody = (sql: string, name: string): string => {
  const head = new RegExp(
    `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${name}\\s*\\(`,
    "i",
  )
  const start = sql.search(head)
  if (start === -1) return ""
  const open = sql.indexOf("$$", start)
  const close = sql.indexOf("$$", open + 2)
  if (open === -1 || close === -1) return ""
  return sql.slice(open + 2, close)
}

const extractNamedCte = (body: string, cteName: string): string => {
  const marker = `${cteName} AS (`
  const start = body.indexOf(marker)
  if (start === -1) return ""
  let depth = 0
  let i = start + marker.length - 1
  for (; i < body.length; i++) {
    const ch = body[i]
    if (ch === "(") depth += 1
    else if (ch === ")") {
      depth -= 1
      if (depth === 0) return body.slice(start, i + 1)
    }
  }
  return ""
}

const normalizeSql = (sql: string) =>
  sql.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim()

describe("circuit achievement tracks migration (#482 / T209)", () => {
  it("ships a circuit_achievement_tracks migration file", () => {
    expect(circuitMigrationEntry).toBeDefined()
  })

  it("seeds all five metric_type literals and Cast Clearing slug lists", () => {
    expect(circuitSql).toContain("owner_id IS NULL")
    expect(circuitSql).toContain("qualifying_runs")
    expect(
      CIRCUIT_METRICS.every((metric) => circuitSql.includes(`'${metric}'`)),
    ).toBe(true)
    expect(
      [...OLYMPIAN_SLUGS, ...HERO_SLUGS].every((slug) =>
        circuitSql.includes(`'${slug}'`),
      ),
    ).toBe(true)
    expect(circuitSql).toMatch(/LEFT\s+JOIN\s+qualifying_runs/i)
  })

  it("keeps qualifying_runs + circuit metrics identical in both RPCs", () => {
    const grantBody = extractFunctionBody(
      circuitSql,
      "check_and_grant_achievements",
    )
    const statusBody = extractFunctionBody(circuitSql, "get_badge_status")

    expect(grantBody.length).toBeGreaterThan(0)
    expect(statusBody.length).toBeGreaterThan(0)

    const grantRuns = extractNamedCte(grantBody, "qualifying_runs")
    const statusRuns = extractNamedCte(statusBody, "qualifying_runs")
    expect(normalizeSql(grantRuns)).toBe(normalizeSql(statusRuns))
    expect(normalizeSql(grantRuns)).toContain("MAX(sl.set_number) - 1")
    expect(normalizeSql(grantRuns)).toContain("owner_id IS NULL")

    expect(
      CIRCUIT_METRICS.every(
        (metric) =>
          grantBody.includes(`'${metric}'`) &&
          statusBody.includes(`'${metric}'`),
      ),
    ).toBe(true)
  })
})

describe("circuit achievement i18n (#482 / T209)", () => {
  it("exposes groups, groupDescriptions, and thresholdHint for all five slugs", () => {
    const missing = CIRCUIT_METRICS.flatMap((slug) =>
      (
        [
          ["en.groups", enAchievements.groups],
          ["fr.groups", frAchievements.groups],
          ["en.groupDescriptions", enAchievements.groupDescriptions],
          ["fr.groupDescriptions", frAchievements.groupDescriptions],
          ["en.thresholdHint", enAchievements.thresholdHint],
          ["fr.thresholdHint", frAchievements.thresholdHint],
        ] as const
      )
        .filter(([, bag]) => !(slug in bag))
        .map(([label]) => `${label}.${slug}`),
    )

    expect(missing).toEqual([])
  })
})
