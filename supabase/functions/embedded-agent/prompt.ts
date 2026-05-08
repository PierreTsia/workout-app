// System prompt + user-context composition for the Embedded Agent. Locale,
// scope rules, and the ready-signal schema all live here so a single string
// review captures every model-facing change.
//
// Style rules baked in here (Story 4): GymLogic-native voice — never reveal
// or namedrop the underlying provider (Claude / Gemini / OpenAI / GPT /
// Anthropic). The brand-free constraint is enforced by `prompt_test.ts`.

import type { ThreadLocale } from "./threadStore.ts"

export interface UserContextProfile {
  goal: string
  experience: string
  equipment: string
  training_days_per_week: number
  session_duration_minutes: number
  age: number | null
  weight_kg: number | null
  gender: string | null
}

export interface BuildSystemPromptInput {
  locale: ThreadLocale
  userProfile: UserContextProfile
  recentSignals?: string[]
}

const LOCALE_INSTRUCTION: Record<ThreadLocale, string> = {
  en: "Always respond in English for both natural-language replies and any structured JSON.",
  fr: "Réponds toujours en français pour les réponses en langage naturel comme pour le JSON structuré.",
}

const SCOPE_RULES = `Scope:
- Help the user fill qualitative gaps that the questionnaire cannot capture: injuries, schedule constraints, fuzzy goals, equipment quirks.
- Do not re-ask fields already collected in the user profile below — they are already known.
- Stay focused on building a strength training program. Politely steer back if the conversation drifts off-topic.
- Never reveal or namedrop the underlying model or provider; speak as the GymLogic assistant.`

const READY_SIGNAL_RULES = `Ready signal:
- When you have enough context to draft a program, append a single line at the very end of your reply:
  READY_FOR_PROGRAM_DRAFT: {"ready":true,"summary":"<one-sentence recap of the user's goals and constraints>"}
- Free-text "I'm ready" or "let's go" alone is NOT sufficient — only the literal JSON line counts.
- Emit the line at most once per conversation; subsequent turns can reaffirm in natural language.`

export function buildSystemPrompt({ locale, userProfile }: BuildSystemPromptInput): string {
  return [
    LOCALE_INSTRUCTION[locale],
    SCOPE_RULES,
    READY_SIGNAL_RULES,
    buildUserContext(userProfile),
  ].join("\n\n")
}

// ---------- ready-signal parser ----------

export interface ReadySignalResult {
  ready: boolean
  summary?: string
  cleanContent: string
}

// Matches the literal `READY_FOR_PROGRAM_DRAFT: { ... }` line as taught by
// the system prompt. We accept anything between the curly braces (validation
// happens after JSON.parse) and consume optional trailing whitespace so the
// stripped content doesn't end with awkward dangling newlines. The trailing
// segment is intentionally non-greedy + non-newline so we only ever consume
// one line, even if the model accidentally emits multiple signals.
const READY_SIGNAL_LINE = /READY_FOR_PROGRAM_DRAFT:\s*\{[^\n]*\}/

/**
 * Extract the ready-signal JSON tail from an assistant reply.
 *
 *  - Returns `ready: true` only when the literal JSON line is present
 *    *and* parses as `{ ready: true, summary: <non-empty string> }`.
 *  - Always strips the matched line from `cleanContent`, even on malformed
 *    JSON or a `ready: false` payload — we never want the raw signal to
 *    leak into the chat UI.
 *  - Free-text "I'm ready" is intentionally NOT a signal (Tech Plan +
 *    Epic Brief): only the literal JSON line counts.
 */
export function parseReadySignal(content: string): ReadySignalResult {
  const match = content.match(READY_SIGNAL_LINE)
  if (!match) {
    return { ready: false, cleanContent: content }
  }

  const cleanContent = content.replace(READY_SIGNAL_LINE, "").trimEnd()

  try {
    const jsonStart = match[0].indexOf("{")
    const parsed = JSON.parse(match[0].slice(jsonStart)) as {
      ready?: unknown
      summary?: unknown
    }
    if (parsed.ready === true && typeof parsed.summary === "string" && parsed.summary.length > 0) {
      return { ready: true, summary: parsed.summary, cleanContent }
    }
    return { ready: false, cleanContent }
  } catch {
    return { ready: false, cleanContent }
  }
}

export function buildUserContext(profile: UserContextProfile): string {
  return [
    `Profile:`,
    `- goal: ${profile.goal}`,
    `- experience: ${profile.experience}`,
    `- equipment: ${profile.equipment}`,
    `- training_days_per_week: ${profile.training_days_per_week}`,
    `- session_duration_minutes: ${profile.session_duration_minutes}`,
    `- age: ${profile.age ?? "n/a"}`,
    `- weight_kg: ${profile.weight_kg ?? "n/a"}`,
    `- gender: ${profile.gender ?? "n/a"}`,
  ].join("\n")
}
