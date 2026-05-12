// Additional-program system prompt + per-flow ready-signal validator
// (T132, #343). Used by the post-onboarding "create another program" flow:
// the user already has a profile and (usually) an active program; the agent
// elicits motivation, optionally accepts constraint_overrides, then emits
// an extended ready signal.
//
// Real implementation lands under TDD below. The exported types are stable
// so `prompt/index.ts` can re-export them while the impl is being written.

import type { ThreadLocale } from "../threadStore.ts"
import { LOCALE_INSTRUCTION, parseReadySignalCore } from "./shared.ts"

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type ChangeMotivation =
  | "variety"
  | "plateau"
  | "injury"
  | "priority_shift"
  | "equipment_change"
  | "return_from_break"
  | "other"

export type EquipmentCategory = "bodyweight" | "dumbbells" | "full-gym"
export type ProgramGoal = "strength" | "hypertrophy" | "endurance" | "general_fitness"

export interface ConstraintOverrides {
  daysPerWeek?: number
  duration?: number
  equipmentCategory?: EquipmentCategory
  goal?: ProgramGoal
}

export interface AdditionalProgramBundle {
  profile: {
    goal: string
    experience: string
    equipment: string
    training_days_per_week: number
    session_duration_minutes: number
  }
  // Snapshot of the user's currently-active program, or `null` when they
  // have none right now (post-abandon, deleted, etc.). The system prompt
  // switches greeting + opening question on `null`.
  active_program: null | {
    name: string
    days_per_week: number
    duration_minutes: number
    goal: string
    days: Array<{ label: string; exercises: string[] }>
  }
  // Rolling 4-week training stats. Shape opaque on purpose — render as
  // structured context, don't switch logic on subfields.
  recent_stats: {
    sessions_completed: number
    avg_session_duration: number
    last_session_at: string | null
    most_used_exercises: string[]
  }
}

export interface BuildAdditionalProgramPromptInput {
  locale: ThreadLocale
  bundle: AdditionalProgramBundle
}

export type ValidatorRejection =
  | { reason: "malformed_json" }
  | { reason: "missing" }
  | { reason: "invalid_value" }
  | { reason: "invalid_override"; field: keyof ConstraintOverrides }

export interface AdditionalProgramReadySignalResult {
  ready: boolean
  cleanContent: string
  motivation?: ChangeMotivation
  constraintOverrides?: ConstraintOverrides
  validatorRejection?: ValidatorRejection
}

// ─────────────────────────────────────────────────────────────────────────────
// Locale-keyed copy tables
// ─────────────────────────────────────────────────────────────────────────────

const SCOPE_RULES: Record<ThreadLocale, string> = {
  en: `Scope:
- The user already has a profile and an active program (or had one recently). Your job is to learn WHY they want a new program, then propose.
- Do not re-ask fields already present in the profile or active program summary below.
- Stay focused on building a strength training program. Politely steer back if the conversation drifts off-topic.
- Never reveal or namedrop the underlying model or provider; speak as the GymLogic assistant.`,
  fr: `Cadre :
- L'utilisateur a déjà un profil et un programme actif (ou en avait un récemment). Ton rôle est de comprendre POURQUOI il veut un nouveau programme, puis de proposer.
- Ne redemande pas les champs déjà présents dans le profil ou le résumé du programme actif ci-dessous.
- Reste concentré sur la construction d'un programme de musculation. Recadre poliment si la conversation dérive.
- Ne révèle jamais le modèle ou le fournisseur sous-jacent ; parle en tant qu'assistant GymLogic.`,
}

