# Epic Brief — Publish MCP + Skill to Anthropic Directory (#296)

## Summary

GymLogic ships its MCP server and the matching `gymlogic-mcp` skill into Anthropic's Connectors Directory and Plugins Directory respectively, making both installable in one click from Claude Desktop / Claude.ai instead of requiring users to paste a Supabase URL into a Custom Connector dialog. To get there, this epic adds spec-conformant **Tool Annotations** to all 10 MCP tools (Claude's UI hint surface), introduces a Cloudflare Worker proxy at `mcp.gymlogic.me` so the connector lives on a brand-matched domain (with a kill switch and an OAuth issuer ADR documenting why Supabase Auth stays put), publishes a privacy policy, packages the existing skill as a Claude plugin in a public-friendly format, prepares a demo account with realistic data for Anthropic reviewers, and submits both forms. Dependent on #302 shipping the public docs URL `docs.gymlogic.me/connect/claude` to point reviewers at; the technical hardening (annotations + proxy + docs sweep) is unblocked and shipping first on `feat/296/publish-mcp-connectors-directory`.

---

## Context & Problem

**Who is affected:** the **Anthropic Directory reviewer** evaluating both the connector and plugin submissions (their experience determines approval); **non-technical users** (friends, beta testers, prospective public users) who today must navigate Settings → Connectors → Add custom connector → paste a Supabase URL → OAuth — a five-step process with a Supabase-generated hostname that reads as phishy; **existing power users** installed against the Supabase URL who must keep working post-migration; **the maintainer** running the kill switch when production hiccups; **Claude (the LLM)** consuming the tools, which currently can't tell read from destructive at the protocol level.

**Current state:**

