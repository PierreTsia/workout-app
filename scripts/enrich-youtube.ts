/**
 * Phase 1 — YouTube enrichment: backfill exercises.youtube_url for imported
 * exercises (excluding the 23 hand-curated ones) using allowlist first,
 * then YouTube Data API v3 search with smart query building and video
 * quality filtering. Idempotent: only sets youtube_url where NULL.
 *
 * Key features:
 * - Reverse-lookups fitness-dictionary OVERRIDES for canonical English terms
 * - Searches EN first (richer content), falls back to FR
 * - Fetches 3 results per search and picks best by duration + view count
 * - Contextual query suffixes (equipment type, stretch vs. strength)
 * - Supports --dry-run and --limit=N
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
import { OVERRIDES } from "./fitness-dictionary.js"

// ---------- Env & client ----------

const SUPABASE_URL = enrichmentConfig.supabaseUrl
const SERVICE_ROLE_KEY = enrichmentConfig.supabaseServiceRoleKey
const YOUTUBE_API_KEY = phase1.youtubeApiKey
const ALLOWLIST_PATH = phase1.allowlistPath

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ---------- CLI flags ----------

const DRY_RUN = process.argv.includes("--dry-run")
const LIMIT = (() => {
  const arg = process.argv.find((a) => a.startsWith("--limit="))
  return arg ? parseInt(arg.slice("--limit=".length), 10) : Infinity
})()

// ---------- Constants ----------

const RETRY_COUNT = 3
const RETRY_DELAY_MS = 2000
const YOUTUBE_API_DELAY_MS = 350
const SEARCH_MAX_RESULTS = 3
const MIN_DURATION_S = 10
const MAX_DURATION_S = 300

const COMPOUND_KEYWORDS = [
  "squat", "deadlift", "soulevé", "bench", "développé", "row", "tirage",
  "press", "presse", "pull", "push", "lunge", "fente", "clean", "snatch", "jerk",
]

const COMMON_KEYWORDS = [
  "curl", "extension", "pull-down", "leg press", "leg curl", "crunch",
  "raise", "élévation", "fly", "papillon", "shrug", "pull-up", "chin-up",
  "dip", "triceps", "biceps", "lateral", "latéral", "front", "devant",
]

const STRETCH_KEYWORDS = [
  "étirement", "stretch", "foam roller", "rouleau", "mobilité", "mobility",
]

const CARDIO_KEYWORDS = [
  "vélo", "course", "marche", "rameur", "cycling", "running", "walking",
  "rowing machine", "elliptique", "treadmill", "stair",
]

/** DB equipment value → human-readable term for YouTube queries. */
const EQUIPMENT_SEARCH_LABELS: Record<string, string> = {
  barbell: "barbell",
  dumbbell: "dumbbell",
  ez_bar: "EZ bar",
  kettlebell: "kettlebell",
  band: "resistance band",
  cable: "cable",
}

// ---------- Types ----------

interface Candidate {
  id: string
  name: string
  name_en: string | null
  muscle_group: string
  equipment: string
}

interface VideoDetails {
  videoId: string
  durationS: number
  viewCount: number
}

// ---------- Reverse dictionary (French → canonical English) ----------

const REVERSE_DICT: Map<string, string> = new Map()
for (const [en, fr] of Object.entries(OVERRIDES)) {
  const key = fr.trim().toLowerCase()
  if (!REVERSE_DICT.has(key)) REVERSE_DICT.set(key, en)
}

// ---------- Prioritization (compound → common → rest) ----------

function prioritizationTier(c: Candidate): number {
  const name = (c.name + " " + (c.name_en ?? "")).toLowerCase()
  if (COMPOUND_KEYWORDS.some((k) => name.includes(k))) return 0
  if (COMMON_KEYWORDS.some((k) => name.includes(k))) return 1
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
      h.toLowerCase().replace(/\s/g, "") === "name_en",
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

// ---------- Smart query building ----------

function getEnglishName(c: Candidate): string | null {
  if (c.name_en) return c.name_en
  return REVERSE_DICT.get(c.name.trim().toLowerCase()) ?? null
}

function buildSearchQuery(c: Candidate, lang: "en" | "fr"): string {
  const baseName = lang === "en"
    ? (getEnglishName(c) ?? c.name)
    : c.name

  const lower = baseName.toLowerCase()

  if (STRETCH_KEYWORDS.some((k) => lower.includes(k))) {
    return `${baseName} stretch tutorial`
  }
  if (CARDIO_KEYWORDS.some((k) => lower.includes(k))) {
    return `${baseName} technique`
  }

  const equipLabel = EQUIPMENT_SEARCH_LABELS[c.equipment]
  const equipSuffix = equipLabel && !lower.includes(equipLabel.toLowerCase())
    ? ` ${equipLabel}`
    : ""

  return `${baseName}${equipSuffix} exercise form`
}

// ---------- YouTube Data API v3 ----------

async function youtubeSearch(query: string, relevanceLanguage: string): Promise<string[]> {
  if (!YOUTUBE_API_KEY) return []
  const url = new URL("https://www.googleapis.com/youtube/v3/search")
  url.searchParams.set("part", "snippet")
  url.searchParams.set("type", "video")
  url.searchParams.set("maxResults", String(SEARCH_MAX_RESULTS))
  url.searchParams.set("relevanceLanguage", relevanceLanguage)
  url.searchParams.set("q", query)
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
        return []
      }
      return (data.items ?? [])
        .map((item) => item.id?.videoId)
        .filter((id): id is string => !!id)
    } catch (err) {
      if (err instanceof QuotaExceededError) throw err
      if (attempt === RETRY_COUNT - 1) throw err
      console.warn(`YouTube search retry ${attempt + 1}/${RETRY_COUNT} for "${query}"`)
      await sleep(RETRY_DELAY_MS * (attempt + 1))
    }
  }
  return []
}

