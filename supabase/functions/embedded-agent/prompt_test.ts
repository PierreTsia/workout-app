import { assertEquals, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  buildSystemPrompt,
  buildUserContext,
  parseReadySignal,
  type UserContextProfile,
} from "./prompt.ts"

function makeProfile(overrides: Partial<UserContextProfile> = {}): UserContextProfile {
  return {
    goal: "hypertrophy",
    experience: "intermediate",
    equipment: "gym",
    training_days_per_week: 4,
    session_duration_minutes: 60,
    age: 30,
    weight_kg: 75,
    gender: "male",
    ...overrides,
  }
}

// ---------- buildSystemPrompt ----------

Deno.test("buildSystemPrompt locks the assistant to English when locale='en'", () => {
  const prompt = buildSystemPrompt({ locale: "en", userProfile: makeProfile() })
  assertMatch(prompt, /respond in english/i)
})

Deno.test("buildSystemPrompt locks the assistant to French when locale='fr'", () => {
  const prompt = buildSystemPrompt({ locale: "fr", userProfile: makeProfile() })
  assertMatch(prompt, /répond.*en français|en français/i)
})

Deno.test("buildSystemPrompt teaches the literal READY_FOR_PROGRAM_DRAFT signal schema", () => {
  const prompt = buildSystemPrompt({ locale: "en", userProfile: makeProfile() })
  assertMatch(prompt, /READY_FOR_PROGRAM_DRAFT:\s*\{"ready":true,"summary":"[^"]*"\}/)
})

Deno.test("buildSystemPrompt forbids re-asking already-collected questionnaire fields", () => {
  const prompt = buildSystemPrompt({ locale: "en", userProfile: makeProfile() })
  assertMatch(prompt, /do not re-?ask|already collected|already known/i)
})

Deno.test("buildSystemPrompt never names external providers (Claude / Gemini / GPT / OpenAI / Anthropic)", () => {
  const en = buildSystemPrompt({ locale: "en", userProfile: makeProfile() })
  const fr = buildSystemPrompt({ locale: "fr", userProfile: makeProfile() })
  const forbidden = /(claude|gemini|gpt|openai|anthropic|google ai)/i
  assertEquals(forbidden.test(en), false)
  assertEquals(forbidden.test(fr), false)
})

// ---------- buildUserContext ----------

Deno.test("buildUserContext flattens the questionnaire profile into a compact context block", () => {
  const ctx = buildUserContext(makeProfile({ goal: "strength", training_days_per_week: 3 }))
  assertMatch(ctx, /goal:\s*strength/i)
  assertMatch(ctx, /training_days_per_week:\s*3/i)
})

Deno.test("buildUserContext degrades gracefully when optional fields are null", () => {
  const ctx = buildUserContext(makeProfile({ age: null, weight_kg: null, gender: null }))
  assertMatch(ctx, /age:\s*n\/a/i)
  assertMatch(ctx, /weight_kg:\s*n\/a/i)
  assertMatch(ctx, /gender:\s*n\/a/i)
})

// ---------- parseReadySignal ----------

Deno.test("parseReadySignal returns ready=false and unchanged content when no signal is present", () => {
  const result = parseReadySignal("Tell me more about your back injury, please.")
  assertEquals(result.ready, false)
  assertEquals(result.summary, undefined)
  assertEquals(result.cleanContent, "Tell me more about your back injury, please.")
})

Deno.test("parseReadySignal extracts ready=true + summary and strips the signal line from the content", () => {
  const raw =
    "Got it, sounds like a solid plan.\n" +
    'READY_FOR_PROGRAM_DRAFT: {"ready":true,"summary":"Beginner female, 65, 3x/week gym, fat-loss focus."}'
  const result = parseReadySignal(raw)
  assertEquals(result.ready, true)
  assertEquals(result.summary, "Beginner female, 65, 3x/week gym, fat-loss focus.")
  assertEquals(result.cleanContent, "Got it, sounds like a solid plan.")
})

Deno.test("parseReadySignal handles ready=false in the JSON tail (model says 'not yet') without leaking the line", () => {
  const raw =
    "I still need a couple more details.\n" +
    'READY_FOR_PROGRAM_DRAFT: {"ready":false,"summary":""}'
  const result = parseReadySignal(raw)
  assertEquals(result.ready, false)
  assertEquals(result.summary, undefined)
  assertEquals(result.cleanContent, "I still need a couple more details.")
})

Deno.test("parseReadySignal strips the signal line even when JSON is malformed (defensive)", () => {
  const raw = "Sure thing.\nREADY_FOR_PROGRAM_DRAFT: {not even json}"
  const result = parseReadySignal(raw)
  assertEquals(result.ready, false)
  assertEquals(result.summary, undefined)
  assertEquals(result.cleanContent, "Sure thing.")
})

Deno.test("parseReadySignal rejects free-text 'I'm ready' without the literal JSON line", () => {
  const result = parseReadySignal("I'm ready! Let's go!")
  assertEquals(result.ready, false)
  assertEquals(result.cleanContent, "I'm ready! Let's go!")
})

Deno.test("parseReadySignal treats missing 'summary' field as not-ready but still strips the line", () => {
  const raw = 'Heads up: READY_FOR_PROGRAM_DRAFT: {"ready":true}'
  const result = parseReadySignal(raw)
  assertEquals(result.ready, false)
  assertEquals(result.summary, undefined)
  // The signal line is stripped; the leading text remains.
  assertMatch(result.cleanContent, /^Heads up:\s*$/)
})

Deno.test("parseReadySignal trims trailing whitespace after stripping the signal", () => {
  const raw =
    "All set.\n\n" +
    'READY_FOR_PROGRAM_DRAFT: {"ready":true,"summary":"Recap."}\n\n'
  const result = parseReadySignal(raw)
  assertEquals(result.ready, true)
  assertEquals(result.cleanContent, "All set.")
})

Deno.test("parseReadySignal handles empty content", () => {
  const result = parseReadySignal("")
  assertEquals(result.ready, false)
  assertEquals(result.cleanContent, "")
})
