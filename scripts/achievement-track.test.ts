import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  mergeAchievementI18n,
  parseManifest,
  planIconAssets,
  prepareRpcSeed,
  renderArchTest,
  renderIconPromptDoc,
  renderIconUrlMigration,
  renderPlaygroundSnippet,
  renderRetroStanza,
  renderSeedSql,
} from "./achievement-track-lib.js"

const FIXTURE_PATH = path.join(
  import.meta.dirname,
  "fixtures/bodyweight-trinity-509.manifest.json",
)

const T220_PATH = path.join(
  import.meta.dirname,
  "../supabase/migrations/20260820220000_bodyweight_trinity_achievement_tracks.sql",
)

const T223_PATH = path.join(
  import.meta.dirname,
  "../supabase/migrations/20260820230000_bodyweight_trinity_badge_icon_urls.sql",
)

const normalizeSql = (sql: string) =>
  sql.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim()

const load509 = () =>
  parseManifest(JSON.parse(readFileSync(FIXTURE_PATH, "utf8")))

describe("parseManifest", () => {
  it("rejects a group that is missing a rank", () => {
    const valid = load509()
    const [first, ...rest] = valid.groups
    if (!first) throw new Error("fixture has no groups")
    const broken = {
      ...valid,
      groups: [{ ...first, tiers: first.tiers.slice(0, 4) }, ...rest],
    }

    expect(() => parseManifest(broken)).toThrow()
  })
})

describe("renderSeedSql (#509 replay)", () => {
  it("emits T220 group + tier INSERTs, escaped apostrophes, and no RPC bodies", () => {
    const generated = renderSeedSql(load509())
    const t220 = readFileSync(T220_PATH, "utf8")
    const t220Seed = t220.slice(0, t220.indexOf("-- 3. Replace"))

    expect(normalizeSql(generated)).toContain(normalizeSql(t220Seed))
    expect(generated).toContain("Cul vers l''herbe")
    expect(generated).toContain("Jours d''affilée")
    expect(generated).not.toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION/i)
    expect(generated).not.toMatch(/UNION\s+ALL/i)
    expect(generated).not.toMatch(
      /INSERT INTO achievement_tiers \([^)]*icon_asset_url/i,
    )
  })
})

describe("mergeAchievementI18n", () => {
  it("writes groups, groupDescriptions, and thresholdHint for every slug", () => {
    const existing = {
      groups: { volume_king: "Volume" },
      groupDescriptions: { volume_king: "Total volume" },
      thresholdHint: { volume_king: "Lift {{target}}" },
    }
    const fr = mergeAchievementI18n(existing, load509(), "fr")
    const en = mergeAchievementI18n(existing, load509(), "en")

    expect(fr.groups.push_ups).toBe("Pompes")
    expect(en.groups.hundred_a_day).toBe("Hard Time")
    expect(fr.groupDescriptions.bw_expert).toBe("Min. des trois familles")
    expect(en.thresholdHint.pull_ups).toBe("Accumulate {{target}} pull-ups")
    expect(fr.groups.volume_king).toBe("Volume")
  })
})

