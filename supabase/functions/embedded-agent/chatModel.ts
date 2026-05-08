// Thin Gemini adapter for free-form chat turns. Mirrors the patterns in
// `generate-program/gemini.ts` but skips the JSON response_schema — the
// Embedded Agent emits natural language plus an optional READY_FOR_PROGRAM_DRAFT
// signal line (parsed downstream in T119).

import type { ChatModelInput, ChatModelOutput } from "./handler.ts"

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

export async function callChatGemini(input: ChatModelInput): Promise<ChatModelOutput> {
  const apiKey = Deno.env.get("GEMINI_API_KEY")
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set")

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          role: "system",
          parts: [{ text: input.systemPrompt }],
        },
        contents: input.messages.map((m) => ({
          // Gemini's API accepts only "user" and "model" roles.
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Gemini API error ${res.status}: ${body}`)
    }

    const data: GeminiResponse = await res.json()
    if (data.error) throw new Error(`Gemini error: ${data.error.message}`)

    const parts = data.candidates?.[0]?.content?.parts
    if (!parts?.length) throw new Error("Gemini returned empty response")

    const outputPart = parts.findLast((p) => !p.thought && p.text)
    if (!outputPart?.text) {
      throw new Error("Gemini returned no output text (only thinking)")
    }

    return { content: outputPart.text.trim() }
  } finally {
    clearTimeout(timeout)
  }
}