function parseISO8601Duration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  return (
    parseInt(match[1] || "0") * 3600 +
    parseInt(match[2] || "0") * 60 +
    parseInt(match[3] || "0")
  )
}

/** Batch-fetch duration & view count for up to 50 video IDs (1 quota unit). */
async function getVideoDetails(videoIds: string[]): Promise<VideoDetails[]> {
  if (!YOUTUBE_API_KEY || videoIds.length === 0) return []
  const url = new URL("https://www.googleapis.com/youtube/v3/videos")
  url.searchParams.set("part", "contentDetails,statistics")
  url.searchParams.set("id", videoIds.join(","))
  url.searchParams.set("key", YOUTUBE_API_KEY)

  const res = await fetch(url.toString())
  const data = (await res.json()) as {
    error?: { code?: number; message?: string }
    items?: Array<{
      id: string
      contentDetails?: { duration?: string }
      statistics?: { viewCount?: string }
    }>
  }
  if (data.error) {
    if (data.error.code === 403 && data.error.message?.includes("quota")) {
      throw new QuotaExceededError()
    }
    return []
  }
  return (data.items ?? []).map((item) => ({
    videoId: item.id,
    durationS: parseISO8601Duration(item.contentDetails?.duration ?? ""),
    viewCount: parseInt(item.statistics?.viewCount ?? "0", 10),
  }))
}

/**
 * Pick the best video: prefer 30s–10min duration, then highest view count.
 * Falls back to the first result if nothing fits the duration window.
 */
function pickBestVideo(details: VideoDetails[]): VideoDetails | null {
  if (details.length === 0) return null

  const inRange = details.filter(
    (d) => d.durationS >= MIN_DURATION_S && d.durationS <= MAX_DURATION_S,
  )

  const pool = inRange.length > 0
    ? inRange
    : details.filter((d) => d.durationS >= MIN_DURATION_S)

  if (pool.length === 0) return details[0]

  pool.sort((a, b) => b.viewCount - a.viewCount)
  return pool[0]
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, "0")}`
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

class QuotaExceededError extends Error {
  constructor() { super("YouTube API quota exceeded") }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------- Resolve URL for one candidate ----------

interface ResolveResult {
  url: string
  source: string
  meta?: string
}

async function resolveYoutubeUrl(
  c: Candidate,
  allowlist: Map<string, string>,
): Promise<ResolveResult | null> {
  const byName = allowlist.get(normalizeKey(c.name))
  if (byName) return { url: byName, source: "allowlist" }
  const byNameEn = c.name_en ? allowlist.get(normalizeKey(c.name_en)) : undefined
  if (byNameEn) return { url: byNameEn, source: "allowlist" }

  for (const lang of ["en", "fr"] as const) {
    const query = buildSearchQuery(c, lang)
    const videoIds = await youtubeSearch(query, lang)
    if (videoIds.length > 0) {
      const details = await getVideoDetails(videoIds)
      const best = pickBestVideo(details)
      if (best) {
        const meta = `${formatDuration(best.durationS)}, ${formatViews(best.viewCount)} views`
        return {
          url: `https://www.youtube.com/watch?v=${best.videoId}`,
          source: `${lang} "${query}"`,
          meta,
        }
      }
    }
    await sleep(YOUTUBE_API_DELAY_MS)
  }

  return null
}

// ---------- Main ----------

async function run() {
  console.log("=== Phase 1 — YouTube enrichment ===")
  if (DRY_RUN) console.log("*** DRY RUN — no DB writes ***")
  if (LIMIT < Infinity) console.log(`*** Limit: ${LIMIT} exercises ***`)
  console.log()

  console.log(`Reverse dictionary: ${REVERSE_DICT.size} French→English mappings`)

  const excludedIds = await getExcludedExerciseIds(supabase)
  console.log(`Exclusion set: ${excludedIds.size} exercise IDs (23 hand-curated)`)

  const { data: rows, error: fetchErr } = await supabase
    .from("exercises")
    .select("id, name, name_en, muscle_group, equipment")
    .not("source", "is", null)
    .is("youtube_url", null)

  if (fetchErr) {
    console.error("Failed to fetch candidates:", fetchErr.message)
    process.exit(1)
  }

  let candidates = (rows ?? []).filter((r) => !excludedIds.has(r.id)) as Candidate[]
  sortByPrioritization(candidates)
  if (LIMIT < candidates.length) candidates = candidates.slice(0, LIMIT)

  console.log(`Candidates: ${candidates.length}`)

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
    const enName = getEnglishName(c)
    const nameDisplay = enName && enName !== c.name
      ? `${c.name} [${enName}]`
      : c.name
    process.stdout.write(`[${i + 1}/${candidates.length}] ${nameDisplay} ... `)

    try {
      const result = await resolveYoutubeUrl(c, allowlist)
      if (!result) {
        console.log("no match")
        skipped++
        continue
      }

      const detail = result.meta ? ` (${result.meta})` : ""

      if (DRY_RUN) {
        console.log(`[dry] ${result.url} via ${result.source}${detail}`)
        updated++
        continue
      }

      const { error } = await supabase
        .from("exercises")
        .update({ youtube_url: result.url })
        .eq("id", c.id)
        .is("youtube_url", null)

      if (error) {
        console.log("update failed:", error.message)
        failedIds.push(c.id)
      } else {
        console.log(`${result.url} via ${result.source}${detail}`)
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
  console.log(`Updated:   ${updated}${DRY_RUN ? " (dry run)" : ""}`)
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
