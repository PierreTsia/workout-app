import path from "node:path"
import { z } from "zod"

export const RANKS = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
] as const

export type AchievementRank = (typeof RANKS)[number]

export const SLUG_RE = /^[a-z][a-z0-9_]*$/

export const PROD_BADGE_ICON_PUBLIC_BASE =
  "https://favusepjqwpcroiolvaz.supabase.co/storage/v1/object/public/badge-icons"

const rankSchema = z.enum(RANKS)

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const familySchema = z.object({
  cteName: z.string().regex(/^[a-z][a-z0-9_]*$/),
  inUuids: z.array(z.string().regex(UUID_RE)).min(1),
  outUuids: z.array(z.string().regex(UUID_RE)),
})

const tierSchema = z.object({
  rank: rankSchema,
  titleFr: z.string().min(1),
  titleEn: z.string().min(1),
  threshold: z.number().positive(),
})

const groupSchema = z
  .object({
    slug: z.string().regex(SLUG_RE),
    sortOrder: z.number().int().positive(),
    nameFr: z.string().min(1),
    nameEn: z.string().min(1),
    descriptionFr: z.string().min(1),
    descriptionEn: z.string().min(1),
    metricType: z.string().min(1),
    thresholdHintFr: z.string().min(1),
    thresholdHintEn: z.string().min(1),
    playgroundLabel: z.string().min(1),
    family: familySchema.optional(),
    iconSubjects: z.partialRecord(rankSchema, z.string().min(1)).optional(),
    tiers: z.array(tierSchema).length(5),
  })
  .refine(
    (group) => RANKS.every((rank) => group.tiers.some((tier) => tier.rank === rank)),
    { message: "each group needs bronze→diamond exactly once" },
  )

const manifestSchema = z.object({
  issue: z.number().int().positive(),
  stem: z.string().regex(/^[a-z0-9_]+_achievement_tracks$/),
  title: z.string().min(1),
  playgroundMixedLabel: z.string().min(1).optional(),
  groups: z.array(groupSchema).min(1),
})

export type AchievementTrackManifest = z.infer<typeof manifestSchema>
export type AchievementTrackGroup = AchievementTrackManifest["groups"][number]

export const parseManifest = (raw: unknown): AchievementTrackManifest =>
  manifestSchema.parse(raw)

export const parseSlugs = (raw: readonly string[]): string[] => {
  const slugs = raw.map((slug) => slug.trim()).filter(Boolean)
  const invalid = slugs.filter((slug) => !SLUG_RE.test(slug))
  if (invalid.length > 0) {
    throw new Error(`invalid slugs: ${invalid.join(", ")}`)
  }
  return slugs
}

const sqlLit = (value: string): string => `'${value.replaceAll("'", "''")}'`

const sqlCsv = (values: readonly (string | number)[]): string =>
  values
    .map((value) => (typeof value === "number" ? String(value) : sqlLit(value)))
    .join(", ")

const tierLevel = (rank: AchievementRank): number => RANKS.indexOf(rank) + 1

const orderedTiers = (group: AchievementTrackGroup) =>
  RANKS.map((rank) => {
    const tier = group.tiers.find((candidate) => candidate.rank === rank)
    if (!tier) {
      throw new Error(`missing ${rank} tier for ${group.slug}`)
    }
    return tier
  })

