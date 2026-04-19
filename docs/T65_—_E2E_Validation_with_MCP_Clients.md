# T65 — E2E Validation with MCP Clients

## Goal

Validate the "agent-ready platform" thesis end-to-end: connect real MCP clients to the deployed server, verify all 5 tools + 1 resource work through OAuth, and run at least one coaching conversation that's subjectively better than in-app `generate-workout`. Iterate on tool descriptions and output formatting based on what agents actually do with the tools.

## Dependencies

- T61 — MCP Server Scaffold + First Tool
- T62 — Catalog Tools: Exercise Details + Schema Resource
- T63 — Training Data Tools: History, Stats, Upcoming
- T64 — OAuth 2.1 + Consent Page

All tools, the resource, and the OAuth flow must be functional before this ticket starts.

## Scope

### Step 1 — Deploy to production

| Item | Detail |
|---|---|
| Deploy Edge Function | `supabase functions deploy --no-verify-jwt mcp` |
| Enable OAuth 2.1 | Dashboard: Authentication → OAuth Server → Enable, set authorization path, enable dynamic registration |
| Verify discovery | `curl https://<ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1` returns valid JSON |
| Verify function | `curl -X POST https://<ref>.supabase.co/functions/v1/mcp` with `tools/list` JSON-RPC returns all 5 tools + 1 resource |

### Step 2 — Smoke test (Bearer auth, dev tools)

| Client | Transport | Auth | Test |
|---|---|---|---|
| **MCP Inspector** | Streamable HTTP | Bearer token (manual) | Tool discovery, call each tool, verify responses |
| **Cursor** | Streamable HTTP | Bearer / OAuth | Add as MCP server in settings, use tools in conversation |
| **Claude Code** (CLI) | Streamable HTTP | Bearer / OAuth | Multi-tool conversation: "What did I train this week?" |

**Checklist per client:**
- [ ] Connects without errors
- [ ] Lists all 5 tools + 1 resource
- [ ] `search_exercises` returns results
- [ ] `get_exercise_details` returns full metadata
- [ ] `exercise_catalog_schema` resource is readable
- [ ] `get_workout_history` returns session data
- [ ] `get_training_stats` returns volume + PRs
- [ ] `get_upcoming_workouts` returns next days (or graceful empty state)

### Step 3 — Product validation (OAuth, consumer clients)

| Client | Transport | Auth | Test |
|---|---|---|---|
| **Claude Desktop** | Streamable HTTP | OAuth 2.1 | Full coaching conversation — the thesis test |
| **Le Chat (Mistral)** | Streamable HTTP / Connectors | OAuth 2.1 | Cross-client compatibility |

**OAuth flow validation per client:**
- [ ] Client discovers OAuth endpoints automatically
- [ ] Dynamic client registration succeeds
- [ ] User is redirected to consent page
- [ ] Consent page shows client name and scopes
- [ ] Approve → token issued → client connects
- [ ] Deny → client receives `access_denied`

**Coaching conversation test:**
Run a real conversation with Claude Desktop using only MCP tools:
1. "What did I train this week?" → agent uses `get_workout_history`
2. "How's my push/pull balance over the last month?" → agent uses `get_training_stats`
3. "What's programmed for tomorrow?" → agent uses `get_upcoming_workouts`
4. "Tell me about the Romanian deadlift" → agent uses `search_exercises` then `get_exercise_details`
5. "Based on all this, what should I focus on?" → agent reasons over multi-tool context

**Subjective quality bar:** Is this conversation more useful than what in-app `generate-workout` produces? The agent has full conversational context and can make multiple tool calls — that should be a clear advantage.

### Step 4 — Tool description iteration

Based on testing, refine:

| What | Why |
|---|---|
| Tool `description` strings | Agents choose tools based on descriptions — unclear descriptions lead to wrong tool selection |
| Tool `inputSchema` descriptions | Agents fill parameters from descriptions — vague param descriptions cause bad inputs |
| Output formatting | If agents struggle to parse structured text, adjust `lib/format.ts` and tool-specific formatting |
| Error messages | If agents get confused by error responses, make them more directive ("try X instead") |

Expect 2-3 rounds of refinement. Each round: test → observe agent behavior → adjust descriptions → retest.

### Step 5 — Document connection instructions

Create a brief connection guide (in-app or repo README section) per validated client:

- **Claude Desktop**: JSON config snippet for `claude_desktop_config.json`
- **Le Chat**: UI steps for Connectors → paste URL
- **Cursor**: MCP server settings

## Out of Scope

- Write operations (Phase 3)
- Domain expertise tools (Phase 2)
- Performance optimization beyond the 3s threshold (monitor but don't optimize unless broken)
- Automated integration tests (manual validation is sufficient for PoC)
- Mobile client testing (Le Chat mobile works but is not a design target)

## Acceptance Criteria

- [ ] MCP server deployed and reachable at production URL
- [ ] OAuth discovery endpoint returns valid configuration
- [ ] All 5 tools + 1 resource discoverable from Claude Desktop via OAuth
- [ ] All 5 tools + 1 resource discoverable from Le Chat via OAuth
- [ ] Coaching conversation via Claude Desktop + MCP tools is subjectively more useful than in-app `generate-workout`
- [ ] Tool responses return in < 3s p95 (production, cold start included)
- [ ] No regressions: existing app features, Edge Functions, and auth work normally
- [ ] Connection instructions documented for at least 2 clients

## References

- [Epic Brief — MCP-First Architecture (#231)](./Epic_Brief_—_MCP-First_Architecture_#231.md) — Success Criteria, V1 Test Plan
- [Tech Plan — MCP-First Architecture (#231)](./Tech_Plan_—_MCP-First_Architecture_#231.md) — Failure Mode Analysis, Implementation Sequence (steps 11-12)
- [T61 — MCP Server Scaffold + First Tool](./T61_—_MCP_Server_Scaffold_+_First_Tool.md)
- [T62 — Catalog Tools](./T62_—_Catalog_Tools_Exercise_Details_+_Schema_Resource.md)
- [T63 — Training Data Tools](./T63_—_Training_Data_Tools_History_Stats_Upcoming.md)
- [T64 — OAuth 2.1 + Consent Page](./T64_—_OAuth_2.1_+_Consent_Page.md)
- [GitHub Issue #231](https://github.com/PierreTsia/workout-app/issues/231) — Client census comment, test plan comment
