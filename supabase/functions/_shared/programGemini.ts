// Gemini HTTP call for program drafting — split from `_shared/programDraft.ts`
// to keep that module pure-TS so it stays vitest-importable from `src/test/`.
// This file references `Deno.env.get` and is exclusively reached from the
// `embedded-agent/index.ts` Deno runtime entrypoint (the program draft step).

import type { GenerateProgramResponse } from "./programDraft.ts"
import { httpStatusToFailureKind, ProviderError } from "./providerError.ts"

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

const TIMEOUT_MS = 15_000

interface GeminiPart {
  text?: string
  thought?: boolean
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] }
  }>
  error?: { message: string }
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    rationale: { type: "STRING" },
    days: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING" },
          muscle_focus: { type: "STRING" },
          exercise_ids: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
        },
        required: ["label", "muscle_focus", "exercise_ids"],
      },
    },
  },
  required: ["rationale", "days"],
}

function parseGeminiResponse(raw: string): GenerateProgramResponse {
  let text = raw.trim()
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()

  try {
    const parsed = JSON.parse(text) as GenerateProgramResponse
    if (typeof parsed.rationale !== "string" || !Array.isArray(parsed.days)) {
      throw new Error("Response missing rationale or days array")
    }
    return parsed
  } catch (e) {
    console.error("Gemini raw output (first 500 chars):", text.slice(0, 500))
    // 2xx but unusable JSON. `empty_response` is NOT a fallback kind — a
    // second provider won't fix a model that answered garbage (ADR 0009).
    throw new ProviderError(
      "empty_response",
      `${e instanceof Error ? e.message : "JSON parse error"} | raw: ${text.slice(0, 200)}`,
    )
  }
}

export interface CallGeminiProgramOptions {
  // Test seam — defaults to the real `globalThis.fetch`. Prod never passes it.
  fetchImpl?: typeof fetch
}

export async function callGeminiProgram(
  prompt: string,
  opts: CallGeminiProgramOptions = {},
): Promise<GenerateProgramResponse> {
  const apiKey = Deno.env.get("GEMINI_API_KEY")
  if (!apiKey) throw new ProviderError("client_error", "GEMINI_API_KEY is not set")

  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetchImpl(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json",
          response_schema: RESPONSE_SCHEMA,
          temperature: 0.7,
          maxOutputTokens: 4096,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new ProviderError(
        httpStatusToFailureKind(res.status),
        `Gemini API error ${res.status}: ${body}`,
        res.status,
      )
    }

    const data: GeminiResponse = await res.json()

    if (data.error) throw new ProviderError("empty_response", `Gemini error: ${data.error.message}`)

    const parts = data.candidates?.[0]?.content?.parts
    if (!parts?.length) throw new ProviderError("empty_response", "Gemini returned empty response")

    const outputPart = parts.findLast((p) => !p.thought && p.text)
    if (!outputPart?.text) {
      throw new ProviderError("empty_response", "Gemini returned no output text (only thinking)")
    }

    return parseGeminiResponse(outputPart.text)
  } finally {
    clearTimeout(timeout)
  }
}