export const renderSeedSql = (manifest: AchievementTrackManifest): string => {
  const groupRows = manifest.groups
    .map(
      (group) =>
        `  (${sqlCsv([
          group.slug,
          group.nameFr,
          group.nameEn,
          group.descriptionFr,
          group.descriptionEn,
          group.metricType,
          group.sortOrder,
        ])})`,
    )
    .join(",\n")

  const groupInsert = [
    "INSERT INTO achievement_groups (slug, name_fr, name_en, description_fr, description_en, metric_type, sort_order)",
    "VALUES",
    `${groupRows};`,
  ].join("\n")

  const tierInserts = manifest.groups
    .map((group) => {
      const rows = orderedTiers(group)
        .map(
          (tier) =>
            `  ((SELECT id FROM g), ${tierLevel(tier.rank)}, ${sqlCsv([
              tier.rank,
              tier.titleFr,
              tier.titleEn,
              tier.threshold,
            ])})`,
        )
        .join(",\n")
      return [
        `-- ${group.nameFr}`,
        `WITH g AS (SELECT id FROM achievement_groups WHERE slug = ${sqlLit(group.slug)})`,
        "INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)",
        "VALUES",
        `${rows};`,
      ].join("\n")
    })
    .join("\n\n")

  return [
    `-- =============================================================`,
    `-- ${manifest.title} Achievement Tracks (#${manifest.issue})`,
    `-- Seed only. icon_asset_url NULL. No RPC metric SQL.`,
    `-- Run: npx tsx scripts/achievement-track.ts prepare-rpc --stem=${manifest.stem}`,
    `-- =============================================================`,
    "",
    "-- 1. Seed new achievement groups",
    groupInsert,
    "",
    "-- 2. Seed new achievement tiers. icon_asset_url NULL.",
    "",
    tierInserts,
    "",
    "-- 3. Replace check_and_grant_achievements and get_badge_status.",
    `-- Run: npx tsx scripts/achievement-track.ts prepare-rpc --stem=${manifest.stem}`,
    "-- Copy live bodies, append metric SQL by hand. No DROP. now() not clock_timestamp().",
    "",
  ].join("\n")
}

export type AchievementI18nBag = {
  groups: Record<string, string>
  groupDescriptions: Record<string, string>
  thresholdHint: Record<string, string>
}

export const mergeAchievementI18n = (
  existing: AchievementI18nBag,
  manifest: AchievementTrackManifest,
  locale: "fr" | "en",
): AchievementI18nBag => ({
  ...existing,
  groups: {
    ...existing.groups,
    ...Object.fromEntries(
      manifest.groups.map((group) => [
        group.slug,
        locale === "fr" ? group.nameFr : group.nameEn,
      ]),
    ),
  },
  groupDescriptions: {
    ...existing.groupDescriptions,
    ...Object.fromEntries(
      manifest.groups.map((group) => [
        group.slug,
        locale === "fr" ? group.descriptionFr : group.descriptionEn,
      ]),
    ),
  },
  thresholdHint: {
    ...existing.thresholdHint,
    ...Object.fromEntries(
      manifest.groups.map((group) => [
        group.slug,
        locale === "fr" ? group.thresholdHintFr : group.thresholdHintEn,
      ]),
    ),
  },
})

const MIXED_RANKS = [
  "gold",
  "silver",
  "bronze",
  "platinum",
  "gold",
] as const satisfies readonly AchievementRank[]

const grantCall = (
  rank: AchievementRank,
  slug: string,
  titleEn: string,
  titleFr: string,
  threshold: number,
): string =>
  `grant(${sqlJsString(rank)}, ${sqlJsString(slug)}, ${sqlJsString(titleEn)}, ${sqlJsString(titleFr)}, ${formatThreshold(threshold)}, \`\${ICON_BASE}/${slug}_${rank}.webp\`)`

const sqlJsString = (value: string): string => JSON.stringify(value)

const formatThreshold = (value: number): string =>
  value >= 1000 ? `${String(value).replace(/(\d)(?=(\d{3})+$)/g, "$1_")}` : String(value)

export const mixedButtonLabel = (manifest: AchievementTrackManifest): string =>
  manifest.playgroundMixedLabel ?? `${manifest.title} mixed`

