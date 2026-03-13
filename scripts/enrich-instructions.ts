/**
 * Phase 3 — Instructions enrichment: backfill exercises.instructions (JSONB) for
 * imported exercises (excluding the 23 hand-curated ones) where instructions IS NULL.
 * Supports HuggingFace (mode=llm), Groq (mode=groq), or template (mode=template).
 * Output language: French. Idempotent: only sets instructions where NULL.
 *
 * Flags:
 *   --force            overwrite all existing instructions
 *   --retry-template   only overwrite exercises that still have generic template content
 */

import "./load-env.js"
import { createClient } from "@supabase/supabase-js"
import { InferenceClient } from "@huggingface/inference"
import {
  getExcludedExerciseIds,
  enrichmentConfig,
  phase3,
} from "./enrichment-config.js"

// ---------- Env & client ----------

const SUPABASE_URL = enrichmentConfig.supabaseUrl
const SERVICE_ROLE_KEY = enrichmentConfig.supabaseServiceRoleKey
const MODE = (process.env.ENRICHMENT_INSTRUCTIONS_MODE ?? phase3.mode) as "llm" | "groq" | "template"
const LLM_API_KEY = phase3.llmApiKey
const LLM_MODEL = process.env.ENRICHMENT_LLM_MODEL ?? "Qwen/Qwen2.5-7B-Instruct"
const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_MODEL = process.env.ENRICHMENT_GROQ_MODEL ?? "llama-3.3-70b-versatile"

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
  process.exit(1)
}

if (MODE === "llm" && !LLM_API_KEY) {
  console.error("ENRICHMENT_INSTRUCTIONS_MODE=llm requires HF_TOKEN")
  process.exit(1)
}
if (MODE === "groq" && !GROQ_API_KEY) {
  console.error("ENRICHMENT_INSTRUCTIONS_MODE=groq requires GROQ_API_KEY")
  process.exit(1)
}

const hf = MODE === "llm" && LLM_API_KEY ? new InferenceClient(LLM_API_KEY) : null
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const FORCE = process.argv.includes("--force")
const RETRY_TEMPLATE = process.argv.includes("--retry-template")

// ---------- Constants ----------

const RETRY_COUNT = 3
const RETRY_DELAY_MS = 2000

const INSTRUCTION_KEYS = ["setup", "movement", "breathing", "common_mistakes"] as const

/** Fingerprint phrase present in every template-generated movement array. */
const TEMPLATE_FINGERPRINT = "Exécutez le mouvement en contrôlant la phase de travail."

const COMPOUND_KEYWORDS = [
  "squat", "deadlift", "soulevé", "bench", "développé", "row", "tirage",
  "press", "presse", "pull", "push", "lunge", "fente", "clean", "snatch", "jerk",
]
const COMMON_KEYWORDS = [
  "curl", "extension", "pull-down", "leg press", "leg curl", "crunch",
  "raise", "élévation", "fly", "papillon", "shrug", "pull-up", "chin-up",
  "dip", "triceps", "biceps", "lateral", "latéral", "front", "devant",
]

// ---------- Types ----------

export interface ExerciseInstructionsShape {
  setup: string[]
  movement: string[]
  breathing: string[]
  common_mistakes: string[]
}

interface Candidate {
  id: string
  name: string
  name_en: string | null
  muscle_group: string
  equipment: string
  instructions?: ExerciseInstructionsShape | null
}

// ---------- Validation ----------

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function validateInstructionsShape(obj: unknown): obj is ExerciseInstructionsShape {
  if (obj == null || typeof obj !== "object") return false
  const o = obj as Record<string, unknown>
  for (const key of INSTRUCTION_KEYS) {
    if (!(key in o) || !isStringArray(o[key])) return false
  }
  return true
}

function hasTemplateContent(instructions: ExerciseInstructionsShape | null | undefined): boolean {
  if (!instructions) return false
  return Array.isArray(instructions.movement) &&
    instructions.movement.includes(TEMPLATE_FINGERPRINT)
}

// ---------- Prioritization (same as Phase 1/2) ----------

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

// ---------- Template generation (French) ----------

function generateInstructionsTemplate(c: Candidate): ExerciseInstructionsShape {
  const eq = c.equipment.trim() || "l'équipement"
  const muscle = c.muscle_group.trim() || "les muscles ciblés"
  return {
    setup: [
      `Placez-vous devant ${eq}, en position stable.`,
      `Réglez ${eq} si nécessaire pour votre morphologie.`,
      "Gardez le dos droit et les abdominaux légèrement engagés.",
    ],
    movement: [
      TEMPLATE_FINGERPRINT,
      `Concentrez l'effort sur ${muscle}.`,
      "Revenez lentement à la position initiale en résistant à la charge.",
    ],
    breathing: [
      "Expirez pendant l'effort (phase de contraction).",
      "Inspirez en revenant à la position de départ.",
    ],
    common_mistakes: [
      "Utiliser l'élan ou tricher avec le corps pour soulever.",
      "Négliger l'amplitude complète du mouvement.",
      "Choisir une charge trop lourde qui dégrade la technique.",
    ],
  }
}

// ---------- LLM prompt (shared) ----------

