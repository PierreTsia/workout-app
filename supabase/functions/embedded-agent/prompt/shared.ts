// Shared cross-purpose prompt primitives (T132, #343).
//
// Anything that BOTH the onboarding and additional-program flows need lives
// here:
//   - LOCALE_INSTRUCTION: the per-locale lead-in string.
//   - READY_SIGNAL_LINE: the regex that matches the canonical ready-signal
//     line in an assistant reply. The shape is `READY_FOR_PROGRAM_DRAFT: {…}`.
//   - parseReadySignalCore: regex match + JSON parse + content stripping.
//     Per-flow validators (`onboarding.parseReadySignal` /
//     `additional-program.parseReadySignal`) call this first, then layer
//     their own field validation on top.
//   - UserContextProfile: the questionnaire-derived profile shape. Used by
//     onboarding prompts AND by `draft.ts` for both flows (since drafting
//     against a profile is the same plumbing regardless of purpose).
//
// This module is intentionally tiny: dispatch lives in `./index.ts`, copy
// lives in `./onboarding.ts` / `./additional-program.ts`. Anything bigger
// here makes the per-purpose split pointless.

import type { ThreadLocale } from "../threadStore.ts"

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

export const LOCALE_INSTRUCTION: Record<ThreadLocale, string> = {
  en: "Always respond in English for both natural-language replies and any structured JSON.",
  fr: "Réponds toujours en français pour les réponses en langage naturel comme pour le JSON structuré.",
}

// Matches the literal `READY_FOR_PROGRAM_DRAFT: { ... }` line as taught by
// the system prompt. We accept anything between the curly braces (validation
// happens after JSON.parse) and consume optional trailing whitespace so the
// stripped content doesn't end with awkward dangling newlines. The trailing
// segment is intentionally non-greedy + non-newline so we only ever consume
// one line, even if the model accidentally emits multiple signals.
export const READY_SIGNAL_LINE = /READY_FOR_PROGRAM_DRAFT:\s*\{[^\n]*\}/

export interface ReadySignalCore {
  // Whether a ready-signal line was found at all in `content`. When false,
  // `rawPayload` is undefined and `cleanContent` === input (no strip).
  found: boolean
  // The literal JSON payload between the braces (no surrounding markers).
  // Present even when JSON is malformed — caller decides how to react.
  rawPayload?: string
  // Input with the matched signal line stripped (+ trailing whitespace
  // trimmed). Always safe to surface to the chat UI — the raw signal
  // never leaks even when validation downstream rejects.
  cleanContent: string
}

/**
 * Bare regex match + content strip + JSON-line extraction. No field
 * validation, no purpose semantics — that's the per-flow validator's job.
 *
 * Returns `{ found: false, cleanContent: input }` when no signal line is
 * present. Returns `{ found: true, rawPayload, cleanContent }` otherwise,
 * even if `rawPayload` is unparseable JSON — the caller MUST decide
 * whether malformed JSON is a soft "not ready" or a hard validator
 * rejection.
 */
export function parseReadySignalCore(content: string): ReadySignalCore {
  const match = content.match(READY_SIGNAL_LINE)
  if (!match) {
    return { found: false, cleanContent: content }
  }
  const cleanContent = content.replace(READY_SIGNAL_LINE, "").trimEnd()
  const jsonStart = match[0].indexOf("{")
  const rawPayload = match[0].slice(jsonStart)
  return { found: true, rawPayload, cleanContent }
}
