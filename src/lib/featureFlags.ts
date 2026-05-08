/**
 * Build-time feature flag for the Embedded Agent onboarding (Phase B of epic
 * #295). Read once at the boundary so we have a single call site to flip when
 * we migrate to a remote/PostgREST flag in a post-GA follow-up.
 *
 * Env var convention: `VITE_FEATURE_EMBEDDED_AGENT="true"` (any other value,
 * including unset and `"false"`, returns `false`).
 */
export function isEmbeddedAgentEnabled(): boolean {
  return import.meta.env.VITE_FEATURE_EMBEDDED_AGENT === "true"
}
