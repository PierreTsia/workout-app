/**
 * Translate `exercises.instructions` (French) into `exercises.instructions_en`
 * (English), cross-check the result with a second model from another provider,
 * and write content, status and audit in a single update per row (#417, T157).
 *
 * Dry-run by default. Nothing reaches the database without `--apply`.
 *
 *   npm run translate-instructions                       # every candidate, dry-run
 *   npm run translate-instructions -- --ids a,b,c        # explicit rows
 *   npm run translate-instructions -- --unlogged         # never-logged long tail
 *   npm run translate-instructions -- --top 60           # 60 most-logged rows
 *   npm run translate-instructions -- --ids a,b,c --apply
 *   npm run translate-instructions -- --top 60 --force --apply
 *
 * Flags: `--apply` writes, `--force` retranslates rows that already have
 * English (never `approved` ones), `--verbose` prints the produced block.
 *
 * Run it through the npm script, or pass `--tsconfig tsconfig.app.json` to tsx
 * yourself: the `@/*` alias the shared libs use is only declared there.
 *
 * Requires VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY in
 * `.env` / `.env.local`. GROQ_API_KEY is optional by design — without a
 * cross-checker every row lands on `flagged`, which renders French, and that is
 * the correct outcome rather than a reason to stop.
 */
import "./load-env.js"
import { createClient } from "@supabase/supabase-js"

import { checkTranslation, gateFlags } from "../src/lib/instructionQuality"
import {
  buildPrompt,
  buildReviewPrompt,
  parseInstructions,
  parseObjections,
  type Prompt,
  type TranslationObjection,
} from "../src/lib/instructionPrompt"
import {
  buildTranslationUpdate,
  isTranslationCandidate,
  type PipelineStatus,
} from "../src/lib/translationPipeline"
import type { ExerciseInstructions } from "../src/types/database"

// ---------- CLI ----------

const argv = process.argv.slice(2)
const hasFlag = (flag: string) => argv.includes(flag)

/** Accepts both `--top 60` and `--top=60`. */
const optionValue = (flag: string): string | undefined => {
  const inline = argv.find((arg) => arg.startsWith(`${flag}=`))
  if (inline) return inline.slice(flag.length + 1)
  const index = argv.indexOf(flag)
  return index === -1 ? undefined : argv[index + 1]
}

const APPLY = hasFlag("--apply")
const FORCE = hasFlag("--force")
const VERBOSE = hasFlag("--verbose")

type Wave =
  | { kind: "ids"; ids: string[] }
  | { kind: "unlogged" }
  | { kind: "top"; count: number }
  | { kind: "all" }

const wave = ((): Wave => {
  const ids = optionValue("--ids")
  if (ids !== undefined) {
    return {
      kind: "ids",
      ids: ids
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id !== ""),
    }
  }
  if (hasFlag("--unlogged")) return { kind: "unlogged" }
  const top = optionValue("--top")
  if (top !== undefined) return { kind: "top", count: Number(top) }
  return { kind: "all" }
})()

if (wave.kind === "ids" && wave.ids.length === 0) {
  console.error("--ids needs a comma-separated list of exercise ids")
  process.exit(1)
}
if (wave.kind === "top" && (!Number.isInteger(wave.count) || wave.count <= 0)) {
  console.error("--top needs a positive integer")
  process.exit(1)
}

// ---------- Env ----------

/**
 * An exported-but-empty shell variable shadows the `.env` value, because dotenv
 * never overrides an already-defined name. Blanking the Supabase variables is
 * the documented way to reproduce CI locally, so an empty string has to count
 * as absent rather than as a key.
 */
const envValue = (name: string): string | undefined => {
  const value = process.env[name]?.trim()
  return value === "" ? undefined : value
}

const SUPABASE_URL = envValue("VITE_SUPABASE_URL")
const SERVICE_ROLE_KEY = envValue("SUPABASE_SERVICE_ROLE_KEY")
const GEMINI_API_KEY = envValue("GEMINI_API_KEY")
const GROQ_API_KEY = envValue("GROQ_API_KEY")

