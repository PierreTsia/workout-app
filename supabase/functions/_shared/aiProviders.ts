// #405 — Central config for the in-app AI providers (ADR 0009). Before this,
// model ids / base URLs / env key names were hardcoded at each Gemini call
// site; going multi-provider, they live here so adding or retuning a provider
// is a one-file change instead of an N-site grep.

/** Primary Provider — Gemini. Tried first on every in-app AI call. */
export const GEMINI = {
  name: "gemini",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
  model: "gemini-2.5-flash",
  apiKeyEnv: "GEMINI_API_KEY",
} as const

/**
 * Fallback Provider — Groq (OpenAI-compatible, no-card free tier,
 * decorrelated from Google's infra). Engaged by `withFallback` only on a
 * Primary availability failure.
 */
export const GROQ = {
  name: "groq",
  baseUrl: "https://api.groq.com/openai/v1/chat/completions",
  model: "llama-3.3-70b-versatile",
  apiKeyEnv: "GROQ_API_KEY",
} as const

/**
 * Fresh, tighter budget for the fallback leg. A `timeout`-triggered fallback
 * must not inherit the Primary's ~0s remaining budget; Groq's LPU keeps the
 * real leg at 1-3s so 10s is comfortable headroom.
 */
export const FALLBACK_TIMEOUT_MS = 10_000

/** True when the Fallback Provider is configured (key present, non-blank). */
export function isGroqConfigured(): boolean {
  return (Deno.env.get(GROQ.apiKeyEnv) ?? "").trim().length > 0
}
