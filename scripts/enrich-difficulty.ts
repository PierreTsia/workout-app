/**
 * Enrichment script: classify exercise difficulty (beginner / intermediate / advanced)
 * via Groq LLM. Updates exercises.difficulty_level. Writes audit CSV to scripts/data/difficulty-audit.csv.
 *
 * Env: GROQ_API_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: ENRICHMENT_DIFFICULTY_MODEL (default: llama-3.1-8b-instant)
 *
 * Flags:
 *   --force    reclassify all exercises (overwrite existing)
 *   --dry-run  classify and write audit CSV only; no DB updates
 *
 * Run: npm run enrich-difficulty
 */

import "./load-env.js"
import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY
const MODEL =
  process.env.ENRICHMENT_DIFFICULTY_MODEL ?? "llama-3.1-8b-instant"

const FORCE = process.argv.includes("--force")
const DRY_RUN = process.argv.includes("--dry-run")

const VALID_LEVELS = ["beginner", "intermediate", "advanced"] as const
type DifficultyLevel = (typeof VALID_LEVELS)[number]

function isValidLevel(s: string): s is DifficultyLevel {
  return VALID_LEVELS.includes(s.toLowerCase() as DifficultyLevel)
}

interface ExerciseInstructions {
  setup?: string[]
  movement?: string[]
  breathing?: string[]
  common_mistakes?: string[]
}

interface Candidate {
  id: string
  name: string
  name_en: string | null
  muscle_group: string
  equipment: string
  instructions: ExerciseInstructions | null
}

interface AuditRow {
  name: string
  difficulty_level: string
  reasoning: string
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing env: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required",
  )
  process.exit(1)
}
if (!GROQ_API_KEY) {
  console.error("Missing env: GROQ_API_KEY required")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const RETRY_COUNT = 3
const RETRY_DELAYS_MS = [2000, 4000, 6000]
const RATE_LIMIT_FALLBACK_MS = 10_000

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

const SYSTEM_PROMPT = `You are an expert strength & conditioning coach. Classify exercise difficulty as exactly one of: beginner, intermediate, advanced.

Tier definitions:
- beginner: Suitable for someone with < 6 months training. Easy to learn, low strength/mobility demands, safe even with imperfect form. Examples: push-up, bodyweight squat, machine leg press.
- intermediate: Suitable for someone with 6 months – 2 years training. Moderate form complexity, requires a solid strength base, some mobility demands. Examples: barbell bench press, weighted pull-up, Romanian deadlift.
- advanced: Suitable for someone with 2+ years training. High form complexity, significant strength and mobility requirements, injury risk if form breaks down. Examples: muscle-up, snatch, handstand push-up.

Classification criteria:
- Form complexity: How hard is the movement to learn and execute safely?
- Strength requirement: How much baseline strength is needed?
- Mobility demands: What range of motion / flexibility is required?

Rules:
- Respond ONLY with valid JSON, no surrounding text.
- Output exactly: {"difficulty_level": "...", "reasoning": "..."}
- "difficulty_level" must be lowercase: "beginner", "intermediate", or "advanced".
- "reasoning" is 1 sentence explaining your classification.
- Consider the specific equipment variant (e.g., barbell squat is harder than bodyweight squat).`

function buildUserMessage(c: Candidate): string {
  const name = (c.name_en ?? c.name).trim() || c.name
  let msg = `Exercise: ${name}\nMuscle group: ${c.muscle_group}\nEquipment: ${c.equipment}`
  const inst = c.instructions
  if (inst?.setup?.length || inst?.movement?.length) {
    msg += "\nInstructions:\n"
    if (inst.setup?.length) {
      msg += `- Setup: ${inst.setup.join("; ")}\n`
    }
    if (inst.movement?.length) {
      msg += `- Movement: ${inst.movement.join("; ")}`
    }
  }
  return msg
}

interface GroqResponse {
  difficulty_level: string
  reasoning: string
}

function parseJsonResponse(
  raw: string | null | undefined,
): GroqResponse | null {
  if (typeof raw !== "string") return null
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown
    if (
      parsed != null &&
      typeof parsed === "object" &&
      "difficulty_level" in parsed &&
      typeof (parsed as GroqResponse).reasoning === "string"
    ) {
      const level = String((parsed as GroqResponse).difficulty_level).toLowerCase()
      if (isValidLevel(level)) {
        return {
          difficulty_level: level,
          reasoning: (parsed as GroqResponse).reasoning,
        }
      }
    }
    return null
  } catch {
    return null
  }
}

