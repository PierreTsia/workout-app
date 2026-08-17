/**
 * Upload circuit-track badge PNGs (#482), convert to WebP, update
 * achievement_tiers.icon_asset_url on the target DB.
 *
 * Source PNGs live outside the repo (Cursor assets folder). Storage layout
 * matches existing prod convention: flat `{group_slug}_{rank}.png|.webp`.
 *
 * Usage:
 *   npx tsx scripts/upload-circuit-badge-icons.ts --no-env-local            # dry-run
 *   npx tsx scripts/upload-circuit-badge-icons.ts --no-env-local --apply    # prod
 */
import "./load-env.js"
import { readFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import { createClient } from "@supabase/supabase-js"

const BUCKET = "badge-icons"
const TARGET_SIZE = 256
const WEBP_QUALITY = 80

const GROUPS = [
  "circuit_runner",
  "spidey",
  "olympians",
  "heroes",
  "pantheoniste",
] as const

const RANKS = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
] as const

const ASSETS_DIR =
  "/Users/pierre.tsiakkaros/.cursor/projects/Users-pierre-tsiakkaros-Documents-workout-app/assets"

const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim()
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (use --no-env-local for prod)",
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const dryRun = !process.argv.includes("--apply")

type BadgeAsset = {
  group: (typeof GROUPS)[number]
  rank: (typeof RANKS)[number]
  pngName: string
  webpName: string
  sourcePath: string
}

const assets: BadgeAsset[] = GROUPS.flatMap((group) =>
  RANKS.map((rank) => {
    const pngName = `${group}_${rank}.png`
    return {
      group,
      rank,
      pngName,
      webpName: `${group}_${rank}.webp`,
      sourcePath: path.join(ASSETS_DIR, pngName),
    }
  }),
)

function publicUrl(fileName: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${fileName}`
}

async function uploadPng(asset: BadgeAsset, pngBuffer: Buffer) {
  console.log(`  PNG  ${asset.pngName}  (${(pngBuffer.byteLength / 1024).toFixed(0)} KB)`)
  if (dryRun) return

  const { error } = await supabase.storage.from(BUCKET).upload(asset.pngName, pngBuffer, {
    contentType: "image/png",
    upsert: true,
  })
  if (error) throw new Error(`Upload PNG ${asset.pngName}: ${error.message}`)
}

async function uploadWebp(asset: BadgeAsset, pngBuffer: Buffer) {
  const webpBuffer = await sharp(pngBuffer)
    .resize(TARGET_SIZE, TARGET_SIZE, { fit: "cover" })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()

  const ratio = ((1 - webpBuffer.byteLength / pngBuffer.byteLength) * 100).toFixed(1)
  console.log(
    `  WebP ${asset.webpName}  (${(webpBuffer.byteLength / 1024).toFixed(0)} KB, −${ratio}%)`,
  )
  if (dryRun) return

  const { error } = await supabase.storage.from(BUCKET).upload(asset.webpName, webpBuffer, {
    contentType: "image/webp",
    upsert: true,
  })
  if (error) throw new Error(`Upload WebP ${asset.webpName}: ${error.message}`)
}

async function updateTierUrls() {
  const { data: tiers, error } = await supabase
    .from("achievement_tiers")
    .select("id, rank, icon_asset_url, achievement_groups!inner(slug)")
    .in("achievement_groups.slug", [...GROUPS])

  if (error) throw new Error(`Fetch circuit tiers: ${error.message}`)

  if (!tiers || tiers.length === 0) {
    console.log(
      "\nNo circuit achievement_tiers rows yet — storage uploaded; rely on migration for URLs.",
    )
    return
  }

  console.log(`\nUpdating ${tiers.length} tier icon_asset_url rows…`)

  const updates = tiers.flatMap((tier) => {
    const groupRaw = tier.achievement_groups
    const slug =
      groupRaw &&
      typeof groupRaw === "object" &&
      "slug" in groupRaw &&
      typeof groupRaw.slug === "string"
        ? groupRaw.slug
        : null
    if (!slug) return []
    const webpName = `${slug}_${tier.rank}.webp`
    const newUrl = publicUrl(webpName)
    return [{ id: tier.id, newUrl, label: `${slug}/${tier.rank}` }]
  })

  if (dryRun) {
    updates.forEach(({ label, newUrl }) => console.log(`  would set ${label} → ${newUrl}`))
    return
  }

  const results = await Promise.all(
    updates.map(async ({ id, newUrl, label }) => {
      const { error: updErr } = await supabase
        .from("achievement_tiers")
        .update({ icon_asset_url: newUrl })
        .eq("id", id)
      if (updErr) {
        console.error(`  ✗ ${label}: ${updErr.message}`)
        return false
      }
      console.log(`  ✓ ${label}`)
      return true
    }),
  )

  const ok = results.filter(Boolean).length
  console.log(`Updated ${ok}/${updates.length} tiers`)
}

async function main() {
  console.log(
    `\n${dryRun ? "🔍 DRY RUN" : "🚀 APPLYING"} — circuit badge icons → ${SUPABASE_URL}\n`,
  )
  console.log(`Assets: ${assets.length} expected from ${ASSETS_DIR}\n`)

  // Verify sources first (fail fast)
  const buffers = await Promise.all(
    assets.map(async (asset) => {
      try {
        const buf = await readFile(asset.sourcePath)
        return { asset, buf }
      } catch {
        throw new Error(`Missing source PNG: ${asset.sourcePath}`)
      }
    }),
  )

  for (const { asset, buf } of buffers) {
    await uploadPng(asset, buf)
    await uploadWebp(asset, buf)
  }

  await updateTierUrls()

  console.log("\nExample public URLs:")
  ;["circuit_runner_bronze.webp", "spidey_gold.webp", "pantheoniste_diamond.webp"].forEach(
    (name) => console.log(`  ${publicUrl(name)}`),
  )

  console.log(
    dryRun
      ? "\n✅ Dry run complete. Re-run with --apply to upload + update DB."
      : "\n✅ Upload + optimize complete.",
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
