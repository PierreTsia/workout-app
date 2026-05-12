// Re-exports + purpose dispatch for the embedded-agent prompt module
// (T132, #343). Consumers should generally import from this barrel rather
// than reaching into per-purpose files — that way the handler can keep a
// single `prompt/` boundary and `buildSystemPromptFor(purpose, args)` /
// `parseReadySignalFor(purpose, content)` route to the right implementation.
//
// Direct imports from `./onboarding.ts` / `./additional-program.ts` are
// allowed for tests and call sites that are purpose-specific by construction
// (e.g. `prompt/onboarding_test.ts`).

import type { ThreadPurpose, ThreadLocale } from "../threadStore.ts"
import type { UserContextProfile } from "./shared.ts"
import * as onboarding from "./onboarding.ts"
import * as additional from "./additional-program.ts"

// Re-export per-flow surfaces under their original names so existing call
// sites (handler.ts) don't break during the T132 → T134 transition. T134
// will swap explicit `buildSystemPrompt` / `parseReadySignal` references
// over to the `*For(purpose, ...)` dispatchers once `/send` routes by
// purpose at the handler layer.
export { buildSystemPrompt, parseReadySignal } from "./onboarding.ts"
export type { ReadySignalResult, BuildSystemPromptInput } from "./onboarding.ts"

export type { UserContextProfile } from "./shared.ts"
export { parseReadySignalCore, READY_SIGNAL_LINE, LOCALE_INSTRUCTION } from "./shared.ts"

// Re-export the additional-program surfaces (different signatures from
// their onboarding namesakes — namespaced exports keep both reachable).
export {
  buildSystemPrompt as buildAdditionalProgramSystemPrompt,
  parseReadySignal as parseAdditionalProgramReadySignal,
} from "./additional-program.ts"
export type {
  AdditionalProgramBundle,
  AdditionalProgramReadySignalResult,
  ValidatorRejection,
} from "./additional-program.ts"

// ─────────────────────────────────────────────────────────────────────────────
// Purpose dispatch
// ─────────────────────────────────────────────────────────────────────────────

type BuildArgs =
  | { purpose: "onboarding"; locale: ThreadLocale; userProfile: UserContextProfile }
  | { purpose: "additional_program"; locale: ThreadLocale; bundle: additional.AdditionalProgramBundle }

/**
 * Purpose-aware system prompt composer. Routes to the per-flow builder
 * based on `purpose`. Discriminated-union signature ensures callers must
 * pass `userProfile` for onboarding and `bundle` for additional_program at
 * compile time — no runtime branching on missing args.
 */
export function buildSystemPromptFor(args: BuildArgs): string {
  if (args.purpose === "onboarding") {
    return onboarding.buildSystemPrompt({
      locale: args.locale,
      userProfile: args.userProfile,
    })
  }
  return additional.buildSystemPrompt({ locale: args.locale, bundle: args.bundle })
}

export type ParsedReadySignal =
  | { purpose: "onboarding"; result: onboarding.ReadySignalResult }
  | {
      purpose: "additional_program"
      result: additional.AdditionalProgramReadySignalResult
    }

/**
 * Purpose-aware ready-signal validator. Routes to the per-flow validator
 * and tags the result with the purpose so callers don't need a second
 * branch to know which result shape they're holding.
 */
export function parseReadySignalFor(
  purpose: ThreadPurpose,
  content: string,
): ParsedReadySignal {
  if (purpose === "onboarding") {
    return { purpose: "onboarding", result: onboarding.parseReadySignal(content) }
  }
  return {
    purpose: "additional_program",
    result: additional.parseReadySignal(content),
  }
}
