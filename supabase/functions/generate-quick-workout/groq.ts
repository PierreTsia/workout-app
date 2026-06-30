// #405 — Groq quick-workout adapter. Mirror of this function's `callGemini`:
// same `(prompt) => { exerciseIds, rationale }` signature so `withFallback`
// composes it at the quick-workout seam. The Gemini `RESPONSE_SCHEMA` is
// translated into OpenAI-style JSON Schema for Groq's strict
// `response_format`; the function's existing validation downstream stays the
// provider-agnostic safety net.

import type { GenerateWorkoutGeminiResponse } from "./gemini.ts"
import { callGroqChat, type CallGroqChatOptions } from "../_shared/groqClient.ts"
import { GROQ } from "../_shared/aiProviders.ts"
import { ProviderError } from "../_shared/providerError.ts"

const WORKOUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    rationale: { type: "string" },
    exerciseIds: { type: "array", items: { type: "string" } },
  },
  required: ["rationale", "exerciseIds"],
} as const

function parseWorkout(content: string): GenerateWorkoutGeminiResponse {
  const text = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
  try {
    const parsed = JSON.parse(text) as GenerateWorkoutGeminiResponse
    if (typeof parsed.rationale !== "string" || !Array.isArray(parsed.exerciseIds)) {
      throw new Error("missing rationale or exerciseIds array")
    }
    if (!parsed.exerciseIds.every((v) => typeof v === "string")) {
      throw new Error("exerciseIds must be strings")
    }
    return { rationale: parsed.rationale.trim(), exerciseIds: parsed.exerciseIds }
  } catch (e) {
    throw new ProviderError(
      "empty_response",
      `Groq workout JSON parse error: ${e instanceof Error ? e.message : String(e)}`,
    )
  }
}

export async function callGroqWorkout(
  prompt: string,
  opts: CallGroqChatOptions = {},
): Promise<GenerateWorkoutGeminiResponse> {
  const apiKey = opts.apiKey ?? Deno.env.get(GROQ.apiKeyEnv)

  const content = await callGroqChat(
    {
      messages: [{ role: "user", content: prompt }],
      responseSchema: { name: "quick_workout", schema: WORKOUT_JSON_SCHEMA },
      temperature: 0.8,
      maxTokens: 2048,
    },
    { ...opts, apiKey },
  )

  return parseWorkout(content)
}
