// #405 — OpenAI-compatible Groq core, shared by the three Groq adapters
// (chat, program, quick-workout). It speaks the chat-completions wire format
// and returns the raw assistant text; the per-shape adapters layer the
// json_schema and parse/validate on top. Mirrors the `fetchImpl` /
// AbortController DI from `embedded-agent/chatModel.ts` so tests stay
// network-free and the fallback leg gets its own fresh budget.

import { GROQ, FALLBACK_TIMEOUT_MS } from "./aiProviders.ts"
import { httpStatusToFailureKind, ProviderError } from "./providerError.ts"

/** OpenAI-style JSON-schema response format (Groq `response_format`). */
export interface GroqResponseSchema {
  name: string
  schema: Record<string, unknown>
}

export interface CallGroqChatInput {
  /**
   * Optional. Omitted/blank for the single-user-turn JSON calls (program,
   * quick-workout) that mirror Gemini's prompt-only request; present for the
   * Embedded Agent chat turn.
   */
  systemPrompt?: string
  messages: { role: "user" | "assistant"; content: string }[]
  /** When set, asks Groq for strict structured JSON matching this schema. */
  responseSchema?: GroqResponseSchema
  temperature?: number
  maxTokens?: number
}

export interface CallGroqChatOptions {
  fetchImpl?: typeof fetch
  /** Defaults to the GROQ env key. Passed explicitly in tests. */
  apiKey?: string
  /** Defaults to the fresh fallback budget. */
  timeoutMs?: number
}

interface GroqChatCompletion {
  choices?: Array<{ message?: { content?: string } }>
}

export async function callGroqChat(
  input: CallGroqChatInput,
  opts: CallGroqChatOptions = {},
): Promise<string> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis)

  // Fresh budget for this leg. As the fallback, Groq must never inherit the
  // Primary's near-exhausted clock — a timeout-triggered fallback would
  // otherwise abort instantly.
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? FALLBACK_TIMEOUT_MS,
  )

  try {
    const res = await fetchImpl(GROQ.baseUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ.model,
        messages: [
          ...(input.systemPrompt
            ? [{ role: "system", content: input.systemPrompt }]
            : []),
          ...input.messages,
        ],
        ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
        ...(input.maxTokens !== undefined ? { max_tokens: input.maxTokens } : {}),
        ...(input.responseSchema
          ? {
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: input.responseSchema.name,
                  schema: input.responseSchema.schema,
                  strict: true,
                },
              },
            }
          : {}),
      }),
    })

    if (!res.ok) {
      const errorBody = await res.text()
      throw new ProviderError(
        httpStatusToFailureKind(res.status),
        `Groq API error ${res.status}: ${errorBody}`,
        res.status,
      )
    }

    const data = (await res.json()) as GroqChatCompletion
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new ProviderError(
        "empty_response",
        "Groq returned a 2xx with no message content",
        res.status,
      )
    }
    return content
  } catch (err) {
    // Our own typed errors pass through untouched. A bare AbortError means
    // the fresh budget elapsed → the shared `timeout` kind so `withFallback`
    // and the handler classify it like any other.
    if (err instanceof ProviderError) throw err
    if ((err as { name?: unknown } | null)?.name === "AbortError") {
      throw new ProviderError("timeout", `Groq call exceeded its time budget`)
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}
