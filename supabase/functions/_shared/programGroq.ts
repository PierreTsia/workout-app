// #405 — Groq program adapter. Mirror of `callGeminiProgram`: same
// `(prompt) => GenerateProgramResponse` signature so `withFallback` composes
// it at the program-draft seam. The Gemini `RESPONSE_SCHEMA` (uppercase
// "OBJECT"/"STRING"/"ARRAY") is translated once into OpenAI-style JSON Schema
// for Groq's strict `response_format`. The downstream `validateProgram` stays
// the provider-agnostic safety net for any residual drift.

import type { GenerateProgramResponse } from "./programDraft.ts"
import { PROGRAM_JSON_SCHEMA_GROQ } from "./programDraftSchema.ts"
import { callGroqChat, type CallGroqChatOptions } from "./groqClient.ts"
import { GROQ } from "./aiProviders.ts"
import { ProviderError } from "./providerError.ts"

const PROGRAM_JSON_SCHEMA = PROGRAM_JSON_SCHEMA_GROQ

function parseProgram(content: string): GenerateProgramResponse {
  const text = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
  try {
    const parsed = JSON.parse(text) as GenerateProgramResponse
    if (typeof parsed.rationale !== "string" || !Array.isArray(parsed.days)) {
      throw new Error("missing rationale or days array")
    }
    return parsed
  } catch (e) {
    // 2xx but unusable JSON. `empty_response` (not a fallback kind): Groq is
    // already the fallback leg, so there is no further provider to try.
    throw new ProviderError(
      "empty_response",
      `Groq program JSON parse error: ${e instanceof Error ? e.message : String(e)}`,
    )
  }
}

export async function callGroqProgram(
  prompt: string,
  opts: CallGroqChatOptions = {},
): Promise<GenerateProgramResponse> {
  const apiKey = opts.apiKey ?? Deno.env.get(GROQ.apiKeyEnv)

  const content = await callGroqChat(
    {
      messages: [{ role: "user", content: prompt }],
      responseSchema: { name: "program", schema: PROGRAM_JSON_SCHEMA },
      temperature: 0.7,
      maxTokens: 4096,
    },
    { ...opts, apiKey },
  )

  return parseProgram(content)
}
