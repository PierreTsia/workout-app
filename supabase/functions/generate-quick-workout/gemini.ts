import { httpStatusToFailureKind, ProviderError } from "../_shared/providerError.ts"

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

const TIMEOUT_MS = 10_000

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

export interface GenerateWorkoutGeminiResponse {
  exerciseIds: string[]
  exercises?: unknown[]
  rationale: string
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    rationale: { type: "STRING" },
    exercises: {
      type: "ARRAY",
      items: {
        anyOf: [
          { type: "STRING" },
          {
            type: "OBJECT",
            properties: {
              type: { type: "STRING" },
              label: { type: "STRING" },
              rounds: { type: "INTEGER" },
              rest_seconds: { type: "INTEGER" },
              transition_seconds: { type: "INTEGER" },
              exercises: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    exercise_id: { type: "STRING" },
                    amount: { type: "NUMBER" },
                    weight_kg: { type: "NUMBER" },
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
    exerciseIds: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
  },
  required: ["rationale"],
}

function parseResponse(raw: string): GenerateWorkoutGeminiResponse {
  let text = raw.trim()
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()

  try {
    const parsed = JSON.parse(text) as GenerateWorkoutGeminiResponse
    if (typeof parsed.rationale !== "string") {
      throw new Error("Response missing rationale")
    }
    const exercises = Array.isArray(parsed.exercises) ? parsed.exercises : undefined
    const exerciseIds = Array.isArray(parsed.exerciseIds)
      ? parsed.exerciseIds.filter((v): v is string => typeof v === "string")
      : []
    if ((!exercises || exercises.length === 0) && exerciseIds.length === 0) {
      throw new Error("Response missing exercises or exerciseIds")
    }
    return {
      rationale: parsed.rationale.trim(),
      exerciseIds,
      ...(exercises ? { exercises } : {}),
    }
  } catch (e) {
    console.error("Gemini raw output (first 500 chars):", text.slice(0, 500))
    // 2xx but unusable JSON. `empty_response` is NOT a fallback kind (ADR 0009).
    throw new ProviderError(
      "empty_response",
      `${e instanceof Error ? e.message : "JSON parse error"} | raw: ${text.slice(0, 200)}`,
    )
  }
}

export interface CallGeminiOptions {
  // Test seam — defaults to the real `globalThis.fetch`. Prod never passes it.
  fetchImpl?: typeof fetch
}

export async function callGemini(
  prompt: string,
  opts: CallGeminiOptions = {},
): Promise<GenerateWorkoutGeminiResponse> {
  const apiKey = Deno.env.get("GEMINI_API_KEY")
  if (!apiKey) {
    throw new ProviderError("client_error", "GEMINI_API_KEY is not set")
  }

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
          temperature: 0.8,
          maxOutputTokens: 2048,
          thinkingConfig: {
            thinkingBudget: 0,
          },
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

    if (data.error) {
      throw new ProviderError("empty_response", `Gemini error: ${data.error.message}`)
    }

    const parts = data.candidates?.[0]?.content?.parts
    if (!parts?.length) {
      throw new ProviderError("empty_response", "Gemini returned empty response")
    }

    const outputPart = parts.findLast((p) => !p.thought && p.text)
    if (!outputPart?.text) {
      throw new ProviderError("empty_response", "Gemini returned no output text (only thinking)")
    }

    return parseResponse(outputPart.text)
  } finally {
    clearTimeout(timeout)
  }
}
