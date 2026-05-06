/**
 * Vitest unit tests for the MCP proxy Worker.
 *
 * Why vanilla vitest (not @cloudflare/vitest-pool-workers): the Worker uses no
 * Cloudflare-specific runtime APIs (no KV, no Durable Objects, no Queues), so
 * the heavier setup buys nothing. We mock `globalThis.fetch` per-test and
 * exercise the handler's public contract: `fetch(req, env) → Response`.
 *
 * Each case maps to one branch of the `KILL_SWITCH` × `req.method` truth
 * table, plus the always-on passthrough behaviors (path/query preservation,
 * `X-Forwarded-Host` stamping, transparent error propagation).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import worker from "./index"

const env = { UPSTREAM_URL: "https://abc.supabase.co" }

describe("mcp-proxy Worker", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(
      new Response("upstream-body", { status: 200 }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  it("forwards POST requests to the upstream URL preserving path and query", async () => {
    const req = new Request("https://mcp.gymlogic.me/functions/v1/mcp?foo=bar", {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    })

    await worker.fetch(req, env)

    expect(fetchMock).toHaveBeenCalledOnce()
    const [upstreamUrl, init] = fetchMock.mock.calls[0]
    expect(String(upstreamUrl)).toBe("https://abc.supabase.co/functions/v1/mcp?foo=bar")
    expect((init as RequestInit).method).toBe("POST")
  })

  it("stamps X-Forwarded-Host with the incoming request's host", async () => {
    const req = new Request("https://mcp.gymlogic.me/functions/v1/mcp", {
      method: "POST",
    })

    await worker.fetch(req, env)

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = init.headers as Headers
    expect(headers.get("X-Forwarded-Host")).toBe("mcp.gymlogic.me")
  })

  it("returns 503 with Retry-After when KILL_SWITCH=true blocks a POST and skips upstream", async () => {
    const req = new Request("https://mcp.gymlogic.me/functions/v1/mcp", { method: "POST" })

    const res = await worker.fetch(req, { ...env, KILL_SWITCH: "true" })

    expect(res.status).toBe(503)
    expect(res.headers.get("Retry-After")).toBe("60")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("lets GET .well-known requests through even when KILL_SWITCH=true (so OAuth metadata stays accessible during incident triage)", async () => {
    const req = new Request("https://mcp.gymlogic.me/functions/v1/mcp/.well-known/oauth-protected-resource")

    const res = await worker.fetch(req, { ...env, KILL_SWITCH: "true" })

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it("propagates upstream error responses as-is (no transformation)", async () => {
    fetchMock.mockResolvedValue(new Response("upstream blew up", { status: 500 }))
    const req = new Request("https://mcp.gymlogic.me/functions/v1/mcp", { method: "POST" })

    const res = await worker.fetch(req, env)

    expect(res.status).toBe(500)
    expect(await res.text()).toBe("upstream blew up")
  })
})
