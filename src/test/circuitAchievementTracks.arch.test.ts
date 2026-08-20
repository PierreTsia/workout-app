import { describe, expect, it } from "vitest"
import enAchievements from "@/locales/en/achievements.json"
import frAchievements from "@/locales/fr/achievements.json"
import { importsOf } from "./imports"

/**
 * #482 / T209–T210: migration SQL + i18n contract (T209) and Circuit Catalog
 * isolation from badge chrome (T210 / ADR 0018).
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
    expect(normalizeSql(circuitSql)).toMatch(
      /JOIN\s+benchmark_circuits\s+\w+\s+ON[\s\S]*?owner_id\s+IS\s+NULL/i,
    )
    expect(circuitSql).toContain("qualifying_runs")
    expect(
      CIRCUIT_METRICS.every((metric) => circuitSql.includes(`'${metric}'`)),
    ).toBe(true)
    expect(
      [...OLYMPIAN_SLUGS, ...HERO_SLUGS].every((slug) =>
        circuitSql.includes(`'${slug}'`),
      ),
    ).toBe(true)
    expect(circuitSql).toMatch(
      /unnest\s*\(\s*ARRAY\s*\[\s*'zeus'\s*,\s*'ares'\s*,\s*'athena'\s*,\s*'hades'\s*\]\s*\)/i,
    )
    expect(circuitSql).toMatch(
      /unnest\s*\(\s*ARRAY\s*\[\s*'heracles'\s*,\s*'theseus'\s*,\s*'atlas'\s*,\s*'achilles'\s*\]\s*\)/i,
    )
    expect(circuitSql).toMatch(
      /LEFT\s+JOIN\s+qualifying_runs\s+\w+\s+ON\s+\w+\.slug\s*=/i,
    )
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

/**
 * #491 / T213: overlay threshold copy reads the hero's requirement off the
 * grant row. Last-wins across migrations — a later CREATE OR REPLACE is the
 * live function, same rule as securityDefiner.arch.test.ts.
 */
describe("grant RPC threshold_value (#491 / T213)", () => {
  const latestGrantSql =
    Object.entries(migrationSources)
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([, sql]) =>
        /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+check_and_grant_achievements/i.test(
          sql,
        ),
      )
      .at(-1)?.[1] ?? ""

  const grantStart = latestGrantSql.search(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+check_and_grant_achievements/i,
  )
  const grantHeader = latestGrantSql.slice(
    grantStart,
    latestGrantSql.indexOf("$$", grantStart),
  )
  const grantBody = extractFunctionBody(
    latestGrantSql,
    "check_and_grant_achievements",
  )

  it("drops the existing (uuid) signature before changing RETURNS TABLE", () => {
    // CREATE OR REPLACE cannot change RETURNS TABLE (42P13). Pin to this
    // file — a later body-only replace must not be forced to DROP.
    const thresholdSql =
      Object.entries(migrationSources).find(([path]) =>
        path.includes("grant_achievements_threshold_value"),
      )?.[1] ?? ""
    expect(thresholdSql).toMatch(
      /DROP\s+FUNCTION\s+IF\s+EXISTS\s+check_and_grant_achievements\s*\(\s*uuid\s*\)/i,
    )
  })

  it("latest RETURNS TABLE includes threshold_value numeric", () => {
    expect(grantHeader).toMatch(/threshold_value\s+numeric/i)
  })

  it("eligible and output SELECT project threshold_value", () => {
    expect(grantBody).toMatch(/at\.icon_asset_url,\s*at\.threshold_value/)
    expect(grantBody).toMatch(/e\.icon_asset_url,\s*e\.threshold_value/)
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

/**
 * ADR 0018: Circuit Catalog is encyclopedia under Library — no badge chrome.
 * Badge status / overlay / session badges stay on /achievements and session UI.
 */
const catalogCircuitSources = import.meta.glob(
  [
    "../pages/library/CircuitCatalog*.tsx",
    "../components/library/Circuit*.tsx",
  ],
  {
    query: "?raw",
    eager: true,
    import: "default",
  },
) as Record<string, string>

const CATALOG_BADGE_FORBIDDEN = [
  "useBadgeStatus",
  "SessionBadges",
  "AchievementUnlockOverlay",
  "lastSessionBadgesAtom",
  "achievementUnlockQueueAtom",
] as const

const badgeChromeImports = (source: string): string[] =>
  CATALOG_BADGE_FORBIDDEN.flatMap((token) => {
    const fromSpecifier = importsOf(source, token)
    if (fromSpecifier.length > 0) return fromSpecifier
    return new RegExp(`\\b${token}\\b`).test(source) ? [token] : []
  })

describe("circuit catalog isolation (#482 / T210 / ADR 0018)", () => {
  it("does not import badge status, overlay, or achievement atoms", () => {
    const offenders = Object.entries(catalogCircuitSources)
      .filter(([path]) => !/\.test\.tsx?$/.test(path))
      .flatMap(([path, source]) =>
        badgeChromeImports(source).map((hit) => `${path}: ${hit}`),
      )
      .sort()

    expect(offenders).toEqual([])
  })
})
