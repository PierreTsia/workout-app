/**
 * Phase 1 — YouTube enrichment: backfill exercises.youtube_url for imported
 * exercises (excluding the 23 hand-curated ones) using allowlist first,
 * then YouTube Data API v3 search. Idempotent: only sets youtube_url where NULL.
 */

import "./load-env.js"
import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs"
import * as path from "node:path"
import {
  getExcludedExerciseIds,
  phase1,
  enrichmentConfig,
} from "./enrichment-config.js"

// ---------- Env & client ----------

const SUPABASE_URL = enrichmentConfig.supabaseUrl
const SERVICE_ROLE_KEY = enrichmentConfig.supabaseServiceRoleKey
const YOUTUBE_API_KEY = phase1.youtubeApiKey
const ALLOWLIST_PATH = phase1.allowlistPath
const LANGUAGE_ORDER = phase1.languageOrder

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ---------- Constants ----------

const RETRY_COUNT = 3
const RETRY_DELAY_MS = 2000
const YOUTUBE_API_DELAY_MS = 350 // ~100 searches/day at 100 units each; space out calls

/** Keywords that indicate compound movements (tier 1). */
const COMPOUND_KEYWORDS = [
  "squat", "deadlift", "soulevé", "bench", "développé", "row", "tirage",
  "press", "presse", "pull", "push", "lunge", "fente", "clean", "snatch", "jerk",
]
/** Common exercise name terms (tier 2). */
const COMMON_KEYWORDS = [
  "curl", "extension", "pull-down", "leg press", "leg curl", "crunch",
  "raise", "élévation", "fly", "papillon", "shrug", "pull-up", "chin-up",
  "dip", "triceps", "biceps", "lateral", "latéral", "front", "devant",
]

// ---------- Types ----------

interface Candidate {
  id: string
  name: string
  name_en: string | null
  muscle_group: string
  equipment: string
}

// ---------- Prioritization (strategy: compound → common → muscle/equipment) ----------

function prioritizationTier(c: Candidate): number {
  const name = (c.name + " " + (c.name_en ?? "")).toLowerCase()
  const hasCompound = COMPOUND_KEYWORDS.some((k) => name.includes(k))
  const hasCommon = COMMON_KEYWORDS.some((k) => name.includes(k))
  if (hasCompound) return 0
  if (hasCommon) return 1
  return 2
}

function sortByPrioritization(candidates: Candidate[]): void {
  candidates.sort((a, b) => {
    const tierA = prioritizationTier(a)
    const tierB = prioritizationTier(b)
    if (tierA !== tierB) return tierA - tierB
    if (a.muscle_group !== b.muscle_group) return a.muscle_group.localeCompare(b.muscle_group)
    return a.equipment.localeCompare(b.equipment)
  })
}

// ---------- Allowlist ----------

/** Allowlist: exercise name (or name_en) → full YouTube URL. */
function loadAllowlist(): Map<string, string> {
  const map = new Map<string, string>()
  const resolved = path.isAbsolute(ALLOWLIST_PATH)
    ? ALLOWLIST_PATH
    : path.resolve(process.cwd(), ALLOWLIST_PATH)

  if (!fs.existsSync(resolved)) {
    console.warn(`Allowlist not found at ${resolved}; using API fallback only.`)
    return map
  }

  const raw = fs.readFileSync(resolved, "utf-8")
  const lines = raw.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return map

  const headers = parseCsvLine(lines[0])
  const nameIdx = headers.findIndex(
    (h) =>
      h.toLowerCase().replace(/\s/g, "") === "name" ||
      h.toLowerCase().replace(/\s/g, "") === "name_en"
  )
  const urlIdx = headers.findIndex((h) => h.toLowerCase().includes("url"))
  if (nameIdx === -1 || urlIdx === -1) {
    console.warn("Allowlist CSV must have a name (or name_en) column and a url column.")
    return map
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const name = cols[nameIdx]?.trim()
    const url = cols[urlIdx]?.trim()
    if (name && url && isValidYoutubeUrl(url)) map.set(normalizeKey(name), url)
  }
  return map
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if ((ch === "," && !inQuotes) || (ch === "\n" && !inQuotes)) {
      out.push(cur.trim())
      cur = ""
    } else {
      cur += ch
    }
  }
  out.push(cur.trim())
  return out
}

function normalizeKey(s: string): string {
  return s.trim().toLowerCase()
}

function isValidYoutubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/i.test(url)
}

// ---------- YouTube Data API v3 ----------

