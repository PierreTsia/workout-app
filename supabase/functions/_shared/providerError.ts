// #405 — Provider-agnostic AI failure taxonomy. Lifted out of
// embedded-agent/chatModel.ts (#358) so the two JSON adapters and the
// generic `withFallback` HOF classify failures the same way the chat path
// already does. The `kind` decides fallback vs no-fallback (see ADR 0009).

export type ProviderFailureKind =
  | "provider_unavailable" // 503 UNAVAILABLE ("high demand") — retryable, triggers fallback
  | "provider_error" // other upstream 5xx — retryable, triggers fallback
  | "client_error" // non-retryable 4xx (bad key/payload) — OUR bug, no fallback
  | "timeout" // AbortController budget elapsed — triggers fallback
  | "empty_response" // 2xx but no usable output — no fallback

/**
 * Typed provider failure. Carries the discriminating `kind` and, when the
 * failure was an upstream HTTP response, the raw `upstreamStatus`. The
 * `message` stays human-readable so existing log-grep keeps working.
 */
export class ProviderError extends Error {
  readonly kind: ProviderFailureKind
  readonly upstreamStatus?: number

  constructor(kind: ProviderFailureKind, message: string, upstreamStatus?: number) {
    super(message)
    this.name = "ProviderError"
    this.kind = kind
    this.upstreamStatus = upstreamStatus
  }
}

// Kinds that justify trying the Fallback Provider. Availability-only (ADR
// 0009 invariant 1): a `client_error` is our config bug and must surface; an
// `empty_response` is a 2xx the model just didn't fill — a second provider
// won't help and would double the latency for nothing.
export const FALLBACK_KINDS: ReadonlySet<ProviderFailureKind> = new Set([
  "provider_unavailable",
  "provider_error",
  "timeout",
])

// Upstream 5xx we retry in-place (one quick retry on the same provider before
// falling back). 501 (not implemented) is excluded on purpose — retrying a
// permanent server error is pointless.
export const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([500, 502, 503, 504])

// Map a non-2xx HTTP status onto a failure kind. 503 is the observed prod
// case (UNAVAILABLE / high demand); every other 5xx is also upstream, so it
// stays `provider_error`. Only sub-500 (4xx, incl. 429) is on us.
export function httpStatusToFailureKind(status: number): ProviderFailureKind {
  if (status === 503) return "provider_unavailable"
  if (status >= 500) return "provider_error"
  return "client_error"
}

/**
 * Map whatever an adapter threw onto the canonical taxonomy. A `ProviderError`
 * already carries its kind; a bare `AbortError` (fetch/sleep abort, not
 * reliably `instanceof Error` across runtimes — match on name) means the
 * budget fired; anything else is an unclassified upstream error.
 */
export function classifyProviderError(
  err: unknown,
): { kind: ProviderFailureKind; upstreamStatus?: number } {
  if (err instanceof ProviderError) {
    return err.upstreamStatus !== undefined
      ? { kind: err.kind, upstreamStatus: err.upstreamStatus }
      : { kind: err.kind }
  }
  const name = (err as { name?: unknown } | null)?.name
  if (name === "AbortError") return { kind: "timeout" }
  return { kind: "provider_error" }
}