const GEMINI_MODEL = envValue("TRANSLATION_GEMINI_MODEL") ?? "gemini-2.5-flash"
const GROQ_MODEL =
  envValue("TRANSLATION_GROQ_MODEL") ??
  envValue("ENRICHMENT_GROQ_MODEL") ??
  "llama-3.3-70b-versatile"

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !GEMINI_API_KEY) {
  console.error(
    "Missing env. Need VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY.",
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ---------- Rows ----------

interface ExerciseRow {
  id: string
  name: string
  name_en: string | null
  muscle_group: string
  equipment: string
  instructions: ExerciseInstructions | null
  instructions_en: ExerciseInstructions | null
  instructions_en_status: string | null
}

const ROW_COLUMNS =
  "id, name, name_en, muscle_group, equipment, instructions, instructions_en, instructions_en_status"

const PAGE_SIZE = 1000

const fetchCandidates = async (): Promise<ExerciseRow[]> => {
  const query = supabase
    .from("exercises")
    .select(ROW_COLUMNS)
    .not("instructions", "is", null)
    .order("name", { ascending: true })

  const { data, error } = await (wave.kind === "ids"
    ? query.in("id", wave.ids)
    : query)

  if (error) throw new Error(`fetching exercises: ${error.message}`)
  return (data ?? []) as ExerciseRow[]
}

/** Logged sets per exercise, the metric the waves are ordered on. */
const fetchLoggedSets = async (): Promise<Map<string, number>> => {
  const page = async (from: number, acc: string[]): Promise<string[]> => {
    const { data, error } = await supabase
      .from("set_logs")
      .select("exercise_id")
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`counting set_logs: ${error.message}`)

    const ids = (data ?? []).map((row) => row.exercise_id as string)
    const total = [...acc, ...ids]
    return ids.length < PAGE_SIZE ? total : page(from + PAGE_SIZE, total)
  }

  return (await page(0, [])).reduce(
    (counts, id) => counts.set(id, (counts.get(id) ?? 0) + 1),
    new Map<string, number>(),
  )
}

const applyWave = async (rows: readonly ExerciseRow[]): Promise<ExerciseRow[]> => {
  if (wave.kind === "ids" || wave.kind === "all") return [...rows]

  const logged = await fetchLoggedSets()
  const countOf = (row: ExerciseRow) => logged.get(row.id) ?? 0

  return wave.kind === "unlogged"
    ? rows.filter((row) => countOf(row) === 0)
    : [...rows].sort((a, b) => countOf(b) - countOf(a)).slice(0, wave.count)
}

// ---------- Providers ----------

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Groq answers an exhausted daily quota with a 43-minute `Retry-After`. Waiting
 * it out would turn a wave into an afternoon, so a backoff longer than this
 * counts as "provider unavailable" and the run moves on — flagging the row,
 * which is the safe direction.
 */
const MAX_BACKOFF_MS = 120_000

class ProviderUnavailableError extends Error {}

const backoffMs = (response: Response, attempt: number): number => {
  const retryAfter = Number(response.headers.get("retry-after"))
  return Number.isFinite(retryAfter) && retryAfter > 0
    ? retryAfter * 1000
    : attempt * 15_000
}

/**
 * Retries on 429 and 5xx, honouring the server's own `Retry-After` — the spike
 * pattern, not `enrich-instructions.ts`, which ignores 429 and burns the quota
 * answering nothing.
 */
const withRetry = async (
  label: string,
  send: () => Promise<Response>,
  attempt = 1,
): Promise<Response> => {
  const response = await send()
  if (response.status !== 429 && response.status < 500) return response
  if (attempt > 4) return response

  const waitMs = backoffMs(response, attempt)
  if (waitMs > MAX_BACKOFF_MS) {
    throw new ProviderUnavailableError(
      `${label} asked for ${Math.round(waitMs / 1000)}s of backoff (HTTP ${response.status})`,
    )
  }
  console.log(`   ${label}: HTTP ${response.status}, waiting ${Math.round(waitMs / 1000)}s`)
  await sleep(waitMs)
  return withRetry(label, send, attempt + 1)
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> }
    finishReason?: string
  }>
  promptFeedback?: { blockReason?: string }
}

/**
 * Thinking is switched off explicitly: thoughts are drawn from the output
 * budget, and with it on the model spends the budget reasoning and returns an
 * empty candidate.
 */
const callGemini = async (prompt: Prompt): Promise<string> => {
  const response = await withRetry("gemini", () =>
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt.system }] },
          contents: [{ role: "user", parts: [{ text: prompt.user }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8000,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    ),
  )

  if (!response.ok) {
    throw new Error(`gemini HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`)
  }

  const data = (await response.json()) as GeminiResponse
  const candidate = data.candidates?.[0]
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => part.thought !== true)
    .map((part) => part.text ?? "")
    .join("")

  if (!text) {
    // Keep the reason: an empty candidate is either a safety block or a budget
    // exhausted by thinking, and the two are fixed differently.
    const why = data.promptFeedback?.blockReason ?? candidate?.finishReason ?? "empty candidate"
    throw new Error(`gemini returned no text (${why})`)
  }
  return text
}

const callGroq = async (prompt: Prompt): Promise<string> => {
  const response = await withRetry("groq", () =>
    fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        max_tokens: 1200,
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    }),
  )

  if (!response.ok) {
    throw new Error(`groq HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`)
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return data.choices?.[0]?.message?.content ?? ""
}

/** Candidates always carry French instructions; the predicate guarantees it. */
const promptSubject = (row: ExerciseRow) => ({
  name: row.name,
  name_en: row.name_en,
  muscle_group: row.muscle_group,
  equipment: row.equipment,
  instructions: row.instructions as ExerciseInstructions,
})