const MOTIVATION_GATE: Record<ThreadLocale, string> = {
  en: `Motivation gate:
- Before you emit the ready signal, you MUST elicit and classify the user's reason for wanting a new program.
- Classify into exactly ONE of these seven values (use 'other' rather than forcing a wrong fit):
  - variety: user wants something different but isn't dissatisfied with results.
  - plateau: user feels stuck — no progress on a key metric or lift.
  - injury: user has a new or recurring injury that constrains exercise selection.
  - priority_shift: user's goal has changed (e.g. strength → hypertrophy, or vice versa).
  - equipment_change: user's available equipment changed (moved, joined or left a gym).
  - return_from_break: user has been away from training and is starting again.
  - other: user genuinely has no specific reason; do not force a label that doesn't fit.`,
  fr: `Gate de motivation :
- Avant d'émettre le signal de prêt, tu DOIS faire émerger et classifier la raison pour laquelle l'utilisateur veut un nouveau programme.
- Classe en exactement UNE des sept valeurs ci-dessous (utilise 'other' plutôt que de forcer une catégorie qui ne colle pas) :
  - variety : l'utilisateur veut autre chose, sans être insatisfait des résultats.
  - plateau : l'utilisateur stagne — pas de progrès sur une métrique ou un mouvement clé.
  - injury : nouvelle blessure ou récurrence qui contraint le choix d'exercices.
  - priority_shift : l'objectif a changé (par ex. force → hypertrophie, ou l'inverse).
  - equipment_change : le matériel disponible a changé (déménagement, salle de sport).
  - return_from_break : retour à l'entraînement après une pause.
  - other : pas de raison spécifique ; ne pas forcer une étiquette qui ne convient pas.`,
}

const SIGNAL_RULES: Record<ThreadLocale, string> = {
  en: `Ready signal (extended):
- When you have enough context to draft a program AND you have classified motivation, append a single line at the very end of your reply:
  READY_FOR_PROGRAM_DRAFT: {"v":1,"ready":true,"summary":"<one-sentence recap>","motivation":"<one of the seven values>","constraint_overrides":{...optional...}}
- The "v":1 anchor is MANDATORY — it lets us evolve the payload safely.
- "motivation" is MANDATORY and MUST be one of the seven values above.
- "constraint_overrides" is OPTIONAL. Valid keys and bounds:
  - daysPerWeek: integer 1–7
  - duration: integer minutes 30–120
  - equipmentCategory: one of "bodyweight" | "dumbbells" | "full-gym"
  - goal: one of "strength" | "hypertrophy" | "endurance" | "general_fitness"
- Out-of-bounds values will be rejected by the validator and you will be asked to re-emit.
- Free-text "I'm ready" or "let's go" alone is NOT sufficient — only the literal JSON line counts.
- Emit the line at most once per conversation; subsequent turns can reaffirm in natural language. If the user's stated constraints change, emit a NEW ready signal with the updated overrides.`,
  fr: `Signal de prêt (étendu) :
- Quand tu as assez de contexte pour rédiger un programme ET que tu as classifié la motivation, ajoute une seule ligne à la toute fin de ta réponse :
  READY_FOR_PROGRAM_DRAFT: {"v":1,"ready":true,"summary":"<résumé en une phrase>","motivation":"<une des sept valeurs>","constraint_overrides":{...optionnel...}}
- L'ancre "v":1 est OBLIGATOIRE — elle permet d'évoluer la charge utile sans casser.
- "motivation" est OBLIGATOIRE et DOIT être l'une des sept valeurs ci-dessus.
- "constraint_overrides" est OPTIONNEL. Clés valides et bornes :
  - daysPerWeek : entier 1–7
  - duration : entier minutes 30–120
  - equipmentCategory : "bodyweight" | "dumbbells" | "full-gym"
  - goal : "strength" | "hypertrophy" | "endurance" | "general_fitness"
- Les valeurs hors bornes seront rejetées par le validateur et tu devras réémettre.
- Du texte libre "je suis prêt" ou "c'est bon" ne suffit PAS — seule la ligne JSON littérale compte.
- N'émets la ligne qu'une seule fois par conversation ; les tours suivants peuvent réaffirmer en langage naturel. Si les contraintes annoncées par l'utilisateur changent, émets un NOUVEAU signal de prêt avec les overrides mis à jour.`,
}