describe("renderArchTest", () => {
  it("pins IN/OUT UUIDs and last-wins, and does not invent metric SQL", () => {
    const src = renderArchTest(load509())
    expect(src).toContain("e63fe427-e910-4e0d-9f73-c51d85b36a3f")
    expect(src).toContain("af2cc5d5-b63d-44dc-aedc-366b6733873a")
    expect(src).toContain("bodyweight_trinity_achievement_tracks")
    expect(src).toContain("last-wins")
    expect(src).toContain("thresholdHint")
    expect(src).not.toMatch(/MAX\s*\(\s*streak_len/)
    expect(src).not.toMatch(/\bLEAST\s*\(/)
    expect(src).not.toContain("hundred_a_day_current")
  })
})

describe("renderPlaygroundSnippet", () => {
  it("emits Pompes ladder, other diamonds, and BW mixed", () => {
    const snippet = renderPlaygroundSnippet(load509())
    expect(snippet).toContain("Pompes ladder")
    expect(snippet).toContain("Tractions diamond")
    expect(snippet).toContain("Hard Time diamond")
    expect(snippet).toContain("BW mixed")
    expect(snippet).toContain("push_ups_bronze.webp")
    expect(snippet).toContain("King of the Bar")
    expect(snippet).not.toContain("Pompes diamond")
  })
})

describe("renderRetroStanza", () => {
  it("names the issue and tells ops to reuse the existing script", () => {
    const stanza = renderRetroStanza(load509())
    expect(stanza).toContain("#509")
    expect(stanza).toContain("Bodyweight Trinity")
    expect(stanza).toContain("this same script")
  })
})

describe("renderIconPromptDoc", () => {
  it("locks FLAT storage naming, not nested folders", () => {
    const doc = renderIconPromptDoc(load509())
    expect(doc).toContain("badge-icons/{group_slug}_{rank}.webp")
    expect(doc).toContain("FLAT")
    expect(doc).not.toContain("badge-icons/{group_slug}/{rank}")
    expect(doc).not.toContain("optimize-badge-icons.ts")
  })
})

describe("prepareRpcSeed", () => {
  const grantSql = `CREATE OR REPLACE FUNCTION check_and_grant_achievements(p_user_id uuid)
RETURNS TABLE (tier_id uuid)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH user_sessions AS (
    SELECT 1 AS id
  ),
  metrics AS (
    SELECT 'session_count' AS metric_type, 1::numeric AS value
  )
  SELECT 1;
END;
$$;`

  const statusSql = grantSql.replaceAll(
    "check_and_grant_achievements",
    "get_badge_status",
  )

  it("copies live bodies with APPEND markers, GRANT, and no DROP", () => {
    const seed = renderSeedSql(load509())
    const prepared = prepareRpcSeed(
      seed,
      [
        { path: "supabase/migrations/20260101000000_grant.sql", sql: grantSql },
        { path: "supabase/migrations/20260101000001_status.sql", sql: statusSql },
        {
          path: "supabase/migrations/20990101000000_bodyweight_trinity_achievement_tracks.sql",
          sql: "CREATE OR REPLACE FUNCTION check_and_grant_achievements(p_user_id uuid) AS $$ SELECT 1 $$;",
        },
      ],
      "supabase/migrations/20990101000000_bodyweight_trinity_achievement_tracks.sql",
    )

    expect(prepared).toContain("SELECT 'session_count'")
    expect(prepared).toContain("-- APPEND CTEs")
    expect(prepared).toContain("-- APPEND UNION ALL")
    expect(prepared).toContain(
      "GRANT EXECUTE ON FUNCTION check_and_grant_achievements",
    )
    expect(prepared).toContain("GRANT EXECUTE ON FUNCTION get_badge_status")
    expect(prepared).not.toMatch(/DROP\s+FUNCTION/i)
    expect(prepared).not.toContain("SELECT 1 $$")
  })
})

describe("renderIconUrlMigration", () => {
  it("matches the T223 UPDATE shape and does not rewrite RPCs", () => {
    const sql = renderIconUrlMigration([
      "push_ups",
      "pull_ups",
      "bw_squats",
      "bw_expert",
      "hundred_a_day",
    ])
    const t223 = readFileSync(T223_PATH, "utf8")

    expect(normalizeSql(sql)).toContain(
      normalizeSql(t223).replace(/^wire production.*?urls?\. /i, ""),
    )
    expect(sql).toContain("%s_%s.webp")
    expect(sql).not.toMatch(/CREATE\s+OR\s+REPLACE/i)
  })
})

describe("planIconAssets", () => {
  it("plans flat {slug}_{rank} PNG/WebP pairs from a directory", () => {
    const planned = planIconAssets(["push_ups", "pull_ups"], "/tmp/icons")
    expect(planned).toHaveLength(10)
    expect(planned[0]).toEqual({
      slug: "push_ups",
      rank: "bronze",
      pngName: "push_ups_bronze.png",
      webpName: "push_ups_bronze.webp",
      sourcePath: path.join("/tmp/icons", "push_ups_bronze.png"),
    })
  })
})