export const renderPlaygroundSnippet = (
  manifest: AchievementTrackManifest,
): string => {
  const [first, ...rest] = manifest.groups
  if (!first) {
    throw new Error("manifest has no groups")
  }

  const ladderButton = `${first.playgroundLabel} ladder`
  const ladder = orderedTiers(first)
    .map((tier) =>
      grantCall(tier.rank, first.slug, tier.titleEn, tier.titleFr, tier.threshold),
    )
    .join(",\n    ")

  const diamondEntries = rest.map((group) => {
    const diamond = orderedTiers(group).at(-1)
    if (!diamond) {
      throw new Error(`missing diamond for ${group.slug}`)
    }
    const button = `${group.playgroundLabel} diamond`
    return [
      `  ${sqlJsString(button)}: () => [`,
      `    ${grantCall(diamond.rank, group.slug, diamond.titleEn, diamond.titleFr, diamond.threshold)},`,
      `  ],`,
    ].join("\n")
  })

  const mixed = manifest.groups
    .map((group, index) => {
      const rank = MIXED_RANKS[index % MIXED_RANKS.length] ?? "gold"
      const tier = orderedTiers(group).find((candidate) => candidate.rank === rank)
      if (!tier) {
        throw new Error(`missing ${rank} for ${group.slug}`)
      }
      return grantCall(tier.rank, group.slug, tier.titleEn, tier.titleFr, tier.threshold)
    })
    .join(",\n    ")

  return [
    `const TRACK_BUTTONS = [`,
    `  ${sqlJsString(ladderButton)},`,
    ...rest.map((group) => `  ${sqlJsString(`${group.playgroundLabel} diamond`)},`),
    `  ${sqlJsString(mixedButtonLabel(manifest))},`,
    `] as const`,
    "",
    `// Paste into FIXTURES. Keep the original ceremony row.`,
    `  ${sqlJsString(ladderButton)}: () => [`,
    `    ${ladder},`,
    `  ],`,
    ...diamondEntries,
    `  ${sqlJsString(mixedButtonLabel(manifest))}: () => [`,
    `    ${mixed},`,
    `  ],`,
  ].join("\n")
}

export const renderRetroStanza = (manifest: AchievementTrackManifest): string =>
  [
    `-- #${manifest.issue} post-migrate runbook:`,
    `-- After applying the ${manifest.title} migration, run this same script`,
    `-- once against the target DB (Supabase SQL Editor / service role). Existing`,
    `-- users catch up on that ops run.`,
  ].join("\n")

const RANK_BACKGROUNDS: Record<AchievementRank, string> = {
  bronze:
    "on a dark radial gradient background from warm copper brown center to near-black edges",
  silver:
    "on a dark radial gradient background from cool steel grey center to near-black edges",
  gold: "on a dark radial gradient background from deep amber gold center to near-black edges",
  platinum:
    "on a dark radial gradient background from deep blue-slate center to near-black edges",
  diamond:
    "on a dark radial gradient background from deep purple indigo center to near-black edges",
}

const PROMPT_SUFFIX =
  "centered composition, game UI icon asset, circular vignette, no border, no frame, no text, high detail, 512×512 PNG"

export const renderIconPromptDoc = (manifest: AchievementTrackManifest): string => {
  const groupSections = manifest.groups
    .map((group) => {
      const rows = RANKS.map((rank) => {
        const subject =
          group.iconSubjects?.[rank] ?? `TODO: subject for ${group.slug} ${rank}`
        return `| ${rank} | ${subject} |`
      }).join("\n")
      return [
        `## ${group.nameFr} (\`${group.slug}\`)`,
        "",
        "| Rank | Subject |",
        "|---|---|",
        rows,
      ].join("\n")
    })
    .join("\n\n")

  return [
    `# Badge Icon Prompts — ${manifest.title} (#${manifest.issue})`,
    "",
    `**Naming:** \`{group_slug}_{rank}.png\` → Storage \`badge-icons/{group_slug}_{rank}.webp\``,
    "**Layout:** FLAT in the `badge-icons` bucket — never nested folders.",
    "**Size:** 512×512 PNG then `npx tsx scripts/achievement-track.ts icons --slugs=… --from=dir`",
    "",
    `HITL of these icons: hidden route **\`/_unlock-overlay\`**. Do not add a gallery route.`,
    "",
    `> **Suffix on every prompt:**`,
    `> \`, ${PROMPT_SUFFIX}\``,
    "",
    "| Rank | Background |",
    "|---|---|",
    ...RANKS.map((rank) => `| ${rank} | \`${RANK_BACKGROUNDS[rank]}\` |`),
    "",
    "---",
    "",
    groupSections,
    "",
  ].join("\n")
}

