const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

const TIMEOUT_MS = 8_000

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
  }>
  error?: { message: string }
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
          maxOutputTokens: 1024,
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

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      throw new Error("Gemini returned empty response")
    }

    const parsed: unknown = JSON.parse(text)
    if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === "string")) {
      throw new Error("Gemini response is not a string array")
    }

    return parsed as string[]
  } finally {
    clearTimeout(timeout)
  }
}
