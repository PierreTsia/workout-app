import { describe, expect, it } from "vitest"
import enAchievements from "@/locales/en/achievements.json"
import frAchievements from "@/locales/fr/achievements.json"

/**
 * #509 / T220: migration SQL + i18n contract for Bodyweight Trinity tracks.
 */

const migrationSources = import.meta.glob("../../supabase/migrations/*.sql", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

const BODYWEIGHT_METRICS = [
  "push_ups",
  "pull_ups",
  "bw_squats",
  "bw_expert",
  "hundred_a_day",
] as const

const FAMILY_IN_UUIDS = [
  "e63fe427-e910-4e0d-9f73-c51d85b36a3f",
  "5c7e172f-6c33-46cc-9886-4c31287623a8",
  "de827afb-d91b-400a-bd5f-415beca277df",
  "4a1a7219-bd91-4d59-9d73-2c30c5d9f0ce",
  "92d8460a-b5c6-449a-9659-004a7ee9565c",
  "01babef5-3139-4f37-b23f-88ef8d40279d",
  "426a5c8a-60bd-456c-b5c9-9bf92913f089",
  "6b46d77b-1291-44b9-9d40-f4da8930ae17",
  "261dca1e-9bae-4098-8676-6169597f9964",
  "00731099-9e50-4c90-a92e-0b4433881125",
  "5c0d0e9c-2118-4be4-a90b-31239029b7a3",
  "3ce11aeb-966e-4168-b744-902b7d357cfe",
  "366e1372-4fa0-40c4-816c-6fa83aa2c53d",
  "a3de462c-9cb9-4a59-ae31-11fbb842895b",
  "41de0558-c044-4f90-b112-2b09c16e985c",
  "f1c88f28-8742-4862-985d-0752deca3675",
  "24e5654d-8414-4df6-b928-d2a4f6974d22",
  "473523ed-8ef9-493e-8e33-660de7979a7a",
  "113d352b-5f40-46ad-9d43-a1f5c9f33934",
  "4abd9a5f-78ed-4772-bf3d-153cccc7cb65",
] as const

const FAMILY_OUT_UUIDS = [
  "af2cc5d5-b63d-44dc-aedc-366b6733873a",
  "9dd1bc26-5d88-4744-9543-18477885d0f4",
  "13a23234-1be6-4849-9a95-353ec25dc8fc",
  "1eb9e156-c832-4372-945b-b1902d3822d6",
  "01807007-7465-4a5f-8155-e0eff0dc10da",
  "6f2c8b23-2ac7-4e10-be50-82fc633c68a3",
  "96a9ad05-192e-4e20-878f-90a153efa4d8",
  "ffa0994b-a4a2-492f-b718-23d8bb795549",
  "873f87b6-2eea-47e7-882e-7665b2f20a26",
] as const

const FAMILY_CTE_NAMES = ["push_up_ids", "pull_up_ids", "bw_squat_ids"] as const

const bodyweightMigrationEntry = Object.entries(migrationSources).find(
  ([path]) => path.includes("bodyweight_trinity_achievement_tracks"),
)

const bodyweightSql = bodyweightMigrationEntry?.[1] ?? ""

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

const familyArraySql = FAMILY_CTE_NAMES.map((name) =>
  extractNamedCte(bodyweightSql, name),
).join("\n")

describe("bodyweight trinity achievement tracks migration (#509 / T220)", () => {
  it("ships a bodyweight_trinity_achievement_tracks migration file", () => {
    expect(bodyweightMigrationEntry).toBeDefined()
  })

  it("pins 20 family UUIDs, excludes 9 OUT ids from the three ARRAYs, and names five metrics", () => {
    const missingIn = FAMILY_IN_UUIDS.filter(
      (id) => !familyArraySql.includes(id),
    )
    expect(missingIn).toEqual([])

    const sneakedOut = FAMILY_OUT_UUIDS.filter((id) =>
      familyArraySql.includes(id),
    )
    expect(sneakedOut).toEqual([])
    expect(
      FAMILY_CTE_NAMES.every(
        (name) => extractNamedCte(bodyweightSql, name).length > 0,
      ),
    ).toBe(true)

    expect(
      BODYWEIGHT_METRICS.every((metric) =>
        bodyweightSql.includes(`'${metric}'`),
      ),
    ).toBe(true)
  })

  it("keeps family CTEs and hundred_a_day_current identical in both RPCs", () => {
    const grantBody = extractFunctionBody(
      bodyweightSql,
      "check_and_grant_achievements",
    )
    const statusBody = extractFunctionBody(bodyweightSql, "get_badge_status")

    expect(grantBody.length).toBeGreaterThan(0)
    expect(statusBody.length).toBeGreaterThan(0)

    const parityCtes = [
      "family_rep_totals",
      "push_up_ids",
      "pull_up_ids",
      "bw_squat_ids",
      "qualifying_push_days",
      "hundred_a_day_current",
    ] as const

    parityCtes.forEach((cteName) => {
      const grantCte = normalizeSql(extractNamedCte(grantBody, cteName))
      const statusCte = normalizeSql(extractNamedCte(statusBody, cteName))
      expect(grantCte.length).toBeGreaterThan(0)
      expect(grantCte).toBe(statusCte)
    })
  })

  it("uses a live hundred_a_day chain with yesterday grace, not MAX(streak_len)", () => {
    const grantBody = extractFunctionBody(
      bodyweightSql,
      "check_and_grant_achievements",
    )
    const statusBody = extractFunctionBody(bodyweightSql, "get_badge_status")
    const grantCurrent = extractNamedCte(grantBody, "hundred_a_day_current")
    const statusCurrent = extractNamedCte(statusBody, "hundred_a_day_current")

    expect(grantCurrent.length).toBeGreaterThan(0)
    expect(normalizeSql(grantCurrent)).toBe(normalizeSql(statusCurrent))
    expect(grantCurrent).toMatch(/BETWEEN/i)
    expect(grantCurrent).toMatch(/::date\s*-\s*1/)
    expect(grantCurrent).not.toMatch(/MAX\s*\(\s*streak_len\s*\)/i)
    expect(statusCurrent).not.toMatch(/MAX\s*\(\s*streak_len\s*\)/i)
  })
})

describe("bodyweight trinity last-wins (#509 / T220)", () => {
  const latestSqlFor = (fnName: string): string =>
    Object.entries(migrationSources)
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([, sql]) =>
        new RegExp(
          `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${fnName}`,
          "i",
        ).test(sql),
      )
      .at(-1)?.[1] ?? ""

  const latestGrantSql = latestSqlFor("check_and_grant_achievements")
  const latestStatusSql = latestSqlFor("get_badge_status")
  const latestGrantBody = extractFunctionBody(
    latestGrantSql,
    "check_and_grant_achievements",
  )
  const latestStatusBody = extractFunctionBody(
    latestStatusSql,
    "get_badge_status",
  )

  it("latest grant and status still contain the five metrics and 20 family UUIDs", () => {
    expect(latestGrantBody.length).toBeGreaterThan(0)
    expect(latestStatusBody.length).toBeGreaterThan(0)
    expect(
      BODYWEIGHT_METRICS.every(
        (metric) =>
          latestGrantBody.includes(`'${metric}'`) &&
          latestStatusBody.includes(`'${metric}'`),
      ),
    ).toBe(true)
    expect(
      FAMILY_IN_UUIDS.every(
        (id) =>
          latestGrantBody.includes(id) && latestStatusBody.includes(id),
      ),
    ).toBe(true)
  })
})

describe("bodyweight trinity achievement i18n (#509 / T220)", () => {
  it("exposes groups, groupDescriptions, and thresholdHint for all five slugs", () => {
    const missing = BODYWEIGHT_METRICS.flatMap((slug) =>
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