const toCamel = (value: string): string =>
  value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())

export const archTestFilename = (manifest: AchievementTrackManifest): string => {
  const base = manifest.stem.replace(/_achievement_tracks$/, "")
  return `${toCamel(base)}AchievementTracks.arch.test.ts`
}

export const renderArchTest = (manifest: AchievementTrackManifest): string => {
  const slugs = manifest.groups.map((group) => group.slug)
  const inUuids = manifest.groups.flatMap((group) => group.family?.inUuids ?? [])
  const outUuids = manifest.groups.flatMap((group) => group.family?.outUuids ?? [])
  const cteNames = manifest.groups.flatMap((group) =>
    group.family ? [group.family.cteName] : [],
  )
  const constName = toCamel(manifest.stem.replace(/_achievement_tracks$/, ""))
  const metricsConst = `${constName.toUpperCase()}_METRICS`

  return `import { describe, expect, it } from "vitest"
import enAchievements from "@/locales/en/achievements.json"
import frAchievements from "@/locales/fr/achievements.json"

/**
 * #${manifest.issue}: migration SQL + i18n contract for ${manifest.title} tracks.
 * Generated stub — add metric-class assertions (live chain, min-of-families, …) by hand.
 */

const migrationSources = import.meta.glob("../../supabase/migrations/*.sql", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

const ${metricsConst} = [
${slugs.map((slug) => `  "${slug}",`).join("\n")}
] as const

const FAMILY_IN_UUIDS = [
${inUuids.map((id) => `  "${id}",`).join("\n")}
] as const

const FAMILY_OUT_UUIDS = [
${outUuids.map((id) => `  "${id}",`).join("\n")}
] as const

const FAMILY_CTE_NAMES = [
${cteNames.map((name) => `  "${name}",`).join("\n")}
] as const

const trackMigrationEntry = Object.entries(migrationSources).find(([path]) =>
  path.includes("${manifest.stem}"),
)

const trackSql = trackMigrationEntry?.[1] ?? ""

const extractFunctionBody = (sql: string, name: string): string => {
  const head = new RegExp(
    \`CREATE\\\\s+OR\\\\s+REPLACE\\\\s+FUNCTION\\\\s+\${name}\\\\s*\\\\(\`,
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
  const marker = \`\${cteName} AS (\`
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
  sql.replace(/--[^\\n]*/g, "").replace(/\\s+/g, " ").trim()

const familyArraySql = FAMILY_CTE_NAMES.map((name) =>
  extractNamedCte(trackSql, name),
).join("\\n")

describe("${manifest.title} achievement tracks migration (#${manifest.issue})", () => {
  it("ships a ${manifest.stem} migration file", () => {
    expect(trackMigrationEntry).toBeDefined()
  })

  it("pins family UUIDs, excludes OUT ids, and names the metrics", () => {
    const missingIn = FAMILY_IN_UUIDS.filter((id) => !familyArraySql.includes(id))
    expect(missingIn).toEqual([])

    const sneakedOut = FAMILY_OUT_UUIDS.filter((id) => familyArraySql.includes(id))
    expect(sneakedOut).toEqual([])

    expect(
      ${metricsConst}.every((metric) => trackSql.includes(\`'\${metric}'\`)),
    ).toBe(true)
  })
})

describe("${manifest.title} last-wins (#${manifest.issue})", () => {
  const latestSqlFor = (fnName: string): string =>
    Object.entries(migrationSources)
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([, sql]) =>
        new RegExp(
          \`CREATE\\\\s+OR\\\\s+REPLACE\\\\s+FUNCTION\\\\s+\${fnName}\`,
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
  const latestStatusBody = extractFunctionBody(latestStatusSql, "get_badge_status")

  it("latest grant and status still contain the new metrics and family UUIDs", () => {
    expect(latestGrantBody.length).toBeGreaterThan(0)
    expect(latestStatusBody.length).toBeGreaterThan(0)
    expect(
      ${metricsConst}.every(
        (metric) =>
          latestGrantBody.includes(\`'\${metric}'\`) &&
          latestStatusBody.includes(\`'\${metric}'\`),
      ),
    ).toBe(true)
    expect(
      FAMILY_IN_UUIDS.every(
        (id) => latestGrantBody.includes(id) && latestStatusBody.includes(id),
      ),
    ).toBe(true)
  })
})

describe("${manifest.title} achievement i18n (#${manifest.issue})", () => {
  it("exposes groups, groupDescriptions, and thresholdHint for all slugs", () => {
    const missing = ${metricsConst}.flatMap((slug) =>
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
        .map(([label]) => \`\${label}.\${slug}\`),
    )

    expect(missing).toEqual([])
  })
})
`
}

