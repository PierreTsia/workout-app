// #405 — Generic Primary→Fallback HOF, composed at the dependency-injection
// seam in the edge entrypoints (ADR 0009). It wraps two adapters with the
// *same* signature `(I) => Promise<O>` and returns one adapter of that same
// shape, so handlers and validators stay untouched.
//
// Orchestration only: it does NOT own timeouts (each adapter carries its own
// AbortController budget — the fallback leg's fresh, tighter budget lives in
// the Groq adapter) and it does NOT know about any concrete log sink. It
// emits structured `FallbackLog` events through an injected `log` callback so
// each function's `index.ts` can map them onto its own `emitLog` — which is
// also how the branding invariant holds: the provider dimension only ever
// reaches a server log, never the wire.

import {
  classifyProviderError,
  FALLBACK_KINDS,
  type ProviderFailureKind,
} from "./providerError.ts"

export type FallbackLog =
  | {
      type: "fallback"
      fromKind: ProviderFailureKind
      upstreamStatus?: number
      from: string
      to: string
    }
  | { type: "fallback_unavailable"; fromKind: ProviderFailureKind; from: string }
  | { type: "resolved"; provider: string; viaFallback: boolean }

export interface FallbackOpts {
  /** Primary provider name, for logs only (e.g. "gemini"). */
  from: string
  /** Secondary provider name, for logs only (e.g. "groq"). */
  to: string
  /**
   * Guard for secondary misconfiguration (e.g. missing GROQ_API_KEY). When it
   * returns false, a fallback-eligible primary failure is rethrown as-is
   * rather than masked by a secondary config error. Defaults to "configured".
   */
  isSecondaryConfigured?: () => boolean
  log?: (event: FallbackLog) => void
}

export function withFallback<I, O>(
  primary: (input: I) => Promise<O>,
  secondary: (input: I) => Promise<O>,
  opts: FallbackOpts,
): (input: I) => Promise<O> {
  // Logging is best-effort: a throwing sink (custom logger, JSON
  // serialization, IO) must never turn a successful primary/secondary
  // response into an error, nor mask the real provider error on the failure
  // path. Swallow anything the sink throws.
  const safeLog = (event: FallbackLog): void => {
    try {
      opts.log?.(event)
    } catch {
      // intentionally ignored — observability must not affect resolution
    }
  }

  return async (input: I): Promise<O> => {
    try {
      const result = await primary(input)
      safeLog({ type: "resolved", provider: opts.from, viaFallback: false })
      return result
    } catch (primaryErr) {
      const { kind, upstreamStatus } = classifyProviderError(primaryErr)
      if (!FALLBACK_KINDS.has(kind)) throw primaryErr

      const secondaryConfigured = opts.isSecondaryConfigured?.() ?? true
      if (!secondaryConfigured) {
        safeLog({ type: "fallback_unavailable", fromKind: kind, from: opts.from })
        throw primaryErr
      }

      safeLog({
        type: "fallback",
        fromKind: kind,
        upstreamStatus,
        from: opts.from,
        to: opts.to,
      })
      const result = await secondary(input)
      safeLog({ type: "resolved", provider: opts.to, viaFallback: true })
      return result
    }
  }
}
