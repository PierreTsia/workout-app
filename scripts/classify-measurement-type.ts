/**
 * Classify exercises as reps vs duration. No DB writes (audit CSV + optional SQL file).
 *
 * Data source (one required):
 *   --input <path>   Local CSV: id,name (required), name_en,muscle_group,equipment
 *   --from-db        Fetch all rows from Supabase (uses VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 *                    Point those at **production** in your shell or .env.local to classify ~600 exercises,
 *                    not the local stack subset.
 *
 * Env: GROQ_API_KEY
 * Optional: CLASSIFY_MEASUREMENT_MODEL (default: llama-3.1-8b-instant)
 * Optional: CLASSIFY_MEASUREMENT_MIN_INTERVAL_MS — min delay between Groq calls (default: 2100).
 *   Groq free/on_demand tier is ~30 RPM; 200ms was too fast and triggers 429.
 *
 * Flags:
 *   --emit-sql       Write measurement-updates.sql (UPDATE statements for review; not applied automatically)
 *   --save-export    With --from-db: write CSV snapshot (default: scripts/data/exercises-export-from-db.csv)
 *
 * Examples:
 *   npm run classify-measurement-type -- --input scripts/data/exercises-export.csv
 *   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co SUPABASE_SERVICE_ROLE_KEY=*** \\
 *     npm run classify-measurement-type -- --from-db --emit-sql
 */

import "./load-env.js"
import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

const GROQ_API_KEY = process.env.GROQ_API_KEY
const MODEL =
  process.env.CLASSIFY_MEASUREMENT_MODEL ?? "llama-3.1-8b-instant"

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const EMIT_SQL = process.argv.includes("--emit-sql")
const FROM_DB = process.argv.includes("--from-db")
const SAVE_EXPORT_FLAG = process.argv.includes("--save-export")
const INPUT_FLAG = process.argv.indexOf("--input")
const INPUT_PATH =
  INPUT_FLAG >= 0 ? process.argv[INPUT_FLAG + 1] : null

function optionalPathAfter(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  if (i < 0) return undefined
  const next = process.argv[i + 1]
  if (!next || next.startsWith("-")) return undefined
  return next
}

const SAVE_EXPORT_PATH = optionalPathAfter("--save-export")

const DEFAULT_DURATION_SEC = 30

/** Groq on_demand llama-3.1-8b-instant is ~30 RPM — stay under with ≥2s between requests. */
const MIN_INTERVAL_MS = (() => {
  const n = Number(process.env.CLASSIFY_MEASUREMENT_MIN_INTERVAL_MS)
  return Number.isFinite(n) && n >= 0 ? n : 2100
})()

const RATE_LIMIT_FALLBACK_MS = 10_000
const MAX_429_RETRIES = 12

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function parseRetryAfterMs(res: Response, bodyText: string): number {
  const header = res.headers.get("Retry-After")
  if (header) {
    const sec = Number(header)
    if (!Number.isNaN(sec) && sec >= 0) {
      return Math.min(Math.max(sec * 1000, 1000), 120_000)
    }
  }
  const m = bodyText.match(/try again in (\d+(?:\.\d+)?)s/i)
  if (m) return Math.ceil(Number(m[1]) * 1000) + 500
  return RATE_LIMIT_FALLBACK_MS
}

interface Row {
  id: string
  name: string
  name_en: string
  muscle_group: string
  equipment: string
}

interface LlmOut {
  measurement_type: "reps" | "duration"
  reasoning: string
}

function csvEscapeCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function rowsToCsv(rows: Row[]): string {
  const header = "id,name,name_en,muscle_group,equipment"
  const lines = rows.map(
    (r) =>
      [
        csvEscapeCell(r.id),
        csvEscapeCell(r.name),
        csvEscapeCell(r.name_en),
        csvEscapeCell(r.muscle_group),
        csvEscapeCell(r.equipment),
      ].join(","),
  )
  return [header, ...lines].join("\n") + "\n"
}

function parseCsv(content: string): Row[] {
  const lines = content.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase())
  const idIdx = header.indexOf("id")
  const nameIdx = header.indexOf("name")
  if (idIdx < 0 || nameIdx < 0) {
    console.error("CSV must include id and name columns")
    process.exit(1)
  }
  const nameEnIdx = header.indexOf("name_en")
  const mgIdx = header.indexOf("muscle_group")
  const eqIdx = header.indexOf("equipment")
  const out: Row[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",")
    if (cols.length < 2) continue
    out.push({
      id: (cols[idIdx] ?? "").trim(),
      name: (cols[nameIdx] ?? "").trim(),
      name_en:
        nameEnIdx >= 0 ? (cols[nameEnIdx] ?? "").trim() : "",
      muscle_group: mgIdx >= 0 ? (cols[mgIdx] ?? "").trim() : "",
      equipment: eqIdx >= 0 ? (cols[eqIdx] ?? "").trim() : "",
    })
  }
  return out.filter((r) => r.id && r.name)
}

async function fetchRowsFromSupabase(): Promise<Row[]> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error(
      "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (required for --from-db)",
    )
    process.exit(1)
  }
  let host = SUPABASE_URL
  try {
    host = new URL(SUPABASE_URL).host
  } catch {
    /* keep raw */
  }
  console.log(`Fetching exercises from Supabase (${host}) …`)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const pageSize = 1000
  const all: Row[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from("exercises")
      .select("id,name,name_en,muscle_group,equipment")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error("Supabase error:", error.message)
      process.exit(1)
    }
    const batch = data ?? []
    for (const r of batch) {
      all.push({
        id: String(r.id),
        name: String(r.name ?? ""),
        name_en: r.name_en != null ? String(r.name_en) : "",
        muscle_group: String(r.muscle_group ?? ""),
        equipment: String(r.equipment ?? ""),
      })
    }
    if (batch.length < pageSize) break
    from += pageSize
  }
  return all
}