export type MigrationFile = {
  path: string
  sql: string
}

export const extractCreateOrReplaceFunction = (
  sql: string,
  name: string,
): string => {
  const head = new RegExp(
    `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${name}\\s*\\(`,
    "i",
  )
  const start = sql.search(head)
  if (start === -1) return ""
  const open = sql.indexOf("$$", start)
  if (open === -1) return ""
  const close = sql.indexOf("$$", open + 2)
  if (close === -1) return ""
  const afterDollar = close + 2
  const semicolon = sql.indexOf(";", afterDollar)
  const end = semicolon === -1 ? afterDollar : semicolon + 1
  return sql.slice(start, end)
}

export const latestFunctionSource = (
  files: readonly MigrationFile[],
  fnName: string,
  excludePath: string,
): MigrationFile | null =>
  files
    .filter((file) => file.path !== excludePath)
    .filter((file) =>
      new RegExp(
        `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${fnName}\\s*\\(`,
        "i",
      ).test(file.sql),
    )
    .toSorted((a, b) => a.path.localeCompare(b.path))
    .at(-1) ?? null

const matchingClose = (sql: string, openIdx: number): number => {
  let depth = 0
  for (let i = openIdx; i < sql.length; i++) {
    const ch = sql[i]
    if (ch === "(") depth += 1
    else if (ch === ")") {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

const injectAppendMarkers = (fnSql: string): string => {
  const withCte = fnSql.replaceAll(
    "metrics AS (",
    "-- APPEND CTEs\n  metrics AS (",
  )
  const marker = "metrics AS ("
  const starts = [...withCte.matchAll(/metrics AS \(/g)].map((match) => match.index)
  return starts.reduceRight((sql, start) => {
    const open = start + marker.length - 1
    const close = matchingClose(sql, open)
    if (close === -1) return sql
    return `${sql.slice(0, close)}\n    -- APPEND UNION ALL\n  ${sql.slice(close)}`
  }, withCte)
}

const GRANT_BLOCK = `
REVOKE ALL ON FUNCTION check_and_grant_achievements(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_and_grant_achievements(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION get_badge_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_badge_status(uuid) TO authenticated, service_role;
`.trim()

const stripRpcSection = (seedSql: string): string => {
  const marker = "-- 3. Replace"
  const idx = seedSql.indexOf(marker)
  return idx === -1 ? seedSql.trimEnd() : seedSql.slice(0, idx).trimEnd()
}

export const prepareRpcSeed = (
  seedSql: string,
  files: readonly MigrationFile[],
  destPath: string,
  options: { force?: boolean } = {},
): string => {
  const alreadyHasRpc =
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+check_and_grant_achievements/i.test(
      seedSql,
    )
  if (alreadyHasRpc && !options.force) {
    throw new Error(
      "seed already has RPC bodies; pass --force to recopy from the previous latest (this DROPS hand-written metric SQL)",
    )
  }

  const grantSrc = latestFunctionSource(
    files,
    "check_and_grant_achievements",
    destPath,
  )
  const statusSrc = latestFunctionSource(files, "get_badge_status", destPath)
  if (!grantSrc || !statusSrc) {
    throw new Error("could not find live achievement RPC bodies to copy")
  }

  const grantFn = extractCreateOrReplaceFunction(
    grantSrc.sql,
    "check_and_grant_achievements",
  )
  const statusFn = extractCreateOrReplaceFunction(statusSrc.sql, "get_badge_status")
  if (!grantFn || !statusFn) {
    throw new Error("failed to extract CREATE OR REPLACE bodies")
  }

  return [
    stripRpcSection(seedSql),
    "",
    "-- 3. Replace check_and_grant_achievements",
    `-- Copied from ${path.basename(grantSrc.path)}. Append family CTEs at -- APPEND CTEs.`,
    `-- Append metric UNION ALL branches at -- APPEND UNION ALL. No DROP.`,
    "",
    injectAppendMarkers(grantFn),
    "",
    "-- 4. Replace get_badge_status",
    `-- Copied from ${path.basename(statusSrc.path)}. Same markers. Keep grant/status CTEs identical.`,
    "",
    injectAppendMarkers(statusFn),
    "",
    GRANT_BLOCK,
    "",
  ].join("\n")
}

export const renderIconUrlMigration = (
  slugs: readonly string[],
  publicBase: string = PROD_BADGE_ICON_PUBLIC_BASE,
): string => {
  const inList = slugs.map((slug) => `    ${sqlLit(slug)}`).join(",\n")
  return [
    "-- Wire production badge-icon WebP URLs.",
    "-- Storage objects live in the public `badge-icons` bucket (FLAT `{slug}_{rank}.webp`).",
    "-- Does not replace RPC bodies.",
    "",
    "UPDATE achievement_tiers AS t",
    "SET icon_asset_url = format(",
    `  '${publicBase}/%s_%s.webp',`,
    "  g.slug,",
    "  t.rank",
    ")",
    "FROM achievement_groups AS g",
    "WHERE t.group_id = g.id",
    "  AND g.slug IN (",
    inList,
    "  );",
    "",
  ].join("\n")
}

export type IconAssetPlan = {
  slug: string
  rank: AchievementRank
  pngName: string
  webpName: string
  sourcePath: string
}

export const planIconAssets = (
  slugs: readonly string[],
  fromDir: string,
): IconAssetPlan[] =>
  slugs.flatMap((slug) =>
    RANKS.map((rank) => ({
      slug,
      rank,
      pngName: `${slug}_${rank}.png`,
      webpName: `${slug}_${rank}.webp`,
      sourcePath: path.join(fromDir, `${slug}_${rank}.png`),
    })),
  )

export const formatMigrationTimestamp = (date: Date): string => {
  const pad = (value: number, size = 2): string => String(value).padStart(size, "0")
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join("")
}

export const nextMigrationTimestamp = (
  existingFilenames: readonly string[],
  now: Date,
): string => {
  const fromNow = formatMigrationTimestamp(now)
  const latest = existingFilenames
    .map((name) => name.slice(0, 14))
    .filter((stamp) => /^\d{14}$/.test(stamp))
    .toSorted()
    .at(-1)
  if (!latest || fromNow > latest) return fromNow
  return String(Number(latest) + 1).padStart(14, "0")
}

export const seedMigrationFilename = (
  timestamp: string,
  stem: string,
): string => `${timestamp}_${stem}.sql`

export const iconMigrationFilename = (
  timestamp: string,
  stem: string,
): string => `${timestamp}_${stem.replace(/_achievement_tracks$/, "")}_badge_icon_urls.sql`
