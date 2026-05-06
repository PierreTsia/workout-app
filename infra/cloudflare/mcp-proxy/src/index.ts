/**
 * GymLogic MCP proxy — public-URL frontend at `mcp.gymlogic.me`.
 *
 * Single responsibility: brand the URL, stamp `X-Forwarded-Host`, provide a
 * dashboard-flippable kill switch. No business logic, no CORS handling — the
 * upstream Edge Function (file:supabase/functions/mcp/index.ts) already
 * returns the right CORS headers, and the OAuth metadata is rewritten on the
 * function side via `getPublicMcpUrl(req, ...)`.
 *
 * See ADR 0001 for the full deployment / OAuth-issuer reasoning, and T102
 * for the test matrix this implementation has to satisfy.
 */

interface Env {
  /** Upstream Supabase function base URL (e.g. https://abc.supabase.co). Set in wrangler.toml [vars]. */
  UPSTREAM_URL: string
  /**
   * Kill switch — when "true", returns 503 for POST requests only. GETs to
   * `.well-known/*` keep flowing so OAuth metadata stays accessible during
   * incident triage. Set via Cloudflare dashboard (Settings → Variables),
   * NOT wrangler.toml — must be flippable without redeploying.
   */
  KILL_SWITCH?: string
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (env.KILL_SWITCH === "true" && req.method === "POST") {
      return new Response("Service temporarily unavailable", {
        status: 503,
        headers: { "Retry-After": "60" },
      })
    }

    const incomingUrl = new URL(req.url)
    const upstreamBase = new URL(env.UPSTREAM_URL)
    const upstreamUrl = new URL(
      `${incomingUrl.pathname}${incomingUrl.search}`,
      upstreamBase,
    )

    const headers = new Headers(req.headers)
    // Custom header (not `X-Forwarded-Host`) because Supabase's edge gateway
    // strips/overrides the standard one before it reaches the Deno deploy
    // runtime — verified live during T105 smoke. The function-side helper
    // (lib/publicUrl.ts) reads this same name. See ADR 0001 follow-ups.
    headers.set("X-MCP-Forwarded-Host", incomingUrl.host)

    // Streaming bodies require duplex: 'half' on Node's fetch — Cloudflare's
    // runtime accepts this too. Cast keeps strict TS happy until the type
    // surface catches up to the spec.
    const init = {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? null : req.body,
      duplex: "half",
    } as RequestInit

    const upstreamResponse = await fetch(upstreamUrl, init)

    // Free-tier Cloudflare retains console.log for ~7 days — enough for the
    // single-user manual smoke phase. Upgrade to structured Logpush only if
    // we ever onboard real users (see T105 ops setup).
    console.log(
      JSON.stringify({
        method: req.method,
        path: incomingUrl.pathname,
        status: upstreamResponse.status,
      }),
    )

    return upstreamResponse
  },
} satisfies ExportedHandler<Env>
