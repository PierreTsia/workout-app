# Epic Brief — MCP-First Architecture (#231)

## Summary

> *Stop being the brain. Become the body.*

Expose the app's training data, exercise catalog, and domain expertise as an **MCP (Model Context Protocol) server** so that the user's own AI agent (Claude Desktop, Le Chat, etc.) can query, reason about, and eventually write to their workout data. The real value isn't the LLM call — it's the **domain model, the data, and the deterministic expertise**. An MCP server lets us expose exactly that, while the user brings their own intelligence layer.

This shifts the app from "AI features locked in a closed loop" to "agent-ready platform" — the intelligence moves to the user's agent, the app provides the specialized domain layer.

---

## Strategic Rationale

1. **Moat shifts from "we call an LLM" to "we understand strength training data"** — the catalog, the schemas, the progression logic, the validation. That's defensible.
2. **Zero marginal AI cost** — the user's agent provider pays for inference. We stop paying for Gemini.
3. **Composability** — the user's agent can chain our MCP tools with nutrition apps, sleep trackers, calendar. We become part of a stack, not a silo.
4. **Always up-to-date intelligence** — when a better model ships, the user benefits immediately without us changing anything.
5. **MCP Resources as domain vocabulary** — the exercise catalog exposed as browsable MCP Resources means agents understand our domain without burning tool calls.

---

## Context & Problem

**Who is affected:** Any user who wants to interact with their training data through an AI agent outside the app.

**Current state:**

- AI features follow a **closed loop**: React UI → Supabase Edge Function → Gemini 2.5 Flash → validated response → UI. The user never sees the LLM directly and can't bring their own.
- **Deterministic expertise** (RIR-based progression, Epley 1RM, volume maps, triple progression) lives in `file:src/lib/` — accessible only through the React UI.
- **360+ exercise catalog** with rich metadata (muscles, equipment, difficulty, instructions, media) is locked behind in-app search/filter.
- **Training data** (PRs, session history, volume, programs) has no programmatic access — users must open the app and navigate to the right screen.
- Every AI generation costs a Gemini API call that we pay for, with a narrow context window (catalog + profile + recent history).

**Pain points:**


| Pain                                                                                 | Impact                                                                                          |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| AI features are a closed loop — narrow context, single provider, we choose the model | User's agent (which knows their full life context) can't help with training decisions           |
| Domain expertise only accessible via React UI                                        | No way for external tools or agents to leverage progression logic, catalog search, or analytics |
| No programmatic access to training data                                              | Power users can't automate, query, or compose their workout data with other tools               |
| We pay per Gemini call with limited context                                          | Cost scales with usage; smarter models exist but we're locked to our provider                   |


**Market context (April 2026):**

MCP adoption has reached critical mass — 548+ clients listed on PulseMCP, native support in Claude Desktop, ChatGPT, Le Chat (Mistral), Gemini CLI, Cursor, VS Code. SSE transport deprecated April 1 2026, Streamable HTTP is the standard. Supabase ships official MCP server support on Edge Functions with built-in OAuth 2.1.

---

## Goals


| Goal                                       | Measure                                                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Validate the "agent-ready platform" thesis | A read-only coaching conversation via Claude Desktop + MCP tools is subjectively better than in-app `generate-workout` |
| Expose training data to external agents    | Agent can discover and call all Phase 1 tools via MCP protocol                                                         |
| Reuse existing auth and security           | MCP connections go through Supabase OAuth 2.1; RLS applies identically to in-app access                                |
| Zero new infrastructure                    | MCP server runs as a single Supabase Edge Function using the official SDK                                              |


---

## Scope

### In scope

**Phase 1 — Read-Only MCP Server (this epic)**

1. **MCP Edge Function**: single Supabase Edge Function at `/functions/v1/mcp` using `@modelcontextprotocol/sdk` with `WebStandardStreamableHTTPServerTransport` and Hono routing
2. **Auth**: Supabase OAuth 2.1 (enable on project, configure dynamic client registration, consent page — details deferred to Tech Plan)
3. **MCP Tools (read-only)**:
  - `get_workout_history` — query past sessions with optional date range and exercise filters
  - `search_exercises` — search the catalog by name, muscle group, equipment, difficulty
  - `get_training_stats` — volume, frequency, PRs for a given period/muscle group
  - `get_upcoming_workouts` — programmed days and exercises
  - `get_exercise_details` — full metadata for a specific exercise (instructions, media, muscles)
4. **MCP Resources (taxonomy)**:
  - `exercise_catalog_schema` — expose muscle groups, equipment types, difficulty levels as browsable reference data the agent reads once at conversation start
5. **Validation**: manual end-to-end test with Claude Desktop and Le Chat (Mistral)

### Out of scope

- **Write operations** (add exercise, log set, create workout) → Phase 3
- **Domain expertise tools** (suggest progression, calculate 1RM, validate plan, muscle balance report) → Phase 2
- **Deprecation of `generate-workout` / `generate-program`** Edge Functions → Phase 4
- **Consent page UX design** — deferred to Tech Plan; brief only requires it exists
- **Tool output format** (structured text vs JSON vs hybrid) — deferred to Tech Plan
- **Shared domain logic extraction** (moving `src/lib/` code to be importable by Edge Functions) — Phase 2 concern
- **Mobile/non-desktop agent flows** — Le Chat mobile works but not a design target

