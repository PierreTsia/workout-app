/**
 * Phase 2 — Illustration enrichment: backfill exercises.image_url for imported
 * exercises (excluding the 23 hand-curated ones) by downloading images from the
 * wger API, uploading to the exercise-media Supabase bucket, and setting
 * image_url to the object path.
 *
 * Exercises without a wger image are skipped (emoji fallback in the UI).
 * Idempotent: only sets image_url where NULL.
 */

import "./load-env.js"
import { createClient } from "@supabase/supabase-js"
import {
  getExcludedExerciseIds,
  enrichmentConfig,
} from "./enrichment-config.js"

// ---------- Env & client ----------

const SUPABASE_URL = enrichmentConfig.supabaseUrl
const SERVICE_ROLE_KEY = enrichmentConfig.supabaseServiceRoleKey

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ---------- Constants ----------

const WGER_BASE = "https://wger.de"
const WGER_IMAGE_API = `${WGER_BASE}/api/v2/exerciseimage/?format=json&limit=100`
const STORAGE_BUCKET = "exercise-media"
const RETRY_COUNT = 3
const RETRY_DELAY_MS = 2000

// ---------- Types ----------

interface WgerImage {
  id: number
  exercise: number
  image: string
  is_main: boolean
  license_author: string
}

interface Candidate {
  id: string
  name: string
  source: string
}

// ---------- Helpers ----------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function extractWgerId(source: string): number | null {
  const match = source.match(/^wger:(\d+)$/)
  return match ? Number(match[1]) : null
}

// ---------- Fetch all wger exercise images ----------

async function fetchAllWgerImages(): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  let url: string | null = WGER_IMAGE_API

  while (url) {
    const res = await fetchWithRetry(url)
    const data = res as { next: string | null; results: WgerImage[] }

    for (const img of data.results) {
      if (img.license_author !== "Everkinetic") continue
      if (!map.has(img.exercise) || img.is_main) {
        map.set(img.exercise, img.image)
      }
    }

    url = data.next
    if (url) await sleep(300)
  }

  return map
}

async function fetchWithRetry(url: string): Promise<unknown> {
  for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      return await res.json()
    } catch (err) {
      if (attempt === RETRY_COUNT - 1) throw err
      console.warn(`  Retry ${attempt + 1}/${RETRY_COUNT} for ${url}`)
      await sleep(RETRY_DELAY_MS * (attempt + 1))
    }
  }
  throw new Error("unreachable")
}

// ---------- Download image as Buffer ----------

async function downloadImage(imageUrl: string): Promise<Buffer> {
  const fullUrl = imageUrl.startsWith("http") ? imageUrl : `${WGER_BASE}${imageUrl}`

  for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
    try {
      const res = await fetch(fullUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${fullUrl}`)
      const arrayBuf = await res.arrayBuffer()
      return Buffer.from(arrayBuf)
    } catch (err) {
      if (attempt === RETRY_COUNT - 1) throw err
      console.warn(`  Download retry ${attempt + 1}/${RETRY_COUNT}`)
      await sleep(RETRY_DELAY_MS * (attempt + 1))
    }
  }
  throw new Error("unreachable")
}

// ---------- Upload + DB update ----------

function contentTypeFromUrl(url: string): string {
  if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return "image/jpeg"
  if (url.endsWith(".gif")) return "image/gif"
  if (url.endsWith(".webp")) return "image/webp"
  return "image/png"
}

function extensionFromUrl(url: string): string {
  const match = url.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i)
  return match ? match[1].toLowerCase() : "png"
}

async function uploadAndUpdate(
  candidate: Candidate,
  imageBuffer: Buffer,
  imageUrl: string,
): Promise<boolean> {
  const ext = extensionFromUrl(imageUrl)
  const objectPath = `${candidate.id}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(objectPath, imageBuffer, {
      contentType: contentTypeFromUrl(imageUrl),
      upsert: false,
    })

  if (uploadErr) {
    if (!uploadErr.message?.includes("already exists") && !uploadErr.message?.includes("Duplicate")) {
      throw new Error(`Storage upload failed: ${uploadErr.message}`)
    }
  }

  const { error: updateErr } = await supabase
    .from("exercises")
    .update({ image_url: objectPath })
    .eq("id", candidate.id)
    .is("image_url", null)

  if (updateErr) {
    throw new Error(`DB update failed: ${updateErr.message}`)
  }

  return true
}

// ---------- Main ----------

async function run() {
  console.log("=== Phase 2 — Illustration enrichment (wger images) ===\n")

  const excludedIds = await getExcludedExerciseIds(supabase)
  console.log(`Exclusion set: ${excludedIds.size} exercise IDs (23 hand-curated)\n`)

  console.log("Fetching wger exercise image catalog...")
  const wgerImages = await fetchAllWgerImages()
  console.log(`Wger images available: ${wgerImages.size}\n`)

  const { data: rows, error: fetchErr } = await supabase
    .from("exercises")
    .select("id, name, source")
    .not("source", "is", null)
    .is("image_url", null)

  if (fetchErr) {
    console.error("Failed to fetch candidates:", fetchErr.message)
    process.exit(1)
  }

  const candidates = (rows ?? []).filter((r) => !excludedIds.has(r.id)) as Candidate[]
  console.log(`Candidates (image_url IS NULL, not in 23): ${candidates.length}`)

  let updated = 0
  let skipped = 0
  const failedIds: string[] = []

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    const wgerId = extractWgerId(c.source)
    process.stdout.write(`[${i + 1}/${candidates.length}] ${c.name} ... `)

    if (!wgerId) {
      console.log("no wger source")
      skipped++
      continue
    }

    const imageUrl = wgerImages.get(wgerId)
    if (!imageUrl) {
      console.log("no wger image")
      skipped++
      continue
    }

    try {
      const imageBuffer = await downloadImage(imageUrl)
      await uploadAndUpdate(c, imageBuffer, imageUrl)
      console.log(`OK (${(imageBuffer.length / 1024).toFixed(0)} KB)`)
      updated++
    } catch (err) {
      console.log(`FAILED: ${(err as Error).message}`)
      failedIds.push(c.id)
    }

    await sleep(200)
  }

  console.log("\n=== Done ===")
  console.log(`Updated: ${updated}`)
  console.log(`Skipped (no wger image): ${skipped}`)
  console.log(`Failed: ${failedIds.length}`)
  if (failedIds.length > 0) console.log(`Failed IDs:\n  ${failedIds.join("\n  ")}`)
}

run().catch((err) => {
  console.error("Enrichment failed:", err)
  process.exit(1)
})
