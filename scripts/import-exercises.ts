import { createClient } from "@supabase/supabase-js"
import { EXISTING_EXERCISE_MAP } from "./exercise-mapping.js"
import {
  extractTranslation,
  buildExerciseRecord,
  mergeWithExisting,
  type WgerExerciseInfo,
} from "./import-lib.js"
import * as fs from "node:fs"
import * as path from "node:path"

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const WGER_BASE = "https://wger.de/api/v2"
const WGER_LANG_FR = 12
const WGER_LANG_EN = 2
const PAGE_SIZE = 50
const RETRY_COUNT = 3
const RETRY_DELAY_MS = 2000

// ---------- Network helpers ----------

async function fetchWithRetry(url: string): Promise<unknown> {
  for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      return await res.json()
    } catch (err) {
      if (attempt === RETRY_COUNT - 1) throw err
      console.warn(`Retry ${attempt + 1}/${RETRY_COUNT} for ${url}`)
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)))
    }
  }
  throw new Error("unreachable")
}

async function translateWithMyMemory(text: string): Promise<string | null> {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|fr`
    const data = (await fetchWithRetry(url)) as {
      responseData?: { translatedText?: string }
    }
    return data.responseData?.translatedText ?? null
  } catch (err) {
    console.warn(`MyMemory translation failed for "${text}":`, err)
    return null
  }
}

// ---------- Main import logic ----------

interface ReviewRow {
  wger_id: number
  name_en: string
  name_fr: string
  translation_source: "wger" | "mymemory" | "none"
  needs_review: boolean
}

async function fetchAllExercises(): Promise<WgerExerciseInfo[]> {
  const all: WgerExerciseInfo[] = []
  let url: string | null = `${WGER_BASE}/exerciseinfo/?format=json&limit=${PAGE_SIZE}`

  while (url) {
    console.log(`Fetching: ${url}`)
    const data = (await fetchWithRetry(url)) as {
      next: string | null
      results: WgerExerciseInfo[]
    }
    all.push(...data.results)
    url = data.next
    if (url) await new Promise((r) => setTimeout(r, 500))
  }

  return all
}

function filterValidExercises(exercises: WgerExerciseInfo[]): WgerExerciseInfo[] {
  return exercises.filter((ex) => {
    const hasEnglish = ex.translations.some((t) => t.language === WGER_LANG_EN && t.name.trim())
    const hasMuscle = ex.muscles.length > 0
    const hasCategory = ex.category?.id != null
    return hasEnglish && hasMuscle && hasCategory
  })
}

async function run() {
  console.log("=== Exercise Library Import ===\n")

  // 1. Fetch all exercises from Wger
  console.log("Step 1: Fetching exercises from Wger...")
  const allExercises = await fetchAllExercises()
  console.log(`  Fetched ${allExercises.length} total exercises`)

  // 2. Filter to valid exercises
  const validExercises = filterValidExercises(allExercises)
  console.log(`  ${validExercises.length} valid exercises after filtering\n`)

  // 3. Build reverse mapping: wger_base_id → existing exercise name(s)
  const reverseMap = new Map<number, string[]>()
  for (const [name, wgerId] of Object.entries(EXISTING_EXERCISE_MAP)) {
    const existing = reverseMap.get(wgerId) ?? []
    existing.push(name)
    reverseMap.set(wgerId, existing)
  }

  // 4. Check which wger IDs already exist in the database
  const { data: existingBySource } = await supabase
    .from("exercises")
    .select("source")
    .not("source", "is", null)
  const existingSources = new Set(
    (existingBySource ?? []).map((e: { source: string }) => e.source),
  )

  // 5. Fetch existing exercises by name for the mapping
  const { data: existingExercises } = await supabase
    .from("exercises")
    .select("id, name")
  const existingByName = new Map<string, string>()
  for (const ex of existingExercises ?? []) {
    existingByName.set(ex.name, ex.id)
  }

  const reviewRows: ReviewRow[] = []
  let insertedCount = 0
  let updatedCount = 0
  let skippedCount = 0

  for (const info of validExercises) {
    const sourceKey = `wger:${info.id}`
    const englishTranslation = extractTranslation(info.translations, WGER_LANG_EN)
    const englishName = englishTranslation?.name?.trim() ?? ""
    if (!englishName) continue

    const existingNames = reverseMap.get(info.id)

    if (existingNames && existingNames.length > 0) {
      for (const existingName of existingNames) {
        const existingId = existingByName.get(existingName)
        if (!existingId) {
          console.warn(`  Mapped exercise "${existingName}" not found in DB — skipping`)
          skippedCount++
          continue
        }

        const updates = mergeWithExisting(info, englishName)
        const { error } = await supabase
          .from("exercises")
          .update(updates)
          .eq("id", existingId)

        if (error) {
          console.error(`  Failed to update "${existingName}":`, error.message)
        } else {
          console.log(`  Updated: ${existingName} (backfill from wger:${info.id})`)
          updatedCount++
        }

        reviewRows.push({
          wger_id: info.id,
          name_en: englishName,
          name_fr: existingName,
          translation_source: "wger",
          needs_review: false,
        })
      }
      continue
    }

    // Skip if already imported (idempotent re-run)
    if (existingSources.has(sourceKey)) {
      skippedCount++
      continue
    }

    // New exercise — translate
    const frTranslation = extractTranslation(info.translations, WGER_LANG_FR)
    let frenchName = frTranslation?.name?.trim() ?? ""
    let translationSource: "wger" | "mymemory" | "none" = "none"

    if (frenchName) {
      translationSource = "wger"
    } else {
      const translated = await translateWithMyMemory(englishName)
      if (translated) {
        frenchName = translated
        translationSource = "mymemory"
      }
    }

    if (!frenchName) {
      frenchName = englishName
      translationSource = "none"
    }

    const record = buildExerciseRecord(info, frenchName, englishName)
    if (!record) {
      skippedCount++
      continue
    }

    const { error } = await supabase.from("exercises").insert(record)

    if (error) {
      console.error(`  Failed to insert "${englishName}":`, error.message)
      skippedCount++
    } else {
      insertedCount++
    }

    reviewRows.push({
      wger_id: info.id,
      name_en: englishName,
      name_fr: frenchName,
      translation_source: translationSource,
      needs_review: translationSource !== "wger",
    })
  }

  // 6. Write review CSV
  const outputDir = path.join(import.meta.dirname, "output")
  fs.mkdirSync(outputDir, { recursive: true })
  const csvPath = path.join(outputDir, "translation-review.csv")
  const csvHeader = "wger_id,name_en,name_fr,translation_source,needs_review\n"
  const csvRows = reviewRows
    .map(
      (r) =>
        `${r.wger_id},"${r.name_en.replace(/"/g, '""')}","${r.name_fr.replace(/"/g, '""')}",${r.translation_source},${r.needs_review}`,
    )
    .join("\n")
  fs.writeFileSync(csvPath, csvHeader + csvRows, "utf-8")

  console.log("\n=== Import Complete ===")
  console.log(`  Inserted: ${insertedCount}`)
  console.log(`  Updated (backfill): ${updatedCount}`)
  console.log(`  Skipped: ${skippedCount}`)
  console.log(`  Review CSV: ${csvPath}`)
}

run().catch((err) => {
  console.error("Import failed:", err)
  process.exit(1)
})
