/**
 * Audit and normalize muscle_group + secondary_muscles across all exercises
 * using Gemini Flash as a tagging assistant.
 *
 * Env: GEMINI_API_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: GEMINI_MODEL (default: gemini-2.0-flash)
 *
 * Flags:
 *   --dry-run   classify and write audit outputs only; no DB updates
 *   --force     reclassify all exercises (ignore reviewed_at)
 *   --batch=N   exercises per LLM batch (default: 40)
 *
 * Run: npm run audit-muscles
 *
 * Outputs (in scripts/data/):
 *   muscle-audit.csv          — full audit with before/after comparison
 *   muscle-audit-changes.sql  — SQL patch for exercises that changed
 *   muscle-audit-flagged.csv  — exercises the LLM couldn't classify confidently
 */

import "./load-env.js"
import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

// ---------- Env ----------

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite"

const DRY_RUN = process.argv.includes("--dry-run")
const FORCE = process.argv.includes("--force")
const BATCH_SIZE = (() => {
  const arg = process.argv.find((a) => a.startsWith("--batch="))
  return arg ? Math.max(1, Math.min(60, Number(arg.slice(8)))) : 40
})()

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
  process.exit(1)
}
if (!GEMINI_API_KEY) {
  console.error("Missing env: GEMINI_API_KEY required")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ---------- Taxonomy ----------

/**
 * Canonical muscle group taxonomy. French labels matching DB convention.
 * Every exercise.muscle_group must be one of these.
 * secondary_muscles entries must also come from this list.
 */
export const MUSCLE_TAXONOMY = [
  "Pectoraux",
  "Dos",
  "Épaules",
  "Biceps",
  "Triceps",
  "Quadriceps",
  "Ischios",
  "Fessiers",
  "Adducteurs",
  "Mollets",
  "Abdos",
  "Trapèzes",
  "Lombaires",
] as const

export type MuscleGroup = (typeof MUSCLE_TAXONOMY)[number]

const VALID_MUSCLES = new Set<string>(MUSCLE_TAXONOMY)

function isValidMuscle(s: string): s is MuscleGroup {
  return VALID_MUSCLES.has(s)
}

// ---------- Types ----------

interface ExerciseRow {
  id: string
  name: string
  name_en: string | null
  muscle_group: string
  secondary_muscles: string[] | null
  equipment: string
}

interface LlmTagResult {
  name: string
  muscle_group: string
  secondary_muscles: string[]
  confidence: "high" | "medium" | "low"
}

interface AuditRow {
  id: string
  name: string
  name_en: string | null
  old_muscle_group: string
  new_muscle_group: string
  old_secondary: string
  new_secondary: string
  confidence: string
  changed: boolean
}

// ---------- Retry / rate-limit ----------

const RETRY_COUNT = 3
const RETRY_DELAYS_MS = [2000, 5000, 10000]
const RATE_LIMIT_FALLBACK_MS = 15_000

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------- Gemini API ----------

const SYSTEM_INSTRUCTION = `You are an expert strength & conditioning coach and exercise taxonomist.

Your task: assign the correct primary muscle group and secondary muscles to each exercise from this STRICT taxonomy (French labels):
${MUSCLE_TAXONOMY.map((m) => `- ${m}`).join("\n")}

Rules:
1. muscle_group: exactly ONE value from the taxonomy above. This is the PRIMARY target muscle.
2. secondary_muscles: an array of values from the taxonomy. These are muscles that assist significantly. Use an empty array [] for true isolation exercises. Do NOT include the primary muscle_group in secondary_muscles.
3. confidence: "high" if you are certain, "medium" if the exercise is ambiguous or has multiple valid primary muscles, "low" if you are guessing.
4. Consider the equipment variant — e.g., "barbell squat" primarily targets Quadriceps, but "sumo deadlift" primarily targets Ischios/Fessiers.
5. For compound movements, secondary_muscles should list 1-3 significant assisting muscle groups. Don't list every muscle theoretically involved.
6. Respond ONLY with a valid JSON array. No surrounding text, no markdown fences.
7. The output array must have exactly the same number of entries as the input, in the same order.`

function buildBatchPrompt(exercises: ExerciseRow[]): string {
  const items = exercises.map((e, i) => {
    const name = (e.name_en ?? e.name).trim() || e.name
    return `${i + 1}. "${name}" (FR: "${e.name}") — Equipment: ${e.equipment}, Current tag: ${e.muscle_group}`
  })

  return `Classify these ${exercises.length} exercises. Return a JSON array of objects with keys: "name", "muscle_group", "secondary_muscles", "confidence".

${items.join("\n")}`
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
  }>
}

function parseGeminiResponse(raw: string | null | undefined): LlmTagResult[] | null {
  if (typeof raw !== "string") return null
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return null
  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown
    if (!Array.isArray(parsed)) return null
    const results: LlmTagResult[] = []
    for (const item of parsed) {
      if (
        item != null &&
        typeof item === "object" &&
        typeof item.muscle_group === "string" &&
        Array.isArray(item.secondary_muscles)
      ) {
        results.push({
          name: String(item.name ?? ""),
          muscle_group: item.muscle_group,
          secondary_muscles: item.secondary_muscles.map(String),
          confidence: ["high", "medium", "low"].includes(item.confidence)
            ? item.confidence
            : "medium",
        })
      }
    }
    return results.length > 0 ? results : null
  } catch {
    return null
  }
}