### Roadmap context

This epic is Phase 1 of a 4-phase arc defined in [#231](https://github.com/PierreTsia/workout-app/issues/231):

- **Phase 1 — Read-Only MCP Server** *(this epic)*: 5 read-only tools + 1 resource, OAuth, end-to-end validation
- **Phase 2 — Domain Expertise as Tools**: `suggest_progression`, `calculate_1rm`, `validate_workout_plan`, `get_muscle_balance_report`
- **Phase 3 — Write Operations**: `add_exercise_to_session`, `create_workout`, `log_set` with dry-run/confirm pattern
- **Phase 4 — Deprecate Closed-Loop AI**: `generate-workout` / `generate-program` become optional; app UI can itself become an MCP client

---

## Technical Decisions

Resolved during discovery (see [#231 discussion](https://github.com/PierreTsia/workout-app/issues/231)):


| Decision                  | Choice                                           | Rationale                                                                                  |
| ------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Transport                 | **Streamable HTTP**                              | SSE deprecated April 2026; stateless, fits Edge Functions; supported by all Tier 1 clients |
| Architecture              | **Single Edge Function** with N `registerTool()` | SDK design; splitting breaks tool discovery; Hono for HTTP, SDK for MCP routing            |
| Auth                      | **Supabase OAuth 2.1 + PKCE**                    | Built-in discovery endpoint, dynamic client registration, same RLS — zero new auth system  |
| Exercise catalog exposure | **Resource for taxonomy, Tool for search**       | Stable reference data as Resource (read once); parameterized search as Tool                |
| Versioning                | **Additive-only, semver on server**              | No URL versioning; never rename/remove tools; description changes = semantic breaks        |


## V1 Test Plan

### Step 1 — Technical smoke test (days 1-2)


| Client                | Cost                       | Validates                                          |
| --------------------- | -------------------------- | -------------------------------------------------- |
| **Cursor**            | 0€ (already paying)        | Transport, auth, tool discovery, data round-trip   |
| **Claude Code** (CLI) | Existing Anthropic API key | Conversational agent in terminal, multi-tool calls |


### Step 2 — Product validation


| Client                | Cost                                            | Validates                                    |
| --------------------- | ----------------------------------------------- | -------------------------------------------- |
| **Claude Desktop**    | Free (1 custom connector, beta) or Pro ($17/mo) | Real coaching conversation — the thesis test |
| **Le Chat (Mistral)** | 0€ (free tier, custom MCP connectors)           | Cross-client compatibility, mobile support   |


### Compatible by default (no special effort)

ChatGPT Desktop (requires Pro $20+/mo), OpenClaw, LibreChat, 250+ MCP clients — standard Streamable HTTP + OAuth. Apple/Siri MCP (macOS 26.1+ beta) is a future bet — don't design for, don't block.

> Full client census: [#231 comment](https://github.com/PierreTsia/workout-app/issues/231#issuecomment-4274296779)
> Test plan details: [#231 comment](https://github.com/PierreTsia/workout-app/issues/231#issuecomment-4274395020)

---

## Success Criteria

> Phase 1 is a proof-of-concept. The primary measure is subjective coaching quality, not production SLAs. Numeric thresholds below are sanity checks, not contractual targets.

- **Connectivity**: MCP server is discoverable and connectable from Claude Desktop and Le Chat without custom code
- **Discovery**: agent lists exactly **5 tools + 1 resource** via MCP protocol handshake
- **Auth**: OAuth flow works end-to-end — user approves, agent gets scoped token, RLS enforces data isolation
- **Latency**: tool responses return in **< 3s p95** (Edge Function cold start included) — enough for a conversational flow
- **Coaching quality**: a read-only coaching conversation (e.g. "analyze my push/pull balance over the last month") is subjectively more useful than what `generate-workout` produces — because the agent has full conversational context and can make multiple tool calls
- **Cross-client**: validated on **>= 2 clients** (Claude Desktop + Le Chat)
- **No regressions**: existing app features, Edge Functions, and auth are unaffected

---

## Risks & Mitigations


| Risk                                                                                  | Mitigation                                                                                    |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Supabase OAuth 2.1 not available on current plan or requires config we haven't tested | Spike OAuth setup first before building tools; fallback to Bearer token auth for personal use |
| Edge Function cold start too slow for MCP handshake                                   | Monitor latency; MCP clients handle retries; single function keeps cold start minimal         |
| Tool output format confuses LLMs (too raw, too verbose)                               | Iterate on descriptions and output structure during testing; this is the real product work    |
| Scope creep into write operations before read-only is validated                       | Hard scope boundary — Phase 1 is read-only, period                                            |


---

## Supersedes

- #91 — original MCP issue (narrower scope, absorbed into this epic)