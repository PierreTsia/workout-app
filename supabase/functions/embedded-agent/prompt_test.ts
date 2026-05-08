import { assertEquals, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { buildSystemPrompt, buildUserContext, type UserContextProfile } from "./prompt.ts"

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
