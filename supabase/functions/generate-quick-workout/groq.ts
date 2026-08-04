// #405 — Groq quick-workout adapter. Mirror of this function's `callGemini`:
// same signature so `withFallback` composes it at the quick-workout seam.

import type { GenerateWorkoutGeminiResponse } from "./gemini.ts"
import { callGroqChat, type CallGroqChatOptions } from "../_shared/groqClient.ts"
import { GROQ } from "../_shared/aiProviders.ts"
import { ProviderError } from "../_shared/providerError.ts"

const WORKOUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    rationale: { type: "string" },
    exercises: {
      type: "array",
      items: {
        anyOf: [
          { type: "string" },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", const: "circuit" },
              label: { type: "string" },
              rounds: { type: "integer" },
              rest_seconds: { type: "integer" },
              transition_seconds: { type: "integer" },
              exercises: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    exercise_id: { type: "string" },
                    amount: { type: "number" },
                    weight_kg: { type: "number" },
                  },
                  required: ["exercise_id", "amount", "weight_kg"],
                },
              },
            },
            required: ["type", "exercises"],
          },
        ],
      },
    },
    exerciseIds: { type: "array", items: { type: "string" } },
  },
  required: ["rationale"],
} as const

function parseWorkout(content: string): GenerateWorkoutGeminiResponse {
  const text = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
  try {
    const parsed = JSON.parse(text) as GenerateWorkoutGeminiResponse
    if (typeof parsed.rationale !== "string") {
      throw new Error("missing rationale")
    }
    const exercises = Array.isArray(parsed.exercises) ? parsed.exercises : undefined
    const exerciseIds = Array.isArray(parsed.exerciseIds)
      ? parsed.exerciseIds.filter((v): v is string => typeof v === "string")
      : []
    if ((!exercises || exercises.length === 0) && exerciseIds.length === 0) {
      throw new Error("missing exercises or exerciseIds")
    }
    return {
      rationale: parsed.rationale.trim(),
      exerciseIds,
      ...(exercises ? { exercises } : {}),
    }
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
