/**
 * Scaffold / prepare / upload achievement tracks.
 *
 *   npx tsx scripts/achievement-track.ts scaffold path/to/track.json
 *   npx tsx scripts/achievement-track.ts prepare-rpc --stem=foo_achievement_tracks
 *   npx tsx scripts/achievement-track.ts icons --from=dir --slugs=a,b [--apply]
 *
 * Does not generate RPC metric SQL. See .cursor/skills/new-achievement-track/
 */
import { access, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"
import {
  archTestFilename,
  iconMigrationFilename,
  nextMigrationTimestamp,
  parseManifest,
  parseSlugs,
  planIconAssets,
  prepareRpcSeed,
  renderArchTest,
  renderIconPromptDoc,
  renderIconUrlMigration,
  renderPlaygroundSnippet,
  renderRetroStanza,
  renderSeedSql,
  seedMigrationFilename,
  type AchievementI18nBag,
  type AchievementTrackManifest,
  type IconAssetPlan,
  type MigrationFile,
  mergeAchievementI18n,
} from "./achievement-track-lib.js"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const USAGE = `Usage:
  npx tsx scripts/achievement-track.ts scaffold <manifest.json> [--dry-run] [--force]
  npx tsx scripts/achievement-track.ts prepare-rpc --stem=<stem> [--dry-run] [--force]
  npx tsx scripts/achievement-track.ts icons --from=<dir> (--slugs=a,b | --manifest=<json>) [--apply] [--dry-run]

scaffold writes seed SQL + i18n + arch stub + prompt doc + playground snippet.
prepare-rpc copies live RPC bodies into the seed migration (no metric SQL).
icons writes the UPDATE icon_asset_url migration; --apply uploads FLAT webp to Storage.
`

const flagValue = (name: string): string | undefined => {
  const prefix = `--${name}=`
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}

const hasFlag = (name: string): boolean => process.argv.includes(`--${name}`)

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const localeBagsSchema = z.object({
  groups: z.record(z.string(), z.string()),
  groupDescriptions: z.record(z.string(), z.string()),
  thresholdHint: z.record(z.string(), z.string()),
})

const die = (message: string): never => {
  console.error(message)
  process.exit(1)
}

const required = (value: string | undefined, message: string): string => {
  if (value) return value
  return die(message)
}

const exists = async (filePath: string): Promise<boolean> =>
  access(filePath).then(
    () => true,
    () => false,
  )

const writeText = async (
  filePath: string,
  contents: string,
  dryRun: boolean,
): Promise<void> => {
  console.log(`${dryRun ? "would write" : "write"} ${path.relative(repoRoot, filePath)}`)
  if (dryRun) return
  await writeFile(filePath, contents.endsWith("\n") ? contents : `${contents}\n`)
}

const loadManifest = async (filePath: string): Promise<AchievementTrackManifest> => {
  const raw: unknown = JSON.parse(await readFile(filePath, "utf8"))
  return parseManifest(raw)
}

const listMigrationFiles = async (): Promise<string[]> =>
  (await readdir(path.join(repoRoot, "supabase/migrations"))).filter((name) =>
    name.endsWith(".sql"),
  )

const readMigrationFiles = async (): Promise<MigrationFile[]> => {
  const dir = path.join(repoRoot, "supabase/migrations")
  const names = await listMigrationFiles()
  return Promise.all(
    names.map(async (name) => ({
      path: path.join(dir, name),
      sql: await readFile(path.join(dir, name), "utf8"),
    })),
  )
}

const mergeLocaleFile = async (
  locale: "fr" | "en",
  manifest: AchievementTrackManifest,
  dryRun: boolean,
): Promise<void> => {
  const filePath = path.join(repoRoot, `src/locales/${locale}/achievements.json`)
  const rawUnknown: unknown = JSON.parse(await readFile(filePath, "utf8"))
  if (!isObject(rawUnknown)) {
    throw new Error(`invalid locale file: ${filePath}`)
  }
  const bags = localeBagsSchema.parse(rawUnknown)
  const merged: AchievementI18nBag = mergeAchievementI18n(bags, manifest, locale)
  const next = {
    ...rawUnknown,
    groups: merged.groups,
    groupDescriptions: merged.groupDescriptions,
    thresholdHint: merged.thresholdHint,
  }
  await writeText(filePath, `${JSON.stringify(next, null, 2)}\n`, dryRun)
}

const promptDocPath = (manifest: AchievementTrackManifest): string => {
  const slug = manifest.stem
    .replace(/_achievement_tracks$/, "")
    .replaceAll("_", "-")
  return path.join(
    repoRoot,
    `docs/badge-icon-prompts-${slug}-${manifest.issue}.md`,
  )
}

const runScaffold = async (manifestPath: string): Promise<void> => {
  const dryRun = hasFlag("dry-run")
  const force = hasFlag("force")
  const manifest = await loadManifest(manifestPath)
  const timestamp = nextMigrationTimestamp(await listMigrationFiles(), new Date())
  const seedPath = path.join(
    repoRoot,
    "supabase/migrations",
    seedMigrationFilename(timestamp, manifest.stem),
  )
  const archPath = path.join(repoRoot, "src/test", archTestFilename(manifest))
  const promptsPath = promptDocPath(manifest)
  const snippetPath = path.join(
    repoRoot,
    `docs/playground-snippet-${manifest.stem}.tsx`,
  )

  const guarded = [seedPath, archPath, promptsPath, snippetPath]
  const collisions = await Promise.all(
    guarded.map(async (filePath) =>
      (await exists(filePath)) ? filePath : null,
    ),
  ).then((hits) => hits.filter((filePath) => filePath !== null))

  if (collisions.length > 0 && !force) {
    die(
      `refusing to overwrite:\n${collisions.map((filePath) => `  ${filePath}`).join("\n")}\nPass --force to clobber.`,
    )
  }

  await writeText(seedPath, renderSeedSql(manifest), dryRun)
  await mergeLocaleFile("fr", manifest, dryRun)
  await mergeLocaleFile("en", manifest, dryRun)
  await writeText(archPath, renderArchTest(manifest), dryRun)
  await writeText(promptsPath, renderIconPromptDoc(manifest), dryRun)
  await writeText(snippetPath, renderPlaygroundSnippet(manifest), dryRun)

  console.log("\nAppend this stanza to scripts/retroactive-badge-grant.sql:\n")
  console.log(renderRetroStanza(manifest))
  console.log(`\nNext:
  1. npx tsx scripts/achievement-track.ts prepare-rpc --stem=${manifest.stem}
  2. Hand-write metric SQL at -- APPEND CTEs / -- APPEND UNION ALL (identical in both RPCs)
  3. Paste ${path.relative(repoRoot, snippetPath)} into UnlockOverlayPlaygroundPage.tsx
  4. Do NOT generate UNION ALL from this CLI
`)
}

const runPrepareRpc = async (): Promise<void> => {
  const stem = required(flagValue("stem"), "prepare-rpc requires --stem=foo_achievement_tracks")
  const dryRun = hasFlag("dry-run")
  const dir = path.join(repoRoot, "supabase/migrations")
  const destName = required(
    (await listMigrationFiles())
      .filter((name) => name.endsWith(`_${stem}.sql`))
      .toSorted()
      .at(-1),
    `no seed migration matching *_${stem}.sql — run scaffold first`,
  )
  const destPath = path.join(dir, destName)
  const seedSql = await readFile(destPath, "utf8")
  const files = await readMigrationFiles()
  const prepared = prepareRpcSeed(seedSql, files, destPath, {
    force: hasFlag("force"),
  })
  await writeText(destPath, prepared, dryRun)
  console.log(
    "\nNow append metric SQL at -- APPEND CTEs and -- APPEND UNION ALL. Keep grant/status identical. No DROP.",
  )
}

const resolveSlugs = async (): Promise<string[]> => {
  const fromFlag = flagValue("slugs")
  if (fromFlag) {
    return parseSlugs(fromFlag.split(","))
  }
  const manifestPath = flagValue("manifest")
  const manifest = await loadManifest(
    required(manifestPath, "icons requires --slugs=a,b or --manifest=path.json"),
  )
  return manifest.groups.map((group) => group.slug)
}

const uploadIcons = async (assets: IconAssetPlan[]): Promise<void> => {
  await import("./load-env.js")
  const [{ createClient }, sharpMod] = await Promise.all([
    import("@supabase/supabase-js"),
    import("sharp"),
  ])
  const sharp = sharpMod.default
  const supabaseUrl = required(
    process.env.VITE_SUPABASE_URL?.trim(),
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (use --no-env-local for prod)",
  )
  const serviceKey = required(
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (use --no-env-local for prod)",
  )
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  await assets.reduce(
    (prev, asset) =>
      prev.then(async () => {
        const pngBuffer = await readFile(asset.sourcePath)
        const webpBuffer = await sharp(pngBuffer)
          .resize(256, 256, { fit: "cover" })
          .webp({ quality: 80 })
          .toBuffer()
        console.log(`  upload ${asset.pngName} + ${asset.webpName}`)
        const pngErr = (
          await supabase.storage.from("badge-icons").upload(asset.pngName, pngBuffer, {
            contentType: "image/png",
            upsert: true,
          })
        ).error
        if (pngErr) throw new Error(`Upload PNG ${asset.pngName}: ${pngErr.message}`)
        const webpErr = (
          await supabase.storage
            .from("badge-icons")
            .upload(asset.webpName, webpBuffer, {
              contentType: "image/webp",
              upsert: true,
            })
        ).error
        if (webpErr) {
          throw new Error(`Upload WebP ${asset.webpName}: ${webpErr.message}`)
        }
      }),
    Promise.resolve(),
  )
}

const runIcons = async (): Promise<void> => {
  const fromDir = required(
    flagValue("from"),
    "icons requires --from=<dir> of `{slug}_{rank}.png` files",
  )
  const dryRun = hasFlag("dry-run")
  const apply = hasFlag("apply")
  const slugs = await resolveSlugs()
  if (slugs.length === 0) die("no slugs")

  const assets = planIconAssets(slugs, fromDir)
  const missing = await Promise.all(
    assets.map(async (asset) =>
      (await exists(asset.sourcePath)) ? null : asset.sourcePath,
    ),
  ).then((hits) => hits.filter((filePath) => filePath !== null))
  if (missing.length > 0) {
    die(`missing source PNGs:\n${missing.map((filePath) => `  ${filePath}`).join("\n")}`)
  }

  const timestamp = nextMigrationTimestamp(await listMigrationFiles(), new Date())
  const manifestPath = flagValue("manifest")
  const stemHint = required(
    flagValue("stem") ??
      (manifestPath ? (await loadManifest(manifestPath)).stem : undefined),
    "icons requires --stem= or --manifest= for the migration filename",
  )
  const sqlPath = path.join(
    repoRoot,
    "supabase/migrations",
    iconMigrationFilename(timestamp, stemHint),
  )
  await writeText(sqlPath, renderIconUrlMigration(slugs), dryRun)

  console.log(
    `\n${apply ? "UPLOADING" : dryRun ? "DRY RUN" : "planned"} ${assets.length} PNG+WebP → badge-icons (FLAT names)`,
  )
  if (!apply) {
    assets.forEach((asset) => console.log(`  ${asset.pngName} → ${asset.webpName}`))
    console.log("\nRe-run with --apply to upload. Do not UPDATE live rows — the migration is the source of truth.")
    return
  }
  if (dryRun) die("--apply and --dry-run are mutually exclusive")
  await uploadIcons(assets)
  console.log("\nUpload done. Apply the URL migration after the seed+RPC migration.")
}

const command = process.argv[2]
const manifestArg = process.argv[3]

const main = async () => {
  if (command === "scaffold") {
    if (!manifestArg || manifestArg.startsWith("--")) die(USAGE)
    await runScaffold(manifestArg)
    return
  }
  if (command === "prepare-rpc") {
    await runPrepareRpc()
    return
  }
  if (command === "icons") {
    await runIcons()
    return
  }
  die(USAGE)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