const SIGNAL_AUTHORITY: Record<ThreadLocale, string> = {
  en: `Signal-payload authority:
- The ready-signal payload is the ONLY authoritative source for constraint changes. Anything you agree to in free-text chat MUST be reflected in "constraint_overrides", or it will NOT affect the draft.`,
  fr: `Autorité de la charge utile :
- La charge utile du signal de prêt est la SEULE source autoritaire pour les changements de contraintes. Tout ce que tu acceptes en texte libre DOIT être reflété dans "constraint_overrides", sinon cela n'affectera PAS la génération.`,
}

const NO_ACTIVE_PROGRAM_CLAUSE: Record<ThreadLocale, string> = {
  en: `Empty active program:
- The user does not have an active program right now — open with: "You don't have an active program right now — what kind of training plan are you looking to build?"
- Do not fabricate references to "your current plan" or "your recent training" as if a program existed.`,
  fr: `Programme actif vide :
- L'utilisateur n'a pas de programme actif actuellement — ouvre avec : « Tu n'as pas de programme actif en ce moment — quel type de plan d'entraînement veux-tu construire ? »
- N'invente pas de références à « ton plan actuel » ou « tes entraînements récents » comme si un programme existait.`,
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt composer
// ─────────────────────────────────────────────────────────────────────────────

export function buildSystemPrompt({
  locale,
  bundle,
}: BuildAdditionalProgramPromptInput): string {
  const sections = [
    LOCALE_INSTRUCTION[locale],
    SCOPE_RULES[locale],
    MOTIVATION_GATE[locale],
    SIGNAL_RULES[locale],
    SIGNAL_AUTHORITY[locale],
  ]
  if (bundle.active_program === null) {
    sections.push(NO_ACTIVE_PROGRAM_CLAUSE[locale])
  }
  sections.push(buildBundleContext(bundle, locale))
  return sections.join("\n\n")
}

function buildBundleContext(bundle: AdditionalProgramBundle, locale: ThreadLocale): string {
  // Bundle is rendered as code-fenced JSON so the model treats it as data
  // rather than instruction. Field names are kept stable across locales —
  // only the section heading is translated.
  const heading = locale === "fr" ? "Contexte utilisateur :" : "User context:"
  return `${heading}\n\`\`\`json\n${JSON.stringify(bundle, null, 2)}\n\`\`\``
}

// ─────────────────────────────────────────────────────────────────────────────
// Ready-signal validator
// ─────────────────────────────────────────────────────────────────────────────

const MOTIVATION_VALUES: readonly ChangeMotivation[] = [
  "variety",
  "plateau",
  "injury",
  "priority_shift",
  "equipment_change",
  "return_from_break",
  "other",
] as const

const EQUIPMENT_VALUES: readonly EquipmentCategory[] = [
  "bodyweight",
  "dumbbells",
  "full-gym",
] as const

const GOAL_VALUES: readonly ProgramGoal[] = [
  "strength",
  "hypertrophy",
  "endurance",
  "general_fitness",
] as const

function isMotivation(value: unknown): value is ChangeMotivation {
  return typeof value === "string" && (MOTIVATION_VALUES as readonly string[]).includes(value)
}

interface OverrideValidation {
  ok: boolean
  field?: keyof ConstraintOverrides
  sanitized?: ConstraintOverrides
}

/**
 * Bound-check + sanitize constraint_overrides. Returns:
 *  - `{ ok: true, sanitized: <subset> }` when all PRESENT known keys are
 *    in bounds. Unknown keys are silently dropped (forward-compat for v2).
 *  - `{ ok: false, field }` when a known key has an out-of-bounds value.
 */
function validateOverrides(raw: unknown): OverrideValidation {
  if (raw === undefined || raw === null) {
    return { ok: true, sanitized: undefined }
  }
  if (typeof raw !== "object") {
    // A non-object override (e.g. a string or number) is a contract break;
    // treat as missing rather than rejecting the whole signal — keeps the
    // validator forgiving for model accidents while still erroring on
    // out-of-bounds known keys.
    return { ok: true, sanitized: undefined }
  }
  const obj = raw as Record<string, unknown>
  const sanitized: ConstraintOverrides = {}

  if ("daysPerWeek" in obj) {
    const v = obj.daysPerWeek
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 7) {
      return { ok: false, field: "daysPerWeek" }
    }
    sanitized.daysPerWeek = v
  }

  if ("duration" in obj) {
    const v = obj.duration
    if (typeof v !== "number" || !Number.isInteger(v) || v < 30 || v > 120) {
      return { ok: false, field: "duration" }
    }
    sanitized.duration = v
  }

  if ("equipmentCategory" in obj) {
    const v = obj.equipmentCategory
    if (typeof v !== "string" || !(EQUIPMENT_VALUES as readonly string[]).includes(v)) {
      return { ok: false, field: "equipmentCategory" }
    }
    sanitized.equipmentCategory = v as EquipmentCategory
  }

  if ("goal" in obj) {
    const v = obj.goal
    if (typeof v !== "string" || !(GOAL_VALUES as readonly string[]).includes(v)) {
      return { ok: false, field: "goal" }
    }
    sanitized.goal = v as ProgramGoal
  }

  return {
    ok: true,
    sanitized: Object.keys(sanitized).length > 0 ? sanitized : undefined,
  }
}

