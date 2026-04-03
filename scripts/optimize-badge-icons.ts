/**
 * Batch-optimize badge icons in Supabase Storage.
 *
 * Downloads every PNG from the `badge-icons` bucket, converts to WebP via sharp
 * (256 × 256 @ quality 80), uploads the optimized file alongside the original,
 * and updates `achievement_tiers.icon_asset_url` to point at the new WebP.
 *
 * Usage:
 *   npx tsx scripts/optimize-badge-icons.ts            # dry-run (logs only)
 *   npx tsx scripts/optimize-badge-icons.ts --apply     # actually upload + update DB
 */
import "./load-env.js"
import sharp from "sharp"
import { createClient } from "@supabase/supabase-js"

const BUCKET = "badge-icons"
const TARGET_SIZE = 256
const WEBP_QUALITY = 80

const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim()
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env",
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const dryRun = !process.argv.includes("--apply")

async function listPngs(): Promise<string[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list("", {
    limit: 200,
  })
  if (error) throw new Error(`Failed to list bucket: ${error.message}`)
  return (data ?? [])
    .map((f) => f.name)
    .filter((n) => n.endsWith(".png"))
}

async function optimizeOne(fileName: string) {
  const webpName = fileName.replace(/\.png$/, ".webp")

  const { data: blob, error: dlError } = await supabase.storage
    .from(BUCKET)
    .download(fileName)
  if (dlError || !blob) throw new Error(`Download ${fileName}: ${dlError?.message}`)

  const pngBuffer = Buffer.from(await blob.arrayBuffer())
  const originalKB = (pngBuffer.byteLength / 1024).toFixed(0)

  const webpBuffer = await sharp(pngBuffer)
    .resize(TARGET_SIZE, TARGET_SIZE, { fit: "cover" })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()

  const optimizedKB = (webpBuffer.byteLength / 1024).toFixed(0)
  const ratio = ((1 - webpBuffer.byteLength / pngBuffer.byteLength) * 100).toFixed(1)

  console.log(
    `  ${fileName} → ${webpName}  |  ${originalKB} KB → ${optimizedKB} KB  (−${ratio}%)`,
  )

  if (dryRun) return { webpName }

  const { error: upError } = await supabase.storage
    .from(BUCKET)
    .upload(webpName, webpBuffer, {
      contentType: "image/webp",
      upsert: true,
    })
  if (upError) throw new Error(`Upload ${webpName}: ${upError.message}`)

  return { webpName }
}

async function updateDbUrls(mapping: Map<string, string>) {
  if (dryRun || mapping.size === 0) return

  const { data: tiers, error } = await supabase
    .from("achievement_tiers")
    .select("id, icon_asset_url")
    .not("icon_asset_url", "is", null)

  if (error) throw new Error(`Fetch tiers: ${error.message}`)

  const updates = (tiers ?? [])
    .filter((t) => t.icon_asset_url?.endsWith(".png"))
    .map((t) => {
      const oldName = t.icon_asset_url!.split("/").pop()!
      const newName = mapping.get(oldName)
      if (!newName) return null
      const newUrl = t.icon_asset_url!.replace(oldName, newName)
      return { id: t.id, newUrl }
    })
    .filter(Boolean) as { id: string; newUrl: string }[]

  for (const { id, newUrl } of updates) {
    const { error: updErr } = await supabase
      .from("achievement_tiers")
      .update({ icon_asset_url: newUrl })
      .eq("id", id)
    if (updErr) console.error(`  ⚠ Failed to update tier ${id}: ${updErr.message}`)
    else console.log(`  ✓ Updated tier ${id} → ${newUrl}`)
  }
}

async function main() {
  console.log(`\n${dryRun ? "🔍 DRY RUN" : "🚀 APPLYING"} — optimize badge icons\n`)

  const pngs = await listPngs()
  console.log(`Found ${pngs.length} PNGs in "${BUCKET}" bucket\n`)

  if (pngs.length === 0) {
    console.log("Nothing to optimize.")
    return
  }

  const mapping = new Map<string, string>()

  for (const png of pngs) {
    const { webpName } = await optimizeOne(png)
    mapping.set(png, webpName)
  }

  console.log("\nUpdating DB URLs…")
  await updateDbUrls(mapping)

  console.log(
    dryRun
      ? "\n✅ Dry run complete. Re-run with --apply to upload + update DB."
      : "\n✅ All done!",
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
