import {
  assertEquals,
  assertMatch,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  buildSystemPrompt,
  parseReadySignal,
  type AdditionalProgramBundle,
} from "./additional-program.ts"

// Additional-program system prompt + ready-signal validator (T132, #343).
// The system prompt is a copy-driven build: tests assert key invariants
// (rule presence, locale switching, empty-active-program greeting,
// brand-free) rather than locking byte-exact strings. The validator is
// behavior-tested across the seven cases in the acceptance matrix.

function makeBundle(overrides: Partial<AdditionalProgramBundle> = {}): AdditionalProgramBundle {
  return {
    profile: {
      goal: "hypertrophy",
      experience: "intermediate",
      equipment: "full-gym",
      training_days_per_week: 4,
      session_duration_minutes: 60,
    },
    active_program: {
      name: "Push-Pull-Legs 4d",
      days_per_week: 4,
      duration_minutes: 60,
      goal: "hypertrophy",
      days: [
        { label: "Push", exercises: ["bench", "ohp"] },
        { label: "Pull", exercises: ["row", "pulldown"] },
        { label: "Legs", exercises: ["squat", "rdl"] },
      ],
    },
    recent_stats: {
      sessions_completed: 12,
      avg_session_duration: 58,
      last_session_at: "2026-05-08T18:00:00Z",
      most_used_exercises: ["bench", "squat", "row"],
    },
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// buildSystemPrompt
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("buildSystemPrompt locks the assistant to English when locale='en'", () => {
  const prompt = buildSystemPrompt({ locale: "en", bundle: makeBundle() })
  assertMatch(prompt, /respond in English/)
})

Deno.test("buildSystemPrompt locks the assistant to French when locale='fr'", () => {
  const prompt = buildSystemPrompt({ locale: "fr", bundle: makeBundle() })
  assertMatch(prompt, /réponds toujours en français/i)
})

Deno.test("buildSystemPrompt enumerates all 7 motivation values in the gate (Story 4 + 5)", () => {
  const prompt = buildSystemPrompt({ locale: "en", bundle: makeBundle() })
  for (
    const value of [
      "variety",
      "plateau",
      "injury",
      "priority_shift",
      "equipment_change",
      "return_from_break",
      "other",
    ]
  ) {
    assertStringIncludes(prompt, value)
  }
})

Deno.test("buildSystemPrompt teaches the extended ready-signal payload schema with v:1 + motivation + constraint_overrides", () => {
  const prompt = buildSystemPrompt({ locale: "en", bundle: makeBundle() })
  assertStringIncludes(prompt, "READY_FOR_PROGRAM_DRAFT:")
  assertStringIncludes(prompt, `"v":1`)
  assertStringIncludes(prompt, `"motivation"`)
  assertStringIncludes(prompt, `"constraint_overrides"`)
})

Deno.test("buildSystemPrompt discloses override bounds (daysPerWeek 1-7, duration 30-120, equipment enum, goal enum)", () => {
  const prompt = buildSystemPrompt({ locale: "en", bundle: makeBundle() })
  assertStringIncludes(prompt, "daysPerWeek")
  assertStringIncludes(prompt, "1–7")
  assertStringIncludes(prompt, "duration")
  assertStringIncludes(prompt, "30–120")
  assertStringIncludes(prompt, "bodyweight")
  assertStringIncludes(prompt, "full-gym")
  assertStringIncludes(prompt, "strength")
  assertStringIncludes(prompt, "general_fitness")
})

Deno.test("buildSystemPrompt includes the signal-payload-authority rule (UX-mismatch mitigation)", () => {
  const prompt = buildSystemPrompt({ locale: "en", bundle: makeBundle() })
  // The rule is what stops free-text agreement from silently failing to
  // affect the draft. Lock its presence so a future copy refactor can't
  // accidentally drop the safety net.
  assertMatch(prompt, /constraint_overrides[\s\S]*authoritative|authoritative[\s\S]*constraint_overrides/i)
})

Deno.test("buildSystemPrompt forbids re-asking already-known profile fields", () => {
  const prompt = buildSystemPrompt({ locale: "en", bundle: makeBundle() })
  assertMatch(prompt, /Do not re-ask/i)
})

Deno.test("buildSystemPrompt injects the empty-active-program greeting clause when active_program is null", () => {
  const prompt = buildSystemPrompt({
    locale: "en",
    bundle: makeBundle({ active_program: null }),
  })
  assertMatch(prompt, /You don't have an active program right now/)
  assertMatch(prompt, /Do not fabricate references/)
})

Deno.test("buildSystemPrompt omits the empty-active-program clause when an active program is present", () => {
  const prompt = buildSystemPrompt({ locale: "en", bundle: makeBundle() })
  assertEquals(prompt.includes("You don't have an active program right now"), false)
})

Deno.test("buildSystemPrompt renders the bundle as JSON context the model can read", () => {
  const prompt = buildSystemPrompt({ locale: "en", bundle: makeBundle() })
  // The user's actual profile + active_program details must appear so the
  // model has the context it needs to skip re-asking.
  assertStringIncludes(prompt, `"hypertrophy"`)
  assertStringIncludes(prompt, `"Push-Pull-Legs 4d"`)
})

Deno.test("buildSystemPrompt never names external providers (Claude / Gemini / GPT / OpenAI / Anthropic)", () => {
  const en = buildSystemPrompt({ locale: "en", bundle: makeBundle() })
  const fr = buildSystemPrompt({ locale: "fr", bundle: makeBundle() })
  for (const banned of ["Claude", "Gemini", "GPT", "OpenAI", "Anthropic"]) {
    assertEquals(en.includes(banned), false, `EN prompt leaks brand "${banned}"`)
    assertEquals(fr.includes(banned), false, `FR prompt leaks brand "${banned}"`)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// parseReadySignal — the 7-case validator matrix from the acceptance criteria
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("parseReadySignal returns ready:false / no rejection when no signal line is present", () => {
  const result = parseReadySignal("Tell me about your back injury.")
  assertEquals(result.ready, false)
  assertEquals(result.cleanContent, "Tell me about your back injury.")
  assertEquals(result.validatorRejection, undefined)
})

Deno.test("parseReadySignal accepts a valid signal with motivation only (no overrides)", () => {
  const raw =
    `Got it.\n` +
    `READY_FOR_PROGRAM_DRAFT: {"v":1,"ready":true,"summary":"plateau on bench","motivation":"plateau"}`

  const result = parseReadySignal(raw)

  assertEquals(result.ready, true)
  assertEquals(result.motivation, "plateau")
  assertEquals(result.constraintOverrides, undefined)
  assertEquals(result.validatorRejection, undefined)
  assertEquals(result.cleanContent, "Got it.")
})

Deno.test("parseReadySignal accepts a valid signal WITH constraint_overrides", () => {
  const raw =
    `OK.\n` +
    `READY_FOR_PROGRAM_DRAFT: {"v":1,"ready":true,"motivation":"plateau","constraint_overrides":{"daysPerWeek":5,"duration":60}}`

  const result = parseReadySignal(raw)

  assertEquals(result.ready, true)
  assertEquals(result.motivation, "plateau")
  assertEquals(result.constraintOverrides, { daysPerWeek: 5, duration: 60 })
})

Deno.test("parseReadySignal rejects a ready signal with missing motivation → reason: 'missing'", () => {
  const raw = `READY_FOR_PROGRAM_DRAFT: {"v":1,"ready":true,"summary":"x"}`

  const result = parseReadySignal(raw)

  assertEquals(result.ready, false)
  assertEquals(result.validatorRejection, { reason: "missing" })
})

Deno.test("parseReadySignal rejects unknown motivation values → reason: 'invalid_value'", () => {
  const raw =
    `READY_FOR_PROGRAM_DRAFT: {"v":1,"ready":true,"motivation":"because_i_said_so"}`

  const result = parseReadySignal(raw)

  assertEquals(result.ready, false)
  assertEquals(result.validatorRejection, { reason: "invalid_value" })
})

Deno.test("parseReadySignal rejects malformed JSON → reason: 'malformed_json'", () => {
  const raw = `READY_FOR_PROGRAM_DRAFT: {not actually json}`

  const result = parseReadySignal(raw)

  assertEquals(result.ready, false)
  assertEquals(result.validatorRejection, { reason: "malformed_json" })
})

Deno.test("parseReadySignal rejects out-of-bounds daysPerWeek → reason: 'invalid_override', field: 'daysPerWeek'", () => {
  const raw =
    `READY_FOR_PROGRAM_DRAFT: {"v":1,"ready":true,"motivation":"plateau","constraint_overrides":{"daysPerWeek":14}}`

  const result = parseReadySignal(raw)

  assertEquals(result.ready, false)
  assertEquals(result.validatorRejection, { reason: "invalid_override", field: "daysPerWeek" })
})

Deno.test("parseReadySignal rejects out-of-bounds duration → reason: 'invalid_override', field: 'duration'", () => {
  const raw =
    `READY_FOR_PROGRAM_DRAFT: {"v":1,"ready":true,"motivation":"plateau","constraint_overrides":{"duration":15}}`

  const result = parseReadySignal(raw)

  assertEquals(result.ready, false)
  assertEquals(result.validatorRejection, { reason: "invalid_override", field: "duration" })
})

Deno.test("parseReadySignal rejects unknown equipmentCategory → reason: 'invalid_override', field: 'equipmentCategory'", () => {
  const raw =
    `READY_FOR_PROGRAM_DRAFT: {"v":1,"ready":true,"motivation":"plateau","constraint_overrides":{"equipmentCategory":"barbell-only"}}`

  const result = parseReadySignal(raw)

  assertEquals(result.ready, false)
  assertEquals(result.validatorRejection, {
    reason: "invalid_override",
    field: "equipmentCategory",
  })
})

Deno.test("parseReadySignal silently drops unknown override keys, keeps known valid ones (forward-compat for v2)", () => {
  const raw =
    `READY_FOR_PROGRAM_DRAFT: {"v":1,"ready":true,"motivation":"plateau","constraint_overrides":{"daysPerWeek":5,"futureField":"someValue"}}`

  const result = parseReadySignal(raw)

  assertEquals(result.ready, true)
  assertEquals(result.motivation, "plateau")
  assertEquals(result.constraintOverrides, { daysPerWeek: 5 })
})

Deno.test("parseReadySignal treats ready:false JSON as a normal no-signal turn (model said 'not yet' via JSON, no rejection)", () => {
  const raw =
    `Almost there.\n` +
    `READY_FOR_PROGRAM_DRAFT: {"v":1,"ready":false}`

  const result = parseReadySignal(raw)

  assertEquals(result.ready, false)
  assertEquals(result.validatorRejection, undefined)
  // Signal line is still stripped so the raw JSON never leaks to the chat UI.
  assertEquals(result.cleanContent, "Almost there.")
})

Deno.test("parseReadySignal strips the signal line on rejection so raw JSON never leaks to the UI", () => {
  const raw =
    `Here's what I got.\n` +
    `READY_FOR_PROGRAM_DRAFT: {"v":1,"ready":true,"motivation":"because_i_said_so"}`

  const result = parseReadySignal(raw)

  assertEquals(result.cleanContent, "Here's what I got.")
})