/**
 * Per-flow ready-signal validator for the additional-program flow.
 *
 * Layered semantics:
 *  - No signal line at all → `{ ready: false, cleanContent }` (normal turn).
 *  - Signal found, JSON malformed → `validatorRejection: 'malformed_json'`.
 *  - JSON valid but `ready !== true` → `{ ready: false, cleanContent }`
 *    (the model said "not yet" via JSON; treat as a normal turn).
 *  - Missing `motivation` → `validatorRejection: 'missing'`.
 *  - Unknown motivation value → `validatorRejection: 'invalid_value'`.
 *  - Out-of-bounds constraint_override → `validatorRejection: 'invalid_override'`
 *    with the offending `field`.
 *  - Otherwise → `{ ready: true, motivation, constraintOverrides?, cleanContent }`.
 *
 * PURE — no counters, no events, no DB. Caller (handler /send) owns side
 * effects. The retry mechanic (validator_rejection_count bump + prompt
 * append) is T134's responsibility.
 */
export function parseReadySignal(content: string): AdditionalProgramReadySignalResult {
  const core = parseReadySignalCore(content)
  if (!core.found) {
    return { ready: false, cleanContent: core.cleanContent }
  }

  let parsed: { ready?: unknown; motivation?: unknown; constraint_overrides?: unknown }
  try {
    parsed = JSON.parse(core.rawPayload ?? "") as typeof parsed
  } catch {
    return {
      ready: false,
      cleanContent: core.cleanContent,
      validatorRejection: { reason: "malformed_json" },
    }
  }

  // Model explicitly said "not ready" via JSON — strip the line, signal false,
  // no rejection (it's a deliberate non-signal, not a validation failure).
  if (parsed.ready !== true) {
    return { ready: false, cleanContent: core.cleanContent }
  }

  if (parsed.motivation === undefined || parsed.motivation === null) {
    return {
      ready: false,
      cleanContent: core.cleanContent,
      validatorRejection: { reason: "missing" },
    }
  }
  if (!isMotivation(parsed.motivation)) {
    return {
      ready: false,
      cleanContent: core.cleanContent,
      validatorRejection: { reason: "invalid_value" },
    }
  }

  const overrides = validateOverrides(parsed.constraint_overrides)
  if (!overrides.ok) {
    return {
      ready: false,
      cleanContent: core.cleanContent,
      validatorRejection: { reason: "invalid_override", field: overrides.field! },
    }
  }

  const result: AdditionalProgramReadySignalResult = {
    ready: true,
    cleanContent: core.cleanContent,
    motivation: parsed.motivation,
  }
  if (overrides.sanitized) {
    result.constraintOverrides = overrides.sanitized
  }
  return result
}