async function youtubeSearch(query: string, relevanceLanguage: string): Promise<string | null> {
  if (!YOUTUBE_API_KEY) return null
  const url = new URL("https://www.googleapis.com/youtube/v3/search")
  url.searchParams.set("part", "snippet")
  url.searchParams.set("type", "video")
  url.searchParams.set("maxResults", "1")
  url.searchParams.set("relevanceLanguage", relevanceLanguage)
  url.searchParams.set("q", query + " exercise form")
  url.searchParams.set("key", YOUTUBE_API_KEY)

  for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
    try {
      const res = await fetch(url.toString())
      const data = (await res.json()) as {
        error?: { code?: number; message?: string }
        items?: Array<{ id?: { videoId?: string } }>
      }
      if (data.error) {
        if (data.error.code === 403 && data.error.message?.includes("quota")) {
          throw new QuotaExceededError()
        }
        console.warn("YouTube API error:", data.error.message)
        return null
      }
      const videoId = data.items?.[0]?.id?.videoId
      return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null
    } catch (err) {
      if (attempt === RETRY_COUNT - 1) throw err
      console.warn(`YouTube search retry ${attempt + 1}/${RETRY_COUNT} for "${query}"`)
      await sleep(RETRY_DELAY_MS * (attempt + 1))
    }
  }
  return null
}

class QuotaExceededError extends Error {
  constructor() { super("YouTube API quota exceeded") }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------- Resolve URL for one candidate ----------

async function resolveYoutubeUrl(
  c: Candidate,
  allowlist: Map<string, string>,
): Promise<string | null> {
  const byName = allowlist.get(normalizeKey(c.name))
  if (byName) return byName
  const byNameEn = c.name_en ? allowlist.get(normalizeKey(c.name_en)) : undefined
  if (byNameEn) return byNameEn

  for (const lang of LANGUAGE_ORDER) {
    const searchQuery = lang === "fr" ? c.name : (c.name_en ?? c.name)
    const url = await youtubeSearch(searchQuery, lang === "fr" ? "fr" : "en")
    if (url) return url
    await sleep(YOUTUBE_API_DELAY_MS)
  }
  return null
}

// ---------- Main ----------

async function run() {
  console.log("=== Phase 1 — YouTube enrichment ===\n")

  const excludedIds = await getExcludedExerciseIds(supabase)
  console.log(`Exclusion set: ${excludedIds.size} exercise IDs (23 hand-curated)\n`)

  const { data: rows, error: fetchErr } = await supabase
    .from("exercises")
    .select("id, name, name_en, muscle_group, equipment")
    .not("source", "is", null)
    .is("youtube_url", null)

  if (fetchErr) {
    console.error("Failed to fetch candidates:", fetchErr.message)
    process.exit(1)
  }

  const candidates = (rows ?? []).filter((r) => !excludedIds.has(r.id)) as Candidate[]
  sortByPrioritization(candidates)
  console.log(`Candidates (youtube_url IS NULL, not in 23): ${candidates.length}\n`)

  const allowlist = loadAllowlist()
  console.log(`Allowlist entries: ${allowlist.size}\n`)

  if (candidates.length === 0) {
    console.log("Nothing to do.")
    return
  }

  if (!YOUTUBE_API_KEY && allowlist.size === 0) {
    console.error("No YOUTUBE_API_KEY and no allowlist; cannot resolve any URLs.")
    process.exit(1)
  }

  let updated = 0
  let skipped = 0
  let quotaHit = false
  const failedIds: string[] = []

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    process.stdout.write(`[${i + 1}/${candidates.length}] ${c.name} ... `)
    try {
      const url = await resolveYoutubeUrl(c, allowlist)
      if (!url) {
        console.log("no match")
        skipped++
        continue
      }
      const { error } = await supabase
        .from("exercises")
        .update({ youtube_url: url })
        .eq("id", c.id)
        .is("youtube_url", null)

      if (error) {
        console.log("update failed:", error.message)
        failedIds.push(c.id)
      } else {
        console.log(url)
        updated++
      }
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        console.log("QUOTA EXCEEDED")
        quotaHit = true
        break
      }
      console.log("error:", (err as Error).message)
      failedIds.push(c.id)
    }
  }

  const remaining = candidates.length - updated - skipped - failedIds.length
  console.log("\n=== Results ===")
  console.log(`Updated:   ${updated}`)
  console.log(`Skipped:   ${skipped} (no match)`)
  console.log(`Failed:    ${failedIds.length}`)
  console.log(`Remaining: ${remaining}`)
  if (quotaHit) console.log(`\n⏸  Quota exceeded — will resume on next run (${remaining} exercises left)`)
  if (failedIds.length > 0) console.log(`Failed IDs: ${failedIds.join(", ")}`)
}

run().catch((err) => {
  console.error("Enrichment failed:", err)
  process.exit(1)
})