async function classifyBatch(exercises: ExerciseRow[]): Promise<LlmTagResult[] | null> {
  const userContent = buildBatchPrompt(exercises)

  for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: [{ parts: [{ text: userContent }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 4096,
              responseMimeType: "application/json",
            },
          }),
        },
      )

      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After")
        const waitMs = retryAfter
          ? Math.min(Number(retryAfter) * 1000, 60_000) || RATE_LIMIT_FALLBACK_MS
          : RATE_LIMIT_FALLBACK_MS
        console.warn(`  Rate limited; waiting ${waitMs}ms...`)
        await sleep(waitMs)
        continue
      }

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Gemini HTTP ${res.status}: ${text.slice(0, 300)}`)
      }

      const data = (await res.json()) as GeminiResponse
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      return parseGeminiResponse(text)
    } catch (err) {
      if (attempt === RETRY_COUNT - 1) {
        console.warn(`  Gemini failed after ${RETRY_COUNT} attempts:`, (err as Error).message)
        return null
      }
      await sleep(RETRY_DELAYS_MS[attempt])
    }
  }
  return null
}

// ---------- Validation ----------

interface ValidatedResult {
  muscle_group: MuscleGroup
  secondary_muscles: MuscleGroup[]
  confidence: string
  valid: boolean
  issues: string[]
}

function validateResult(result: LlmTagResult): ValidatedResult {
  const issues: string[] = []

  let muscleGroup = result.muscle_group
  if (!isValidMuscle(muscleGroup)) {
    issues.push(`Invalid primary: "${muscleGroup}"`)
    muscleGroup = "Dos" // safe fallback; will be flagged
  }

  const secondary: MuscleGroup[] = []
  for (const m of result.secondary_muscles) {
    if (!isValidMuscle(m)) {
      issues.push(`Invalid secondary: "${m}"`)
    } else if (m === muscleGroup) {
      issues.push(`Secondary duplicates primary: "${m}"`)
    } else if (!secondary.includes(m)) {
      secondary.push(m)
    }
  }

  return {
    muscle_group: muscleGroup as MuscleGroup,
    secondary_muscles: secondary,
    confidence: result.confidence,
    valid: issues.length === 0,
    issues,
  }
}

// ---------- Output helpers ----------

function escapeCsvField(value: string): string {
  const s = String(value)
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function escSql(s: string): string {
  return s.replace(/'/g, "''")
}

function generateSqlPatch(rows: AuditRow[]): string {
  const changed = rows.filter((r) => r.changed)
  if (changed.length === 0) return "-- No changes needed.\n"

  const lines = [
    "-- Muscle group audit patch",
    `-- Generated: ${new Date().toISOString()}`,
    `-- Changes: ${changed.length}\n`,
    "BEGIN;\n",
  ]

  for (const r of changed) {
    const secondaryArr = r.new_secondary
      ? `ARRAY[${r.new_secondary.split("; ").map((s) => `'${escSql(s)}'`).join(",")}]::text[]`
      : "ARRAY[]::text[]"
    lines.push(
      `UPDATE exercises SET muscle_group = '${escSql(r.new_muscle_group)}', secondary_muscles = ${secondaryArr} WHERE id = '${escSql(r.id)}'; -- ${escSql(r.name)}`,
    )
  }

  lines.push("\nCOMMIT;\n")
  return lines.join("\n")
}

// ---------- Main ----------

async function main() {
  console.log("=== Muscle Group Audit ===\n")
  if (DRY_RUN) console.log("(dry-run: no DB updates)\n")
  if (FORCE) console.log("(force: reclassify all)\n")
  console.log(`Model: ${MODEL}, Batch size: ${BATCH_SIZE}\n`)

  const { data: rows, error: fetchErr } = await supabase
    .from("exercises")
    .select("id, name, name_en, muscle_group, secondary_muscles, equipment")
    .order("muscle_group")
    .order("name")

  if (fetchErr) {
    console.error("Failed to fetch exercises:", fetchErr.message)
    process.exit(1)
  }

  const exercises = (rows ?? []) as ExerciseRow[]
  console.log(`Total exercises: ${exercises.length}\n`)

  if (exercises.length === 0) {
    console.log("Nothing to do.")
    return
  }

  const dataDir = path.join(root, "scripts", "data")
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

  const audit: AuditRow[] = []
  const flagged: Array<AuditRow & { issues: string }> = []
  let batchCount = 0
  let processed = 0
  let changed = 0
  let failedBatches = 0

  const batches: ExerciseRow[][] = []
  for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
    batches.push(exercises.slice(i, i + BATCH_SIZE))
  }

  console.log(`Processing ${batches.length} batches...\n`)

  for (const batch of batches) {
    batchCount++
    process.stdout.write(`[Batch ${batchCount}/${batches.length}] ${batch.length} exercises ... `)

    const results = await classifyBatch(batch)

    if (!results || results.length !== batch.length) {
      console.log(
        results
          ? `size mismatch (got ${results.length}, expected ${batch.length}) — skipping`
          : "failed — skipping",
      )
      failedBatches++

      for (const ex of batch) {
        flagged.push({
          id: ex.id,
          name: ex.name,
          name_en: ex.name_en,
          old_muscle_group: ex.muscle_group,
          new_muscle_group: ex.muscle_group,
          old_secondary: (ex.secondary_muscles ?? []).join("; "),
          new_secondary: (ex.secondary_muscles ?? []).join("; "),
          confidence: "failed",
          changed: false,
          issues: "LLM batch failed",
        })
      }
      continue
    }

    for (let i = 0; i < batch.length; i++) {
      const ex = batch[i]
      const validated = validateResult(results[i])

      const oldSecondary = (ex.secondary_muscles ?? []).sort().join("; ")
      const newSecondary = validated.secondary_muscles.sort().join("; ")
      const didChange =
        ex.muscle_group !== validated.muscle_group || oldSecondary !== newSecondary

      const row: AuditRow = {
        id: ex.id,
        name: ex.name,
        name_en: ex.name_en,
        old_muscle_group: ex.muscle_group,
        new_muscle_group: validated.muscle_group,
        old_secondary: oldSecondary,
        new_secondary: newSecondary,
        confidence: validated.confidence,
        changed: didChange,
      }

      audit.push(row)

      if (!validated.valid || validated.confidence === "low") {
        flagged.push({ ...row, issues: validated.issues.join("; ") || "low confidence" })
      }

      if (didChange && !DRY_RUN) {
        const { error } = await supabase
          .from("exercises")
          .update({
            muscle_group: validated.muscle_group,
            secondary_muscles: validated.secondary_muscles,
          })
          .eq("id", ex.id)

        if (error) {
          flagged.push({ ...row, issues: `DB update failed: ${error.message}` })
        } else {
          changed++
        }
      } else if (didChange) {
        changed++
      }

      processed++
    }

    const batchChanges = batch.filter((ex, i) => {
      const v = validateResult(results[i])
      const oldSec = (ex.secondary_muscles ?? []).sort().join("; ")
      const newSec = v.secondary_muscles.sort().join("; ")
      return ex.muscle_group !== v.muscle_group || oldSec !== newSec
    }).length
    console.log(`done (${batchChanges} changes)`)

    if (batchCount < batches.length) await sleep(1000)
  }

  // Write audit CSV
  const auditPath = path.join(dataDir, "muscle-audit.csv")
  const auditHeaders = [
    "id", "name", "name_en", "old_muscle_group", "new_muscle_group",
    "old_secondary", "new_secondary", "confidence", "changed",
  ]
  const auditLines = [
    auditHeaders.join(","),
    ...audit.map((r) =>
      [
        escapeCsvField(r.id),
        escapeCsvField(r.name),
        escapeCsvField(r.name_en ?? ""),
        escapeCsvField(r.old_muscle_group),
        escapeCsvField(r.new_muscle_group),
        escapeCsvField(r.old_secondary),
        escapeCsvField(r.new_secondary),
        escapeCsvField(r.confidence),
        r.changed ? "YES" : "",
      ].join(","),
    ),
  ]
  fs.writeFileSync(auditPath, auditLines.join("\n"), "utf-8")

  // Write flagged CSV
  const flaggedPath = path.join(dataDir, "muscle-audit-flagged.csv")
  const flaggedHeaders = [...auditHeaders, "issues"]
  const flaggedLines = [
    flaggedHeaders.join(","),
    ...flagged.map((r) =>
      [
        escapeCsvField(r.id),
        escapeCsvField(r.name),
        escapeCsvField(r.name_en ?? ""),
        escapeCsvField(r.old_muscle_group),
        escapeCsvField(r.new_muscle_group),
        escapeCsvField(r.old_secondary),
        escapeCsvField(r.new_secondary),
        escapeCsvField(r.confidence),
        r.changed ? "YES" : "",
        escapeCsvField(r.issues),
      ].join(","),
    ),
  ]
  fs.writeFileSync(flaggedPath, flaggedLines.join("\n"), "utf-8")

  // Write SQL patch
  const sqlPath = path.join(dataDir, "muscle-audit-changes.sql")
  fs.writeFileSync(sqlPath, generateSqlPatch(audit), "utf-8")

  console.log("\n=== Done ===")
  console.log(`Processed: ${processed}`)
  console.log(`Changed: ${changed}`)
  console.log(`Flagged for review: ${flagged.length}`)
  console.log(`Failed batches: ${failedBatches}`)
  console.log(`\nAudit CSV:   ${auditPath}`)
  console.log(`Flagged CSV: ${flaggedPath}`)
  console.log(`SQL patch:   ${sqlPath}`)
}

main().catch((err) => {
  console.error("Audit failed:", err)
  process.exit(1)
})
