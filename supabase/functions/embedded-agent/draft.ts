// Program draft step for the Embedded Agent (T119).
//
// Wraps the existing `generate-program` plumbing (catalog fetch +
// `buildProgramPrompt` + `callGeminiProgram` + `validateProgram`) and
// extends the prompt with the chat transcript so the model has both the
// deterministic onboarding profile *and* the qualitative gaps the user
// surfaced in conversation. Returns args mapped to MCP `create_program`
// shape; the route layer (`/draft`) is responsible for the actual MCP
// invocation, quota gating, and `last_preview` persistence.
//
// Test seam: every external dep (catalog / profile / history / model) is
// injected via `DraftDeps` so `draft_test.ts` can exercise this module
// without spinning up Supabase or Gemini.

import type { Thread, ThreadMessage } from "./threadStore.ts"
import type { UserContextProfile } from "./prompt.ts"
import {
  buildProgramPrompt,
  capCatalog,
  getEquipmentValues,
  getExerciseBounds,
  validateProgram,
  type CatalogExercise,
  type GenerateProgramResponse,
  type ProgramConstraints,
  type RecentExercise,
  type UserProfile as ProgramUserProfile,
} from "../_shared/programDraft.ts"
import type { McpToolResult } from "../_shared/mcpClient.ts"

export const LAST_PREVIEW_MAX_BYTES = 32_768

const TRAINING_GAP_DAYS = 14

export interface DraftDeps {
  fetchCatalog: (equipmentValues: string[]) => Promise<CatalogExercise[]>
  fetchProfile: (userId: string) => Promise<ProgramUserProfile | null>
  fetchRecentHistory: (
    userId: string,
  ) => Promise<{ exercises: RecentExercise[]; lastSessionAt: string | null }>
  callModel: (prompt: string) => Promise<GenerateProgramResponse>
}

export interface DraftInput {
  userId: string
  locale: "en" | "fr"
  thread: Thread
  profile: UserContextProfile
}

export interface DraftArgs {
  // Maps directly to MCP `create_program` arguments (sans `dry_run`,
  // which the /draft route adds when invoking).
  name: string
  days: Array<{ label: string; exercises: string[] }>
}

export type DraftResult =
  | { ok: true; args: DraftArgs }
  | { ok: false; error: "no_catalog" | "model_failure" | "empty_program" }

export async function runProgramDraftStep(
  input: DraftInput,
  deps: DraftDeps,
): Promise<DraftResult> {
  const constraints: ProgramConstraints = {
    daysPerWeek: input.profile.training_days_per_week,
    duration: input.profile.session_duration_minutes,
    equipmentCategory: profileEquipmentToCategory(input.profile.equipment),
    goal: input.profile.goal,
    experience: input.profile.experience,
    locale: input.locale,
  }

  const equipmentValues = getEquipmentValues(constraints.equipmentCategory)
  const exerciseBounds = getExerciseBounds(constraints.duration)

  const [catalog, programProfile, history] = await Promise.all([
    deps.fetchCatalog(equipmentValues),
    deps.fetchProfile(input.userId),
    deps.fetchRecentHistory(input.userId),
  ])

  const cappedCatalog = capCatalog(catalog)
  if (cappedCatalog.length === 0) {
    return { ok: false, error: "no_catalog" }
  }

  const trainingGap = computeTrainingGap(history.lastSessionAt)
  const basePrompt = buildProgramPrompt(
    cappedCatalog,
    programProfile,
    history.exercises,
    constraints,
    trainingGap,
  )

  // Embedded-agent extension: append the chat transcript so the model
  // gets the qualitative context the user surfaced in conversation
  // (injuries, schedule quirks, gym constraints) on top of the
  // deterministic profile from the questionnaire.
  const transcript = formatTranscript(input.thread.messages ?? [])
  const prompt = transcript
    ? `${basePrompt}\n\nADDITIONAL CONTEXT FROM ONBOARDING CHAT:\n${transcript}`
    : basePrompt

  let llmOutput: GenerateProgramResponse
  try {
    llmOutput = await deps.callModel(prompt)
  } catch {
    return { ok: false, error: "model_failure" }
  }

  const validated = validateProgram(
    llmOutput,
    cappedCatalog.map((e) => ({ id: e.id, muscle_group: e.muscle_group })),
    constraints.daysPerWeek,
    exerciseBounds,
  )

  // Drop days that ended up empty after validation + backfill: this happens
  // in the wild when the model proposes more days than the catalog can fill
  // (small equipment categories, repeated muscle_focus exhausting the pool).
  // MCP `create_program` rejects days with `exercises: []` as a tool_error,
  // so we filter here rather than ship a draft we know will fail downstream.
  const nonEmptyDays = validated.days.filter((d) => d.exercise_ids.length > 0)
  if (nonEmptyDays.length === 0) {
    return { ok: false, error: "empty_program" }
  }

  const args: DraftArgs = {
    name: programNameFor(constraints, input.locale),
    days: nonEmptyDays.map((d) => ({
      label: d.label,
      // Bare UUIDs — MCP `create_program` accepts these natively and
      // applies catalog defaults (3 sets, 10 reps, 0 kg, 90s rest). T120
      // can surface a "tweak prescriptions" UI on top of these defaults.
      exercises: d.exercise_ids,
    })),
  }
  return { ok: true, args }
}