function buildPrompt(c: Candidate) {
  const system = `Tu es un coach sportif expert et concis. Tu réponds uniquement en JSON valide, sans commentaires ni texte autour.

Règles strictes :
- Chaque section contient 2 à 3 phrases courtes, directes et actionnables.
- Les instructions doivent correspondre EXACTEMENT à l'équipement indiqué ("${c.equipment}"). Ne mentionne jamais un équipement différent.
- Ne prescris JAMAIS de nombre de répétitions ou de séries.
- Ne commence JAMAIS une phrase par "Répétez" ou "N'oubliez pas".
- Rédige en français. Les termes de salle courants restent en anglais (squat, curl, pull-up, deadlift, hip thrust, face pull, etc.). Utilise "haltère" (pas "dumbbell"), "barre" (pas "barbell"), "poulie"/"câble" (pas "cable").
- Sois précis sur le mouvement réel de cet exercice — pas de descriptions génériques.`

  const user = `Génère les instructions pour cet exercice, au format JSON uniquement :

Exercice : ${c.name}${c.name_en ? ` (${c.name_en})` : ""}
Groupe musculaire : ${c.muscle_group}
Équipement : ${c.equipment}

JSON avec exactement ces clés (chacune un tableau de chaînes) : "setup", "movement", "breathing", "common_mistakes".`
  return { system, user }
}

function parseJsonResponse(raw: string | null | undefined): ExerciseInstructionsShape | null {
  if (typeof raw !== "string") return null
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown
    return validateInstructionsShape(parsed) ? parsed : null
  } catch {
    return null
  }
}

// ---------- HuggingFace generation ----------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function generateWithHF(c: Candidate): Promise<ExerciseInstructionsShape | null> {
  if (!hf) return null
  const { system, user } = buildPrompt(c)

  for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
    try {
      const result = await hf.chatCompletion({
        model: LLM_MODEL,
        provider: "auto",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 600,
      })
      return parseJsonResponse(result.choices?.[0]?.message?.content)
    } catch (err) {
      if (attempt === RETRY_COUNT - 1) {
        console.warn(`HF failed after ${RETRY_COUNT} attempts:`, (err as Error).message)
        return null
      }
      await sleep(RETRY_DELAY_MS * (attempt + 1))
    }
  }
  return null
}

// ---------- Groq generation ----------

async function generateWithGroq(c: Candidate): Promise<ExerciseInstructionsShape | null> {
  if (!GROQ_API_KEY) return null
  const { system, user } = buildPrompt(c)

  for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          max_tokens: 600,
          temperature: 0.7,
        }),
      })

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
        console.warn(`Groq failed after ${RETRY_COUNT} attempts:`, (err as Error).message)
        return null
      }
      await sleep(RETRY_DELAY_MS * (attempt + 1))
    }
  }
  return null
}

// ---------- Unified generate ----------

async function generateInstructions(c: Candidate): Promise<ExerciseInstructionsShape | null> {
  if (MODE === "groq") return generateWithGroq(c)
  if (MODE === "llm") return generateWithHF(c)
  return generateInstructionsTemplate(c)
}

// ---------- Main ----------

async function run() {
  console.log("=== Phase 3 — Instructions enrichment ===\n")
  const flags = [
    FORCE && "--force",
    RETRY_TEMPLATE && "--retry-template",
  ].filter(Boolean).join(", ")
  console.log(`Mode: ${MODE}${flags ? ` (${flags})` : ""}\n`)

  const excludedIds = await getExcludedExerciseIds(supabase)
  console.log(`Exclusion set: ${excludedIds.size} exercise IDs (23 hand-curated)\n`)

  const needsInstructions = RETRY_TEMPLATE || FORCE
  let query = supabase
    .from("exercises")
    .select("id, name, name_en, muscle_group, equipment" + (RETRY_TEMPLATE ? ", instructions" : ""))
    .not("source", "is", null)
  if (!needsInstructions) {
    query = query.is("instructions", null)
  }
  const { data: rows, error: fetchErr } = await query

  if (fetchErr) {
    console.error("Failed to fetch candidates:", fetchErr.message)
    process.exit(1)
  }

  let candidates = ((rows ?? []) as unknown as Candidate[]).filter((r) => !excludedIds.has(r.id))

  if (RETRY_TEMPLATE) {
    candidates = candidates.filter((c) => hasTemplateContent(c.instructions))
  }

  sortByPrioritization(candidates)
  console.log(`Candidates: ${candidates.length}\n`)

  if (candidates.length === 0) {
    console.log("Nothing to do.")
    return
  }

  let updated = 0
  const failedIds: string[] = []

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    process.stdout.write(`[${i + 1}/${candidates.length}] ${c.name} ... `)

    try {
      const instructions = await generateInstructions(c)

      if (!instructions) {
        console.log("LLM failed (no template fallback)")
        failedIds.push(c.id)
        continue
      }

      if (!validateInstructionsShape(instructions)) {
        console.log("invalid payload")
        failedIds.push(c.id)
        continue
      }

      const { error } = await supabase
        .from("exercises")
        .update({ instructions })
        .eq("id", c.id)

      if (error) {
        console.log("update failed:", error.message)
        failedIds.push(c.id)
      } else {
        console.log("ok")
        updated++
      }
    } catch (err) {
      console.log("error:", (err as Error).message)
      failedIds.push(c.id)
    }
  }

  console.log("\n=== Done ===")
  console.log(`Updated: ${updated}`)
  if (failedIds.length > 0) console.log(`Failed IDs (${failedIds.length}): ${failedIds.join(", ")}`)
}

run().catch((err) => {
  console.error("Enrichment failed:", err)
  process.exit(1)
})
