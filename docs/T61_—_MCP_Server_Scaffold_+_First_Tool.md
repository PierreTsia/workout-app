# T61 — MCP Server Scaffold + First Tool

## Goal

Prove the full MCP stack works end-to-end: a single Supabase Edge Function running Hono + the MCP SDK receives a JSON-RPC request, authenticates via Bearer token, queries Supabase through RLS, and returns a structured text response. `search_exercises` is the first real tool — it wraps an existing RPC, so the focus is entirely on infrastructure, not query logic.

## Dependencies

None. This is the foundation ticket — everything else depends on it.

## Scope

### Edge Function scaffold

| Item | Detail |
|---|---|
| Function directory | `supabase/functions/mcp/` |
| Entry point | `supabase/functions/mcp/index.ts` |
| HTTP framework | Hono (`npm:hono@^4.9.7`) with catch-all route |
| MCP SDK | `npm:@modelcontextprotocol/sdk@1.25.3` — `McpServer` + `WebStandardStreamableHTTPServerTransport` (stateless) |
| Validation | `npm:zod` (MCP SDK uses it natively for `inputSchema`) |
| Deno types | `jsr:@supabase/functions-js/edge-runtime.d.ts` |
| CORS | Reuse `corsHeaders` pattern from `file:supabase/functions/_shared/cors.ts` |
| Entry | `Deno.serve(app.fetch)` |

The `index.ts` structure:

1. Create Hono app
2. Instantiate `McpServer({ name: "workout-app", version: "0.1.0" })`
3. Import and call tool/resource registration functions
4. Catch-all route: create `WebStandardStreamableHTTPServerTransport()`, connect server, delegate to `transport.handleRequest(c.req.raw)`

### Auth plumbing

| Item | Detail |
|---|---|
| File | `supabase/functions/mcp/lib/supabaseClient.ts` |
| Pattern | Extract `Authorization: Bearer <token>` from request headers |
| Client creation | `createUserClient(authHeader)` — same pattern as `file:supabase/functions/_shared/supabase.ts` |
| Error handling | Missing/invalid header → clear MCP error response |

### First tool: `search_exercises`

| Item | Detail |
|---|---|
| File | `supabase/functions/mcp/tools/searchExercises.ts` |
| Export | Registration function: `(server: McpServer) => void` |
| RPC | Wraps existing `search_exercises` Postgres function (pg_trgm + unaccent) |
| Input schema (Zod) | `query` (string, optional), `muscle_group` (string, optional), `equipment` (string, optional), `difficulty` (string, optional), `limit` (number, optional, default 10) |
| Output | Structured text: numbered list of exercises with name, muscle group, equipment, difficulty |
| Tool description | Clear, LLM-optimized description explaining what the tool does and when to use it |

### Config

Add to `file:supabase/config.toml`:

```toml
[functions.mcp]
verify_jwt = false
```

### Local testing

- `supabase functions serve --no-verify-jwt mcp`
- Test with `curl` (JSON-RPC `tools/list` and `tools/call`)
- Test with MCP Inspector (`npx @modelcontextprotocol/inspector`)

## Out of Scope

- OAuth 2.1 configuration (T64)
- All other tools and resources (T62, T63)
- `lib/format.ts` shared formatters (T63)
- Consent page (T64)
- Production deployment and client testing (T65)

## Acceptance Criteria

- [ ] `supabase functions serve` starts the MCP function without errors
- [ ] `tools/list` JSON-RPC call returns `search_exercises` in the tool list
- [ ] `tools/call` with `search_exercises` and a query string returns exercise results as structured text
- [ ] Requests without a valid Bearer token return an MCP error (not a crash)
- [ ] Requests with a valid user token return only that user's RLS-scoped results (exercises are public reads, but the auth plumbing is proven)
- [ ] MCP Inspector connects and lists the tool
- [ ] `config.toml` has `[functions.mcp]` with `verify_jwt = false`

## References

- [Epic Brief — MCP-First Architecture (#231)](./Epic_Brief_—_MCP-First_Architecture_#231.md)
- [Tech Plan — MCP-First Architecture (#231)](./Tech_Plan_—_MCP-First_Architecture_#231.md) — Sections: Key Decisions, Component Architecture, Config Changes
- [Supabase BYO MCP guide](https://supabase.com/docs/guides/getting-started/byo-mcp)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
