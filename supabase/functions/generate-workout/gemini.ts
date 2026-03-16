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

function extractJsonArray(raw: string): string[] {
  let text = raw.trim()

  // Strip markdown code fences if present
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")
  text = text.trim()

  try {
    const parsed: unknown = JSON.parse(text)
    if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === "string")) {
      throw new Error("Gemini response is not a string array")
    }
    return parsed as string[]
  } catch (e) {
    // Log raw text for debugging, truncate to avoid log spam
    console.error("Gemini raw output (first 500 chars):", text.slice(0, 500))
    throw new Error(
      `${e instanceof Error ? e.message : "JSON parse error"} | raw: ${text.slice(0, 200)}`,
    )
  }
}

export async function callGemini(prompt: string): Promise<string[]> {
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
          response_schema: { type: "ARRAY", items: { type: "STRING" } },
          temperature: 0.8,
          maxOutputTokens: 2048,
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

    // Gemini 2.5+ includes thinking parts — skip them and find the output
    const outputPart = parts.findLast((p) => !p.thought && p.text)
    if (!outputPart?.text) {
      throw new Error("Gemini returned no output text (only thinking)")
    }

    return extractJsonArray(outputPart.text)
  } finally {
    clearTimeout(timeout)
  }
}
