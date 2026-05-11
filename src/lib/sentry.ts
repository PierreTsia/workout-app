import * as Sentry from "@sentry/react"
import { isAuthExpiredError, isDisplayNameTakenError } from "@/hooks/profileErrors"
import type { EmbeddedAgentError } from "@/hooks/useEmbeddedAgentThread"

let initialized = false

/**
 * Idempotent Sentry init. Safe to call from multiple paths:
 *   - `main.tsx` `runWhenIdle` (cold-start init)
 *   - `AppErrorBoundary.componentDidCatch` (error-path safety net)
 *
 * Without the guard, calling `Sentry.init` twice silently replaces the
 * client — wiping pending breadcrumbs and re-installing integrations.
 */
export function initSentry() {
  if (initialized) return
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1,
  })
  initialized = true
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

// #348 — onboarding routes that can hit a Supabase/upsert/edge-function
// rejection. Mirrors the `EmbeddedAgentRoute` shape so the Sentry
// dashboard stays consistent across the two surfaces.
export type OnboardingRoute =
  | "/questionnaire"
  | "/path"
  | "/template"
  | "/summary"
  | "/ai_fallback"

export type OnboardingErrorKind =
  | "display_name_taken"
  | "auth_expired"
  | "unknown"

function classifyOnboardingError(e: unknown): OnboardingErrorKind {
  if (isDisplayNameTakenError(e)) return "display_name_taken"
  if (isAuthExpiredError(e)) return "auth_expired"
  return "unknown"
}

/**
 * Send an onboarding submit failure to Sentry with the same
 * `feature` + `route` + `error_kind` taxonomy as the embedded-agent
 * capture path. Lives here (not inline in `OnboardingPage`) so
 * `@sentry/react` stays a single static import, preserving the
 * dynamic-import code-split for `AppErrorBoundary`.
 */
export function captureOnboardingError(route: OnboardingRoute, e: unknown): void {
  const kind = classifyOnboardingError(e)
  const exception = e instanceof Error ? e : new Error(`onboarding ${route} ${kind}`)
  Sentry.captureException(exception, {
    tags: {
      feature: "onboarding",
      route,
      error_kind: kind,
    },
  })
}
