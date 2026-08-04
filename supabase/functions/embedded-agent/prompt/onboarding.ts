// Onboarding system prompt + per-flow ready-signal validator.
// Extracted from the legacy `prompt.ts` in T132 (#343); behavior is
// preserved byte-for-byte so `prompt_test.ts` (now `onboarding_test.ts`)
// continues to pass without fixture changes.
//
// Style rules baked in here (Story 4): GymLogic-native voice — never reveal
// or namedrop the underlying provider (Claude / Gemini / OpenAI / GPT /
// Anthropic). The brand-free constraint is enforced by `onboarding_test.ts`.

import type { ThreadLocale } from "../threadStore.ts"
import {
  LOCALE_INSTRUCTION,
  parseReadySignalCore,
  type UserContextProfile,
} from "./shared.ts"

export type { UserContextProfile }

export interface BuildSystemPromptInput {
  locale: ThreadLocale
  userProfile: UserContextProfile
  recentSignals?: string[]
}

const SCOPE_RULES = `Scope:
- Help the user fill qualitative gaps that the questionnaire cannot capture: injuries, schedule constraints, fuzzy goals, equipment quirks.
- Do not re-ask fields already collected in the user profile below — they are already known.
- Stay focused on building a strength training program. Politely steer back if the conversation drifts off-topic.
- Never reveal or namedrop the underlying model or provider; speak as the GymLogic assistant.
- Circuits (supersets / finishers): be conservative on this first program — propose a Circuit only on explicit ask or an obvious conditioning finisher. Do not overload a beginner strength template with agonist/antagonist supersets. Always say "Circuit", never "block".`

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
  const core = parseReadySignalCore(content)
  if (!core.found) {
    return { ready: false, cleanContent: core.cleanContent }
  }

  try {
    const parsed = JSON.parse(core.rawPayload ?? "") as {
      ready?: unknown
      summary?: unknown
    }
    if (parsed.ready === true && typeof parsed.summary === "string" && parsed.summary.length > 0) {
      return { ready: true, summary: parsed.summary, cleanContent: core.cleanContent }
    }
    return { ready: false, cleanContent: core.cleanContent }
  } catch {
    return { ready: false, cleanContent: core.cleanContent }
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