// Bridge the questionnaire vocabulary (`user_profiles.equipment`) to the
// constraint vocabulary that `getEquipmentValues` understands. Without
// this translation a real user profile (where `equipment` is "gym") gets
// passed through to `getEquipmentValues("gym") → []` and the catalog
// query returns zero rows, killing /draft with `no_catalog`. Same map
// as the frontend `mapEquipmentToCategory` (src/components/create-program/
// schema.ts) — duplicated here because Deno can't import from the Vite
// frontend; worth extracting to `_shared/` next time we touch this.
const PROFILE_TO_CATEGORY: Record<string, string> = {
  gym: "full-gym",
  home: "dumbbells",
  minimal: "bodyweight",
}

function profileEquipmentToCategory(profileEquipment: string): string {
  return PROFILE_TO_CATEGORY[profileEquipment] ?? profileEquipment
}

function computeTrainingGap(lastSessionAt: string | null): boolean {
  if (!lastSessionAt) return true
  const daysAgo = (Date.now() - new Date(lastSessionAt).getTime()) /
    (1000 * 60 * 60 * 24)
  return daysAgo > TRAINING_GAP_DAYS
}

function formatTranscript(messages: ThreadMessage[]): string {
  if (messages.length === 0) return ""
  return messages
    .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
    .join("\n\n")
}

const GOAL_LABELS: Record<"en" | "fr", Record<string, string>> = {
  en: {
    strength: "Strength",
    hypertrophy: "Hypertrophy",
    endurance: "Endurance",
    general_fitness: "General fitness",
  },
  fr: {
    strength: "Force",
    hypertrophy: "Hypertrophie",
    endurance: "Endurance",
    general_fitness: "Forme générale",
  },
}

function programNameFor(
  constraints: ProgramConstraints,
  locale: "en" | "fr",
): string {
  const goalLabel = GOAL_LABELS[locale][constraints.goal] ?? constraints.goal
  const cadence = locale === "fr"
    ? `${constraints.daysPerWeek} jours/sem.`
    : `${constraints.daysPerWeek} days/wk`
  return `${goalLabel} — ${cadence}`
}

// ---------- MCP dry-run response → structured rendered preview ----------

/**
 * One day's worth of preview echo lines, ready to render in the preview UI
 * without further parsing. The MCP `create_program` dry-run already produces
 * `formatPrescriptionLine`-shaped strings (e.g. "Bench Press — 4 × 8 × 80 kg
 * total — 120s rest"); we just lift them out of the JSON-as-text wrapper and
 * pair them with their day label so the client doesn't need to JSON.parse a
 * 10 KB MCP payload to display 8 lines.
 */
export interface RenderedDay {
  label: string
  lines: string[]
}

/**
 * Defensive parser: walks `mcpResult.value.content` (or whatever the caller
 * passed), pulls the JSON tail out of the text content, and returns
 * `RenderedDay[]` if the shape matches `{ days: [{ label, rendered }] }`.
 * Returns `null` whenever anything unexpected happens (no content, non-JSON
 * text, missing `days` array). The /draft route treats `null` as "fall back
 * to args-only preview" rather than a 502 — the user still gets a usable
 * draft, just rendered client-side from `args` instead of MCP echo lines.
 */
export function extractRenderedFromMcpResult(result: McpToolResult): RenderedDay[] | null {
  const text = (result.content ?? [])
    .filter((c): c is { type: "text"; text: string } =>
      c?.type === "text" && typeof c.text === "string"
    )
    .map((c) => c.text)
    .join("\n")
  if (!text) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object") return null

  const days = (parsed as { days?: unknown }).days
  if (!Array.isArray(days)) return null

  return days.map((d) => {
    const dayObj = (d ?? {}) as Record<string, unknown>
    const label = typeof dayObj.label === "string" ? dayObj.label : ""
    const rawRendered = Array.isArray(dayObj.rendered) ? dayObj.rendered : []
    const lines = rawRendered.filter((x): x is string => typeof x === "string")
    return { label, lines }
  })
}

// ---------- last_preview size guard ----------

export interface BuildLastPreviewInput {
  args: DraftArgs
  rendered?: RenderedDay[]
}

export interface LastPreview {
  args: DraftArgs
  rendered?: RenderedDay[]
}

/**
 * Trim the persisted preview payload so we don't bloat
 * `embedded_agent_threads.last_preview` past 32 KB. Two ways the rendered
 * field gets dropped:
 *   1. caller passed undefined / empty array — no useful preview to ship,
 *      collapse to args-only so the client only has one fallback path to
 *      handle ("rendered missing" === "render from args").
 *   2. payload exceeds 32 KB once serialized — same fallback applies.
 */
export function buildLastPreview(input: BuildLastPreviewInput): LastPreview {
  if (!input.rendered || input.rendered.length === 0) {
    return { args: input.args }
  }
  const full: LastPreview = { args: input.args, rendered: input.rendered }
  const size = new TextEncoder().encode(JSON.stringify(full)).length
  if (size <= LAST_PREVIEW_MAX_BYTES) return full
  return { args: input.args }
}
