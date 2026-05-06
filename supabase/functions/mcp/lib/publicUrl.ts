/**
 * Resolve the canonical public MCP URL for the current request.
 *
 * GymLogic's MCP server has two valid front doors (see ADR 0001):
 *
 *   - `https://mcp.gymlogic.me/functions/v1/mcp`  via Cloudflare Worker proxy
 *   - `https://<project>.supabase.co/functions/v1/mcp`  direct
 *
 * When the Worker proxies a request, it sets `X-MCP-Forwarded-Host:
 * mcp.gymlogic.me`. The Edge Function uses that header to stamp the
 * customer-facing hostname into the OAuth `resource:` field and the
 * `WWW-Authenticate: resource_metadata=...` URL — those MUST match the host
 * the client actually called, otherwise OAuth issuer validation fails.
 *
 * Why a custom header name (not `X-Forwarded-Host`): Supabase's edge gateway
 * strips/overrides the standard one before it reaches the Deno deploy
 * runtime. Verified live during T105 smoke. The custom name passes through
 * untouched.
 *
 * For requests that hit Supabase directly (local MCP Inspector, legacy
 * clients on the old URL), we fall back to `SUPABASE_URL`. Both paths
 * remain valid forever — the old URL is never deprecated.
 */
export function getPublicMcpUrl(req: Request, supabaseUrl: string): string {
  const fwdHost = req.headers.get("X-MCP-Forwarded-Host")
  if (fwdHost) return `https://${fwdHost}/functions/v1/mcp`
  return `${supabaseUrl}/functions/v1/mcp`
}
