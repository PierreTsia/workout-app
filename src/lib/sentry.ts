import * as Sentry from "@sentry/react"
import type { EmbeddedAgentError } from "@/hooks/useEmbeddedAgentThread"

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1,
  })
}

// T122: route taxonomy mirrors the server-side `LogRoute` union in
// `supabase/functions/embedded-agent/log.ts`. Keeping these two type
// definitions in lockstep is a minor copy-paste tax — TS imports across
// the Vite/Deno boundary aren't worth the build complexity.
export type EmbeddedAgentRoute = "/thread" | "/message" | "/draft" | "/commit" | "/reject"

// Friendly UX errors — already surfaced to the user via banners /
// dedicated retry cards. Capturing these in Sentry would turn signal
// into noise (every quota cap would page someone). Keep this list in
// sync with the explicit branches in `EmbeddedAgentError`.
const FRIENDLY_KINDS = new Set<EmbeddedAgentError["kind"]>([
  "quota",
  "no_active_thread",
])

/**
 * Send an Embedded Agent mutation error to Sentry — but only when it's
 * something the user UI cannot meaningfully recover from on its own
 * (i.e. not a quota/precondition we already render copy for).
 *
 * Tags `feature: 'embedded-agent'` + `route` + `error_kind` so the
 * Sentry dashboard can slice failures by route and pair them with the
 * server-side structured logs (same `error_kind` taxonomy).
 */
export function captureEmbeddedAgentError(
  route: EmbeddedAgentRoute,
  error: EmbeddedAgentError,
): void {
  if (FRIENDLY_KINDS.has(error.kind)) return
  const message = error.kind === "unknown" ? error.message : `embedded-agent ${route} ${error.kind}`
  Sentry.captureException(new Error(message), {
    tags: {
      feature: "embedded-agent",
      route,
      error_kind: error.kind,
    },
  })
}