const SYSTEM = `You classify gym exercises as either "reps" (repetition-based: lifts, presses, rows, curls, etc.) or "duration" (time-based holds: plank, wall sit, L-sit, dead hang, isometric holds, farmer carry for time, etc.).

Respond ONLY with JSON: {"measurement_type":"reps"|"duration","reasoning":"one short sentence"}`

async function classify(row: Row): Promise<LlmOut | null> {
  const label = (row.name_en || row.name).trim()
  const user = `Exercise: ${label}\nMuscle: ${row.muscle_group}\nEquipment: ${row.equipment}`

  for (let attempt = 0; attempt < MAX_429_RETRIES; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
        max_tokens: 120,
        temperature: 0.2,
      }),
    })

    const rawText = await res.text()

    if (res.status === 429) {
      const waitMs = parseRetryAfterMs(res, rawText)
      console.warn(`\n  429 rate limit — waiting ${waitMs}ms (attempt ${attempt + 1}/${MAX_429_RETRIES})`)
      await sleep(waitMs)
      continue
    }

    if (!res.ok) {
      console.error("Groq error", res.status, rawText.slice(0, 400))
      return null
    }

    let data: { choices?: { message?: { content?: string } }[] }
    try {
      data = JSON.parse(rawText) as typeof data
    } catch {
      return null
    }
    const raw = data.choices?.[0]?.message?.content
    const m = raw?.match(/\{[\s\S]*\}/)
    if (!m) return null
    try {
      const parsed = JSON.parse(m[0]) as LlmOut
      if (
        parsed.measurement_type !== "reps" &&
        parsed.measurement_type !== "duration"
      ) {
        return null
      }
      return parsed
    } catch {
      return null
    }
  }

  console.error("Groq: too many 429 retries")
  return null
}

async function runClassification(rows: Row[]): Promise<void> {
  console.log(`Rows: ${rows.length}`)
  console.log(
    `Groq spacing: ${MIN_INTERVAL_MS}ms between requests (free tier ~30 RPM; set CLASSIFY_MEASUREMENT_MIN_INTERVAL_MS to tune).\n`,
  )

  const dataDir = path.join(root, "scripts", "data")
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  const auditPath = path.join(dataDir, "measurement-audit.csv")
  const auditLines: string[] = ["id,name,measurement_type,reasoning"]

  const sqlLines: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    process.stdout.write(`[${i + 1}/${rows.length}] ${r.name} ... `)
    const result = await classify(r)
    if (!result) {
      console.log("fail")
      auditLines.push(
        `${r.id},"${r.name.replace(/"/g, '""')}",,failed`,
      )
      continue
    }
    console.log(result.measurement_type)
    auditLines.push(
      `${r.id},"${r.name.replace(/"/g, '""')}",${result.measurement_type},"${result.reasoning.replace(/"/g, '""')}"`,
    )
    if (result.measurement_type === "duration") {
      sqlLines.push(
        `UPDATE exercises SET measurement_type = 'duration', default_duration_seconds = ${DEFAULT_DURATION_SEC} WHERE id = '${r.id}';`,
      )
    } else {
      sqlLines.push(
        `UPDATE exercises SET measurement_type = 'reps', default_duration_seconds = NULL WHERE id = '${r.id}';`,
      )
    }
    await sleep(MIN_INTERVAL_MS)
  }

  fs.writeFileSync(auditPath, auditLines.join("\n") + "\n", "utf8")
  console.log(`\nWrote ${auditPath}`)

  if (EMIT_SQL) {
    const sqlPath = path.join(dataDir, "measurement-updates.sql")
    fs.writeFileSync(sqlPath, sqlLines.join("\n") + "\n", "utf8")
    console.log(`Wrote ${sqlPath}`)
  }
}

async function main() {
  if (!GROQ_API_KEY) {
    console.error("Missing GROQ_API_KEY")
    process.exit(1)
  }

  if (FROM_DB && INPUT_PATH) {
    console.error("Use either --from-db or --input, not both.")
    process.exit(1)
  }
  if (!FROM_DB && !INPUT_PATH) {
    console.error(
      "Usage: --input path/to/export.csv | --from-db [--save-export [path]] [--emit-sql]",
    )
    process.exit(1)
  }

  let rows: Row[]

  if (FROM_DB) {
    rows = await fetchRowsFromSupabase()
    if (SAVE_EXPORT_FLAG) {
      const exportPath = SAVE_EXPORT_PATH
        ? path.isAbsolute(SAVE_EXPORT_PATH)
          ? SAVE_EXPORT_PATH
          : path.join(root, SAVE_EXPORT_PATH)
        : path.join(root, "scripts/data/exercises-export-from-db.csv")
      fs.writeFileSync(exportPath, rowsToCsv(rows), "utf8")
      console.log(`Wrote snapshot ${exportPath}\n`)
    }
  } else {
    const abs = path.isAbsolute(INPUT_PATH!)
      ? INPUT_PATH!
      : path.join(root, INPUT_PATH!)
    const content = fs.readFileSync(abs, "utf8")
    rows = parseCsv(content)
  }

  await runClassification(rows)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
