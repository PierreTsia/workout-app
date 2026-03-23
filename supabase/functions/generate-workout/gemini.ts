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
  rationale: string
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    rationale: { type: "STRING" },
    exerciseIds: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
  },
  required: ["rationale", "exerciseIds"],
}

function parseResponse(raw: string): GenerateWorkoutGeminiResponse {
  let text = raw.trim()
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()

  try {
    const parsed = JSON.parse(text) as GenerateWorkoutGeminiResponse
    if (typeof parsed.rationale !== "string" || !Array.isArray(parsed.exerciseIds)) {
      throw new Error("Response missing rationale or exerciseIds array")
    }
    if (!parsed.exerciseIds.every((v) => typeof v === "string")) {
      throw new Error("exerciseIds must be strings")
    }
    return {
      rationale: parsed.rationale.trim(),
      exerciseIds: parsed.exerciseIds,
    }
  } catch (e) {
    console.error("Gemini raw output (first 500 chars):", text.slice(0, 500))
    throw new Error(
      `${e instanceof Error ? e.message : "JSON parse error"} | raw: ${text.slice(0, 200)}`,
    )
  }
}

export async function callGemini(
  prompt: string,
): Promise<GenerateWorkoutGeminiResponse> {
  const apiKey = Deno.env.get("GEMINI_API_KEY")
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set")
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
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
      throw new Error(`Gemini API error ${res.status}: ${body}`)
    }

    const data: GeminiResponse = await res.json()

    if (data.error) {
      throw new Error(`Gemini error: ${data.error.message}`)
    }

    const parts = data.candidates?.[0]?.content?.parts
    if (!parts?.length) {
      throw new Error("Gemini returned empty response")
    }

    const outputPart = parts.findLast((p) => !p.thought && p.text)
    if (!outputPart?.text) {
      throw new Error("Gemini returned no output text (only thinking)")
    }

    return parseResponse(outputPart.text)
  } finally {
    clearTimeout(timeout)
  }
}
