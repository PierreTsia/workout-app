import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import * as onboarding from "./onboarding.ts"
import * as additional from "./additional-program.ts"
import { buildSystemPromptFor, parseReadySignalFor } from "./index.ts"

// Dispatch tests (T132, #343). Locks the contract that the barrel routes
// to the correct per-flow implementation. Per-flow behavior is tested in
// `onboarding_test.ts` / `additional-program_test.ts`; here we only assert
// that `buildSystemPromptFor(purpose, ...)` and `parseReadySignalFor(...)`
// produce the same output as calling the per-flow function directly.

const PROFILE = {
  goal: "strength",
  experience: "beginner",
  equipment: "minimal",
  training_days_per_week: 3,
  session_duration_minutes: 45,
  age: 30,
  weight_kg: 80,
  gender: "m",
}

const BUNDLE: additional.AdditionalProgramBundle = {
  v: 1,
  captured_at: "2026-05-12T12:00:00.000Z",
  profile: {
    goal: "strength",
    experience: "beginner",
    equipment: "minimal",
    training_days_per_week: 3,
    session_duration_minutes: 45,
    age: 30,
    weight_kg: 80,
    gender: "m",
  },
  active_program: null,
  recent_stats: {
    window_days: 28,
    total_sessions: 0,
    sessions_per_week: 0,
    top_muscle_groups: [],
    avg_session_duration_minutes: null,
  },
}

Deno.test("buildSystemPromptFor('onboarding') matches the onboarding builder byte-for-byte", () => {
  const dispatched = buildSystemPromptFor({
    purpose: "onboarding",
    locale: "en",
    userProfile: PROFILE,
  })
  const direct = onboarding.buildSystemPrompt({ locale: "en", userProfile: PROFILE })
  assertEquals(dispatched, direct)
})

Deno.test("buildSystemPromptFor('additional_program') matches the additional builder byte-for-byte", () => {
  const dispatched = buildSystemPromptFor({
    purpose: "additional_program",
    locale: "fr",
    bundle: BUNDLE,
  })
  const direct = additional.buildSystemPrompt({ locale: "fr", bundle: BUNDLE })
  assertEquals(dispatched, direct)
})

Deno.test("parseReadySignalFor('onboarding') tags the result with purpose='onboarding'", () => {
  const content =
    `Ready.\n` +
    `READY_FOR_PROGRAM_DRAFT: {"ready":true,"summary":"all good"}`

  const tagged = parseReadySignalFor("onboarding", content)

  assertEquals(tagged.purpose, "onboarding")
  // Narrow + verify the result shape matches the legacy onboarding contract.
  if (tagged.purpose !== "onboarding") throw new Error("expected onboarding branch")
  assertEquals(tagged.result.ready, true)
  assertEquals(tagged.result.summary, "all good")
})

Deno.test("parseReadySignalFor('additional_program') tags the result with purpose='additional_program' and exposes motivation", () => {
  const content =
    `Got it.\n` +
    `READY_FOR_PROGRAM_DRAFT: {"v":1,"ready":true,"motivation":"plateau"}`

  const tagged = parseReadySignalFor("additional_program", content)

  assertEquals(tagged.purpose, "additional_program")
  if (tagged.purpose !== "additional_program") throw new Error("expected additional branch")
  assertEquals(tagged.result.ready, true)
  assertEquals(tagged.result.motivation, "plateau")
})

Deno.test("parseReadySignalFor('additional_program') surfaces validator rejections", () => {
  const content =
    `READY_FOR_PROGRAM_DRAFT: {"v":1,"ready":true,"motivation":"made_up_value"}`

  const tagged = parseReadySignalFor("additional_program", content)

  if (tagged.purpose !== "additional_program") throw new Error("expected additional branch")
  assertEquals(tagged.result.ready, false)
  assertEquals(tagged.result.validatorRejection, { reason: "invalid_value" })
})