/**
 * `null` means "no second opinion", never "no objection". Every failure mode of
 * the cross-checker collapses into it: no key, dead quota, HTTP error,
 * unparseable verdict.
 */
const crossCheck = async (
  row: ExerciseRow,
  translation: ExerciseInstructions,
): Promise<TranslationObjection[] | null> => {
  if (!GROQ_API_KEY) return null
  try {
    const raw = await callGroq(buildReviewPrompt(promptSubject(row), translation))
    return parseObjections(raw, translation)
  } catch (error) {
    console.log(`   cross-check unavailable: ${(error as Error).message}`)
    return null
  }
}

// ---------- Run ----------

interface RowResult {
  row: ExerciseRow
  state: "written" | "previewed" | "skipped" | "halted"
  status?: PipelineStatus
  flags: string[]
  objections: TranslationObjection[] | null
  reason?: string
}

const QUOTA_STRIKES = 2

const describe = (result: RowResult): string => {
  const objections = (result.objections ?? []).map(
    ({ section, index, verdict, note }) => `${section}.${index} ${verdict}: ${note}`,
  )
  const parts = [...result.flags, ...objections]
  return parts.length === 0 ? "" : ` — ${parts.join("; ")}`
}

const translateRow = async (row: ExerciseRow): Promise<RowResult> => {
  const subject = promptSubject(row)
  const raw = await callGemini(buildPrompt(subject))
  const translation = parseInstructions(raw)

  if (!translation) {
    // Skipped, columns untouched: the next run picks the row up again.
    return {
      row,
      state: "skipped",
      flags: [],
      objections: null,
      reason: `unparseable model answer (${raw.length} chars)`,
    }
  }

  const flags = gateFlags(checkTranslation(subject, translation))
  const objections = await crossCheck(row, translation)
  const update = buildTranslationUpdate({
    translation,
    gateFlags: flags,
    objections,
    model: GEMINI_MODEL,
    checkerModel: GROQ_MODEL,
    translatedAt: new Date().toISOString(),
  })

  if (!APPLY) {
    return {
      row,
      state: "previewed",
      status: update.instructions_en_status,
      flags,
      objections,
    }
  }

  const { error } = await supabase.from("exercises").update(update).eq("id", row.id)
  if (error) throw new Error(`writing ${row.id}: ${error.message}`)

  return {
    row,
    state: "written",
    status: update.instructions_en_status,
    flags,
    objections,
  }
}

const quotaExhausted = (results: readonly RowResult[]): boolean =>
  results.length >= QUOTA_STRIKES &&
  results.slice(-QUOTA_STRIKES).every((result) => result.reason?.startsWith("provider") === true)

const candidates = (await fetchCandidates()).filter((row) =>
  isTranslationCandidate(row, { force: FORCE }),
)
const rows = await applyWave(candidates)

console.log(
  `${APPLY ? "APPLY" : "DRY RUN"} · wave ${wave.kind}${FORCE ? " · force" : ""} · ` +
    `${rows.length} row${rows.length === 1 ? "" : "s"} · ${GEMINI_MODEL} + ${GROQ_MODEL}\n`,
)

/**
 * Sequential on purpose: both free tiers rate-limit per minute, and each row is
 * written atomically, so an interruption leaves untouched rows at NULL and the
 * next run resumes exactly where this one stopped.
 */
const results = await rows.reduce<Promise<RowResult[]>>(async (previous, row) => {
  const done = await previous
  const label = row.name_en ?? row.name

  if (quotaExhausted(done)) {
    return [...done, { row, state: "halted", flags: [], objections: null }]
  }

  try {
    const result = await translateRow(row)
    const icon = result.state === "skipped" ? "✗" : result.status === "clean" ? "✓" : "⚠"
    console.log(`${icon} ${label}${result.reason ? ` — ${result.reason}` : describe(result)}`)
    if (VERBOSE && result.state !== "skipped") {
      console.log(JSON.stringify(result, null, 2))
    }
    return [...done, result]
  } catch (error) {
    const message = (error as Error).message
    const reason =
      error instanceof ProviderUnavailableError ? `provider unavailable: ${message}` : message
    console.log(`✗ ${label} — ${reason}`)
    return [...done, { row, state: "skipped", flags: [], objections: null, reason }]
  }
}, Promise.resolve([]))

const count = (predicate: (result: RowResult) => boolean) => results.filter(predicate).length

console.log(
  `\n${count((r) => r.status === "clean")} clean · ` +
    `${count((r) => r.status === "flagged")} flagged · ` +
    `${count((r) => r.state === "skipped")} skipped · ` +
    `${count((r) => r.state === "halted")} not attempted`,
)

if (!APPLY) {
  console.log("Nothing was written. Pass --apply to persist.")
}
