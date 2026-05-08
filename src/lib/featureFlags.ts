/**
 * Build-time feature flag for the Embedded Agent onboarding (Phase B of epic
 * #295). Read once at the boundary so we have a single call site to flip when
 * we migrate to a remote/PostgREST flag in a post-GA follow-up.
 *
 * Default-on as of T123 (cutover). The legacy AI onboarding path lives on
 * in `/create-program` for "create another program" flows, but the
 * `/onboarding` wizard now always lands users in the Embedded Agent.
 *
 * Env var convention: `VITE_FEATURE_EMBEDDED_AGENT="false"` opts back out
 * (kill switch for hot rollback); any other value (unset, `"true"`,
 * anything else) keeps the flag on.
 */
export function isEmbeddedAgentEnabled(): boolean {
  return import.meta.env.VITE_FEATURE_EMBEDDED_AGENT !== "false"
}
