// Thin Gemini adapter for free-form chat turns. Mirrors the patterns in
// `_shared/programGemini.ts` but skips the JSON response_schema — the
// Embedded Agent emits natural language plus an optional READY_FOR_PROGRAM_DRAFT
// signal line (parsed downstream in T119).
//
// #358 — Retry-on-5xx absorbs transient Gemini capacity hiccups (the most
// common one is the literal "model is currently experiencing high demand"
// 503 we saw in prod). Retry budget and backoff are deliberately tiny:
// Gemini 503s resolve within a second on Google's side, and the 15s total
// `AbortController` budget is shared across attempts so the edge function
// stays bounded.

import type { ChatModelInput, ChatModelOutput } from "./handler.ts"
import {
  httpStatusToFailureKind,
  ProviderError,
  type ProviderFailureKind,
  RETRYABLE_STATUSES,
} from "../_shared/providerError.ts"

// #405 — The failure taxonomy first introduced here for #295/#358 now lives
// in `_shared/providerError.ts` so the generic `withFallback` HOF classifies
// the chat path, the program path and the quick-workout path the same way.
// These aliases preserve #358's public names (`ChatModelError`,
// `ChatModelFailureKind`, `RETRYABLE_CHAT_MODEL_STATUSES`) so `handler.ts` and
// the existing Deno tests keep compiling unchanged.
export { ProviderError as ChatModelError } from "../_shared/providerError.ts"
export type ChatModelFailureKind = ProviderFailureKind
export const RETRYABLE_CHAT_MODEL_STATUSES = RETRYABLE_STATUSES

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
const TIMEOUT_MS = 15_000

// #358 / #405 — Retry policy. Exported so tests can pin the contract.
// One in-place retry (2 attempts) catches the ~1s transient 503 cheaply;
// beyond that a sustained outage falls back to the Fallback Provider instead
// of hammering Gemini (ADR 0009). The retryable status set is the shared
// `RETRYABLE_STATUSES` (re-exported as `RETRYABLE_CHAT_MODEL_STATUSES`):
// 500/502/503/504. 4xx (incl. 429) stays out — deterministic, retrying just
// burns budget + wall time.
export const MAX_CHAT_MODEL_ATTEMPTS = 2
// Backoff applied BETWEEN attempts (so length === MAX_ATTEMPTS - 1). Short
// because the shared 15s timeout is the real ceiling and we don't want to
// eat half of it in sleeps before the user gets a banner.
const BACKOFF_MS = [250] as const
// ±50ms desync between concurrent clients hitting the same Google spike.
const BACKOFF_JITTER_MS = 50

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

export interface CallChatGeminiOptions {
  // Test seams — both default to the real `globalThis.fetch` and a
  // setTimeout-backed sleep. Prod code never passes either.
  fetchImpl?: typeof fetch
  sleepImpl?: (ms: number) => Promise<void>
  // Internal test seam — surfaces the per-call AbortController so tests
  // can verify abort-during-backoff cancellation without racing real
  // timers. Production code never sets this.
  exposeController?: (controller: AbortController) => void
}

export async function callChatGemini(
  input: ChatModelInput,
  opts: CallChatGeminiOptions = {},
): Promise<ChatModelOutput> {
  const apiKey = Deno.env.get("GEMINI_API_KEY")
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set")

  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const sleep = opts.sleepImpl ?? defaultSleep

  // Single shared controller — the 15s budget covers ALL attempts AND
  // every backoff sleep in between (see `sleepWithAbort` below). Without
  // racing sleeps against the signal a slow first attempt could push the
  // total wall-time past TIMEOUT_MS by up to one backoff + jitter.
  const controller = new AbortController()
  opts.exposeController?.(controller)
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  const url = `${GEMINI_URL}?key=${apiKey}`
  const body = JSON.stringify({
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
  })

  try {
    for (let attempt = 1; attempt <= MAX_CHAT_MODEL_ATTEMPTS; attempt++) {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body,
      })

      if (res.ok) {
        try {
          return parseSuccess(await res.json())
        } catch (parseErr) {
          // 2xx but unusable (empty / thinking-only / Gemini-embedded
          // error). Distinct kind so triage doesn't confuse "Gemini was
          // down" with "Gemini answered garbage".
          throw new ProviderError(
            "empty_response",
            parseErr instanceof Error ? parseErr.message : String(parseErr),
            res.status,
          )
        }
      }

      const errorBody = await res.text()
      const isRetryable = RETRYABLE_CHAT_MODEL_STATUSES.has(res.status)
      const isLastAttempt = attempt === MAX_CHAT_MODEL_ATTEMPTS
      if (!isRetryable || isLastAttempt) {
        throw new ProviderError(
          httpStatusToFailureKind(res.status),
          `Gemini API error ${res.status}: ${errorBody}`,
          res.status,
        )
      }

      input.onRetry?.({ attempt, upstreamStatus: res.status })

      const baseBackoff = BACKOFF_MS[attempt - 1]
      const jitter = Math.floor((Math.random() * 2 - 1) * BACKOFF_JITTER_MS)
      // Race the backoff against the shared abort signal so the 15s
      // total budget actually bounds wall-time. If the timeout fires
      // mid-sleep we exit immediately instead of finishing the nap and
      // then handing a doomed fetch an already-aborted signal.
      await sleepWithAbort(sleep, Math.max(0, baseBackoff + jitter), controller.signal)
    }
    // Unreachable: the loop either returns on a 2xx or throws on an
    // exhausted/non-retryable failure. Kept as a defensive net so the
    // function always has a terminal statement.
    throw new ProviderError("provider_error", "Gemini retry loop exited without resolving")
  } finally {
    clearTimeout(timeout)
  }
}

function parseSuccess(data: GeminiResponse): ChatModelOutput {
  if (data.error) throw new Error(`Gemini error: ${data.error.message}`)

  const parts = data.candidates?.[0]?.content?.parts
  if (!parts?.length) throw new Error("Gemini returned empty response")

  const outputPart = parts.findLast((p) => !p.thought && p.text)
  if (!outputPart?.text) {
    throw new Error("Gemini returned no output text (only thinking)")
  }
  return { content: outputPart.text.trim() }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// #358 PR review (Copilot) — backoff sleeps must observe the shared
// abort signal so the TIMEOUT_MS budget is strictly bounded. We listen
// once for "abort" and clean up the listener in `finally` so a sleep
// that wins the race doesn't leave a dangling subscription on the
// controller.
async function sleepWithAbort(
  sleep: (ms: number) => Promise<void>,
  ms: number,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) {
    throw new DOMException("Aborted before backoff", "AbortError")
  }
  let onAbort: (() => void) | undefined
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () =>
      reject(new DOMException("Aborted during backoff", "AbortError"))
    signal.addEventListener("abort", onAbort, { once: true })
  })
  try {
    await Promise.race([sleep(ms), aborted])
  } finally {
    if (onAbort) signal.removeEventListener("abort", onAbort)
  }
}