async function classifyWithGroq(c: Candidate): Promise<GroqResponse | null> {
  const userContent = buildUserMessage(c)

  for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
          max_tokens: 150,
          temperature: 0.3,
        }),
      })

      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After")
        const waitMs = retryAfter
          ? Math.min(Number(retryAfter) * 1000, 60_000) || RATE_LIMIT_FALLBACK_MS
          : RATE_LIMIT_FALLBACK_MS
        console.warn(` Rate limited; waiting ${waitMs}ms...`)
        await sleep(waitMs)
        continue
      }

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Groq HTTP ${res.status}: ${text.slice(0, 200)}`)
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      return parseJsonResponse(data.choices?.[0]?.message?.content)
    } catch (err) {
      if (attempt === RETRY_COUNT - 1) {
        console.warn(` Groq failed after ${RETRY_COUNT} attempts:`, (err as Error).message)
        return null
      }
      await sleep(RETRY_DELAYS_MS[attempt])
    }
  }
  return null
}

function escapeCsvField(value: string): string {
  const s = String(value)
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

async function main() {
  console.log("=== Difficulty enrichment ===\n")
  if (DRY_RUN) console.log("(dry-run: no DB updates)\n")
  if (FORCE) console.log("(force: reclassify all)\n")

  let query = supabase
    .from("exercises")
    .select("id, name, name_en, muscle_group, equipment, instructions")
  if (!FORCE) {
    query = query.is("difficulty_level", null)
  }
  const { data: rows, error: fetchErr } = await query.order("name", { ascending: true })

  if (fetchErr) {
    console.error("Failed to fetch candidates:", fetchErr.message)
    process.exit(1)
  }

  const candidates = (rows ?? []) as Candidate[]
  console.log(`Candidates: ${candidates.length}\n`)

  if (candidates.length === 0) {
    console.log("Nothing to do.")
    return
  }

  const audit: AuditRow[] = []
  let classified = 0
  let skipped = 0
  const failedIds: string[] = []

  const dataDir = path.join(root, "scripts", "data")
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  const auditPath = path.join(dataDir, "difficulty-audit.csv")

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    process.stdout.write(`[${i + 1}/${candidates.length}] ${c.name} ... `)

    const result = await classifyWithGroq(c)
    if (!result) {
      console.log("skipped (invalid or missing response)")
      skipped++
      failedIds.push(c.id)
      continue
    }

    audit.push({
      name: c.name,
      difficulty_level: result.difficulty_level,
      reasoning: result.reasoning,
    })

    if (!DRY_RUN) {
      const { error } = await supabase
        .from("exercises")
        .update({ difficulty_level: result.difficulty_level })
        .eq("id", c.id)
      if (error) {
        console.log("update failed:", error.message)
        failedIds.push(c.id)
        skipped++
      } else {
        console.log(result.difficulty_level)
        classified++
      }
    } else {
      console.log(result.difficulty_level)
      classified++
    }
  }

  const csvHeaders = ["name", "difficulty_level", "reasoning"]
  const csvLines = [
    csvHeaders.join(","),
    ...audit.map((row) =>
      [
        escapeCsvField(row.name),
        escapeCsvField(row.difficulty_level),
        escapeCsvField(row.reasoning),
      ].join(","),
    ),
  ]
  fs.writeFileSync(auditPath, csvLines.join("\n"), "utf-8")

  console.log("\n=== Done ===")
  console.log(`Classified: ${classified}`)
  console.log(`Skipped: ${skipped}`)
  if (failedIds.length > 0) {
    console.log(`Failed IDs (${failedIds.length}): ${failedIds.join(", ")}`)
  }
  console.log(`Audit CSV: ${auditPath}`)
}

main().catch((err) => {
  console.error("Enrichment failed:", err)
  process.exit(1)
})