- **MCP server** lives at `https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp` — a Supabase-generated hostname that a non-technical user would not paste with confidence into Claude Desktop. This is the only URL documented in `file:skills/gymlogic-mcp/SKILL.md` and `file:docs/mcp-connect/*.md`.
- **All 10 tools** in `file:supabase/functions/mcp/tools/registry.ts` expose `name`, `description`, `inputSchema`, and `handler` only. **No `annotations` block** — Claude has no protocol-level signal for read-only vs destructive, no human-readable `title`, no idempotency hint. Result: every tool call prompts the user; auto-permissions don't kick in for reads.
- **OAuth flow** is wired up via `file:supabase/functions/mcp/index.ts` exposing `.well-known/oauth-protected-resource` (RFC 9728) and proxying `.well-known/oauth-authorization-server` (RFC 8414) from Supabase Auth. The `resource` field and `WWW-Authenticate` header are hardcoded to the Supabase URL. Consent UI already lives at `gymlogic.me/oauth/consent`.
- **Skill `file:skills/gymlogic-mcp/SKILL.md`** is internally inconsistent — line 13 says "**nine** tools", line 66 says "**Ten** tools total" (the registry has 10, including `resolve_exercises` from #310). The issue body's annotation table omits `resolve_exercises` entirely.
- **Privacy policy** does not exist as a public URL on `gymlogic.me`. Resend / transactional email already use Cloudflare-managed DNS (`file:docs/done/T55_—_Resend_Cloudflare_DNS_&_Domain_Setup_(No-Code).md`), so DNS for `mcp.gymlogic.me` is straightforward — no provider migration.
- **Plugin packaging**: the skill is a Cursor-style markdown file. Anthropic's plugin format requires a public GitHub repo + `claude plugin validate` pass — not validated yet.
- **Issue #302** (`file:docs/Tech_Plan_—_A4_Connect_Claude_#302.md`) ships the public docs URL `docs.gymlogic.me/connect/claude` that the Anthropic submission form will point at. Currently embedded in the Astro mini-site epic #298. Not yet shipped; partially blocking this epic.
- **Decisions already locked in** via grilling on this branch: tool annotation type shape, per-tool annotation matrix, code organization, Cloudflare Worker passthrough + kill switch, OAuth issuer policy, backward-compat strategy. Captured in `file:docs/adr/0001-mcp-public-url-and-oauth-issuer.md` and `file:docs/CONTEXT.md`.

**Pain points:**

| Pain | Impact |
|---|---|
| Setup requires technical comfort with Custom Connector dialogs | Non-tech users hit a wall; the "ouvre Claude, cherche GymLogic, clique install" pitch doesn't work today |
| Supabase-generated hostname looks phishy | Trust friction at install — even technical users hesitate |
| No tool annotations | Every tool call prompts user; auto-permissions disabled; UX worse than competitors |
| No public privacy policy | Submission criterion failure; Directory listing rejected |
| Plugin not packaged | Plugins Directory listing impossible until skill is validated |
| Existing public docs URL is the GitHub repo path (`docs/mcp-connect/claude-desktop.md`) | Submission requires a polished, public URL — depends on #302 |
| Tool count + naming inconsistency in skill | Future maintainers and submitters confused about ground truth |
| URL change risks breaking existing installs | Maintainer + early beta testers; mitigated by keeping both URLs alive |

---

## User Stories

1. As an **Anthropic Directory reviewer** evaluating the GymLogic submission, I want every tool to declare proper `annotations` (`title`, `readOnlyHint` for reads, `destructiveHint` for writes, `idempotentHint` where applicable), so that I can verify the submission meets the published review criteria without manual inspection of each tool's behavior.
2. As an **Anthropic Directory reviewer**, I want the MCP server to be hosted on a domain matching the GymLogic brand (`mcp.gymlogic.me`), so that I can confirm the server is operated by the service it claims to integrate with.
3. As an **Anthropic Directory reviewer**, I want a public privacy policy at `https://gymlogic.me/privacy` covering data collection, usage, storage, third-party sharing, retention, and contact, so that I can validate the GDPR/CCPA-adjacent baseline before approving the listing.
4. As an **Anthropic Directory reviewer**, I want a public documentation URL (`https://docs.gymlogic.me/connect/claude`) describing the connector setup, so that I can verify the install flow before users hit it.
5. As an **Anthropic Directory reviewer**, I want a working test account with realistic data (active program, recent workouts, varied exercise log) and a long-lived PAT, so that I can manually invoke each tool and confirm meaningful, non-error responses.
6. As an **Anthropic Plugin Directory reviewer** evaluating the `gymlogic-mcp` plugin submission, I want the plugin packaged in a public GitHub repo passing `claude plugin validate`, with a clear cross-reference to the connector listing, so that I can approve the dual-listing.
7. As a **non-technical end user** (a friend, a beta tester, a prospective public user) discovering GymLogic in the Connectors Directory, I want a one-click "Install" button in Claude Desktop / Claude.ai that handles OAuth without me copy-pasting a URL, so that setup takes seconds instead of five steps.
8. As a **technical user** pasting the GymLogic URL into a non-Claude MCP client (Cursor, Le Chat, OpenClaw), I want the URL to read as obviously legitimate (`mcp.gymlogic.me`) rather than `favusepjqwpcroiolvaz.supabase.co`, so that I have confidence in what I'm connecting to.
9. As an **existing user** already installed against the Supabase URL, I want my connection to keep working unchanged after the brand URL ships, so that I don't have to re-install or re-authenticate.
10. As **Claude (the LLM)** selecting tools to call, I want each tool to declare whether it's read-only or destructive via standard MCP annotations, so that my host application can apply the right consent model — auto-allow reads, always-prompt destructive writes.
11. As **Claude**, I want to know which write tools are idempotent (`update_program`) vs non-idempotent (`create_program`), so that I can safely retry the former on transient failures without creating duplicate programs.
12. As a **Claude user** clicking links inside tool responses (e.g. references to `gymlogic.me/account/api-tokens`), I want those known-safe domains to skip the "open external link?" confirm prompt, so that the in-chat experience flows.
13. As the **maintainer triaging an MCP outage**, I want a kill switch on the public URL that doesn't require redeploying the Edge Function, so that I can take POST traffic offline within seconds via a Cloudflare env var flip while leaving OAuth metadata GETs accessible.
14. As the **maintainer** considering a future migration off Supabase, I want existing user installs to point at the brand domain (not the implementation domain), so that the migration is invisible to users.
15. As the **maintainer authoring docs**, I want `skills/gymlogic-mcp/SKILL.md` and every `docs/mcp-connect/*.md` updated to reference `mcp.gymlogic.me` exclusively, with the 9-vs-10 tool count inconsistency fixed, so that no future contributor or submitter is misled.
16. As **future-me** onboarding to the codebase six months from now, I want an ADR explaining why the MCP server is fronted by a Cloudflare Worker (and why OAuth still goes to Supabase), so that I understand the trade-off without re-deriving it.

### Success measures

| Story # | Measure |
|---|---|
| 1, 10, 11 | All 10 tools (`search_exercises`, `resolve_exercises`, `get_exercise_details`, `get_workout_history`, `get_training_stats`, `get_upcoming_workouts`, `list_programs`, `get_program_details`, `create_program`, `update_program`) expose `annotations.title` plus the correct hint per the matrix in ADR 0001. Verified by `tools/registry_test.ts` property assertions. |
| 2, 8, 9, 14 | `https://mcp.gymlogic.me/functions/v1/mcp` returns identical JSON-RPC responses to the Supabase URL for `initialize`, `tools/list`, `resources/list`. Both URLs alive — verified by `curl` against each. |
| 5 | Every tool returns a non-error response when invoked via MCP Inspector with the test account's PAT. Zero `Authentication required` or generic 5xx responses on the validation pass. |
| 13 | `KILL_SWITCH=true` env var flip on the Worker returns `503` for POST requests within 60s of dashboard save; `.well-known/*` GETs still resolve. |
| - | **Final**: GymLogic appears in `claude.com/connectors/directory` AND the corresponding Plugin Directory, installable in one click from Claude Desktop / Claude.ai. |

Stories 3, 4, 6, 7, 12, 15, 16 are validated qualitatively (manual inspection of the listed URL, social card debugger, reviewer feedback, ADR review).

---

## Scope

**In scope:**

### Track A — Submission to Connectors Directory

- **A1 — Tool annotations** (DECIDED — see grilling Q1-Q4 + ADR 0001):
  - A1.1 Add `annotations: ToolAnnotations` (required) to `ToolDefinition`. `ToolAnnotations.title: string` is required; `readOnlyHint`, `destructiveHint`, `idempotentHint` are optional booleans. `openWorldHint` skipped (uniformly false for closed-world tools).
  - A1.2 Annotate all 10 tools per the matrix: 8 reads (`readOnlyHint: true`, `idempotentHint: true`); `create_program` (`destructiveHint: true`, `idempotentHint: false`); `update_program` (`destructiveHint: true`, `idempotentHint: true`).
  - A1.3 Inline annotations at each tool's call site (no central map, no constructor helper).
  - A1.4 Property test in `tools/registry_test.ts`: assert every tool exposes `annotations.title` via `toolRegistry.list()`; assert no tool claims both `readOnlyHint` and `destructiveHint`.
- **A2 — Cloudflare Worker proxy at `mcp.gymlogic.me`** (DECIDED — see ADR 0001):
  - A2.1 Worker source in `infra/cloudflare/mcp-proxy/` with `wrangler.toml`, `src/index.ts`, `package.json`. Passthrough + kill switch + minimal logging. ~50 LOC.
  - A2.2 Function reads `X-Forwarded-Host` to dynamically rewrite `.well-known/oauth-protected-resource.resource` and the `WWW-Authenticate` header (per-request `getPublicMcpUrl(req)` with fallback to `SUPABASE_URL`-derived).
  - A2.3 DNS: `mcp.gymlogic.me` Worker route on the existing Cloudflare-managed `gymlogic.me` zone.
  - A2.4 Both URLs (Supabase + brand) stay alive forever; Supabase URL not blocked, deprecated, or sunset.
- **A3 — User-facing docs URL update** (in this branch's PR):
  - A3.1 `skills/gymlogic-mcp/SKILL.md`: switch line 57's URL to `mcp.gymlogic.me`; fix line 13's "nine tools" → "ten tools" (line 66 already correct).
  - A3.2 All `docs/mcp-connect/*.md` files (`claude-desktop.md`, `cursor.md`, `le-chat.md`, `openclaw.md`, `example-prompts.md`): URL update.
- **A4 — Privacy policy publication**:
  - A4.1 Author privacy policy copy covering 6 points: data collection (what we collect from MCP requests + OAuth), usage (training/coaching purposes only), storage (Supabase EU region), third-party sharing (Resend for email; no marketing partners), retention (per Supabase auth defaults; PAT lifetime user-controlled), contact (`admin@gymlogic.me`).
  - A4.2 Publish at `https://gymlogic.me/privacy` (or `/legal/privacy`) on the Astro mini-site or current SPA — surface decision in Tech Plan.
- **A5 — Public documentation URL** (depends on #302):
  - A5.1 `https://docs.gymlogic.me/connect/claude` ships per `file:docs/Tech_Plan_—_A4_Connect_Claude_#302.md`. This epic depends on it; #302 should pick up the new `mcp.gymlogic.me` URL on rebase.
- **A6 — Test account preparation**:
  - A6.1 Create a demo account (e.g. `directory-reviewer@gymlogic.me`) with: an active 4-day program, ~15 logged workouts spanning the last 30 days, varied exercises across muscle groups, at least one PR-eligible session.
  - A6.2 Generate a fresh long-lived PAT for reviewers (rotate after submission approval).
- **A7 — Branding assets**:
  - A7.1 Logo URL or SVG (overlap with #302's existing branding).
  - A7.2 Favicon (already exists on `gymlogic.me`).
- **A8 — Allowed Link URIs**: declare `https://gymlogic.me`, `https://www.gymlogic.me` in the Anthropic submission form's optional "Allowed link URIs" field — skips Claude's external-link confirm prompt for in-chat references to those hosts.
- **A9 — Connector submission**: fill out and submit `clau.de/mcp-directory-submission` with all required fields.

### Track B — Plugin Submission

- **B1 — Plugin packaging** (research-shaped — Tech Plan needs a discovery commit):
  - B1.1 Decide repo structure: subfolder of main monorepo (e.g. `plugins/gymlogic-claude/`) OR separate public repo (e.g. `PierreTsia/gymlogic-claude-plugin`). Constraint: Anthropic requires a public GitHub repo; `PierreTsia/workout-app` is already public, so subfolder is viable.
  - B1.2 Package the existing `skills/gymlogic-mcp/SKILL.md` per Anthropic's plugin format (research required — current skill is Cursor-style markdown).
- **B2 — Plugin validation**:
  - B2.1 `claude plugin validate` passes locally.
- **B3 — Plugin submission**:
  - B3.1 Submit via `claude.com/plugins/submit`.
  - B3.2 Cross-reference the connector listing (link plugin to MCP submission via the form's "optional Skill" field).

### Track C — ADR + Glossary

- **C1 — ADR 0001 — MCP public URL and OAuth issuer** (WRITTEN — `file:docs/adr/0001-mcp-public-url-and-oauth-issuer.md`).
- **C2 — Glossary updates** (DONE — `file:docs/CONTEXT.md` MCP section: `Tool Annotation`, `MCP Public URL`, `MCP Edge Function URL`).

### Track D — Submission validation + follow-up

- **D1 — MCP Inspector pass**: every tool invoked via [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) against the test account's PAT returns a meaningful, non-error response. Reviewers will run an equivalent pass; pre-empt their findings.
- **D2 — Submission tracking**: monitor the Anthropic dashboard ("rolling out" status); follow up via `mcp-review@anthropic.com` if stalled past 3 weeks.
- **D3 — Post-approval doc update**: replace the "Coming soon" callout in #302's `claude.mdx` (and source `claude-desktop.md`) with the directory listing URL once approved. **Tracked as a separate ticket post-submission.**

**Out of scope (deferred):**

- The Astro mini-site itself (#298, #299, #302) — separate epics; this epic depends on #302 for A5 only.
- Refonte of in-app onboarding to expose a "Connect Claude" badge in day-N+3 — that's #295 Track 2, downstream of this epic shipping.
- Adding new MCP tools or features (`set_active_program`, `log_session`, etc.) — separate tickets.
- Submission to other AI marketplaces (OpenAI Apps Directory, Mistral, Cursor's own marketplace) — separate tickets if/when they exist.
- Desktop extension (MCPB) format — staying with remote MCP only.
- Migration to a custom OAuth Authorization Server replacing Supabase Auth — only if Anthropic reviewers reject on issuer-domain grounds (ADR sequel triggers this).
- Full OAuth proxy at `mcp.gymlogic.me/auth/*` — same condition as above.
- Canary subdomain `mcp-canary.gymlogic.me` for staging — premature at current user count (= maintainer); kill switch + fast rollback give equivalent safety.
- Privacy policy legal review by a lawyer — self-authored copy is acceptable for v1; revisit if audience grows or B2B pivot happens.
- Auto-sync between `skills/gymlogic-mcp/SKILL.md` and `docs/mcp-connect/*.md` — manual is fine at current scale.

---

## Success Criteria

**Numeric / verifiable:**

- All 10 MCP tools expose `annotations` with `title` per the matrix (verified via `tools/registry_test.ts`).
- `https://mcp.gymlogic.me/functions/v1/mcp` returns identical JSON-RPC responses to the Supabase URL for `initialize`, `tools/list`, `resources/list` (verified by `curl + diff`).
- Both URLs alive: Supabase URL returns same responses as before (no behavior change for existing users).
- `https://gymlogic.me/privacy` returns 200 over HTTPS, content covers all 6 required points.
- `https://docs.gymlogic.me/connect/claude` returns 200 (depends on #302).
- Connector submission form submitted with all required fields populated.
- Plugin validates via `claude plugin validate` and is submitted via the plugin form.
- MCP Inspector pass: each of 10 tools returns a meaningful, non-error response with the test account's PAT.
- `KILL_SWITCH=true` flips the Worker's MCP RPC traffic to 503 within 60s; `.well-known/*` still resolves.
- ADR 0001 + glossary entries exist in `docs/`.

**Qualitative:**

- GymLogic appears in `claude.com/connectors/directory` — installable in one click from Claude Desktop.
- GymLogic skill appears in the Plugins Directory — installable separately, cross-referenced from the connector listing.
- The maintainer can install GymLogic in a fresh Claude Desktop using only `mcp.gymlogic.me` (no Supabase URL fallback needed).
- Existing users (PAT or OAuth, on Supabase URL) experience zero disruption.
- The "ouvre Claude, cherche GymLogic, clique install" pitch is concretely true — verified end-to-end by a non-technical first-time user.

---

## Open Assumptions

Things resolved in the brief but worth de-risking before or during the Tech Plan:

- **Anthropic accepts partial domain match** (MCP endpoint on brand, OAuth issuer on Supabase). The literal "MCP server domain" criterion is satisfied, but reviewer interpretation may vary. If rejected, ADR sequel + Worker scope expansion to also proxy OAuth metadata + endpoints. Not pre-built — premature.
- **The skill update lands without conflicting with #302's `claude-desktop.md` sync.** #302 will rebase on this branch's URL change and pick it up automatically. Coordinate with #302's implementer if rebase doesn't pick up cleanly.
- **Cloudflare Workers free tier (100k requests/day)** is sufficient at current MCP traffic. Monitor if usage spikes post-Directory listing.
- **Anthropic plugin format** is stable enough to package the existing skill against without surprise. If `claude plugin validate` requires a fundamentally different structure than the current Cursor-style skill, B1 needs more scoping (potentially a separate ticket).
- **The Astro mini-site (#302) ships in time.** This epic's A5 depends on it. If #302 slips, the connector submission can technically proceed with `gymlogic.me` (root) as the docs URL, but the polished page reviewers see is the lever for approval — not just any 200.
- **Privacy policy can be self-authored.** No legal review for v1. Acceptable for a solo-dev side project; revisit if scope shifts.
- **Submission queue moves at acceptable pace.** Anthropic doesn't publish SLAs; expect 2-6 weeks. If timeline is critical, contingency: ship the connector with a longer-lived Custom-Connector landing experience until the Directory listing approves.

---

## References

- This issue: #296
- Related epic / blocker: #298 (Bootstrap Astro Mini-Site)
- Downstream PR for public docs URL: #302 (A4 Connect Claude page)
- Related downstream epic: #295 (post-onboarding "Connect Claude" badge — depends on this epic shipping)
- Related shipped epic: #310 (`resolve_exercises` batch tool — the 10th tool in the registry)
- Code anchors:
  - `file:supabase/functions/mcp/tools/registry.ts` (ToolDefinition, registry)
  - `file:supabase/functions/mcp/index.ts` (function entry, `.well-known` endpoints)
  - `file:supabase/functions/mcp/lib/auth.ts` (PAT + OAuth resolver)
  - `file:skills/gymlogic-mcp/SKILL.md` (skill targeting plugin packaging in B)
- Decisions:
  - `file:docs/adr/0001-mcp-public-url-and-oauth-issuer.md`
  - `file:docs/CONTEXT.md` (MCP glossary section)
- Anthropic docs:
  - Submission: https://claude.com/docs/connectors/building/submission
  - Review criteria: https://claude.com/docs/connectors/building/review-criteria
  - Connector form: https://clau.de/mcp-directory-submission
  - Plugin form: https://claude.com/plugins/submit
  - Directory: https://claude.com/connectors/directory
- Workspace rules: `file:.cursor/rules/docs-format.mdc` (Epic Brief template), `file:.cursor/rules/build-sandbox-caveat.mdc` (build commands), `file:.cursor/rules/no-commit-without-permission.mdc`
