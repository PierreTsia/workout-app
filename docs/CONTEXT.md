# GymLogic — Ubiquitous Language

Shared vocabulary used by the codebase, the product team, and anything we'd explain to a domain expert (a coach, a beta tester, a future-you). When you find yourself writing a term in a doc, a variable name, or a chat message, the canonical definition lives here.

> Out of scope for now: a multi-context map. Single context, single file. Split later if it grows beyond ~150 terms.

## Conventions

- **Bold** for the canonical term, exactly as it should appear in code (`PascalCase` types, `camelCase` fields) and in docs (Title Case prose).
- One-sentence definition first; expand only when needed.
- Cross-reference other terms with **bold**; never paraphrase.
- Add a `→ file:src/.../foo.ts` link when a term has an obvious code anchor.

---

## MCP

**Tool Annotation**:
Optional metadata block on a `ToolDefinition` exposing UI hints (`title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`) to MCP clients (Claude Desktop, Cursor, Le Chat). Drives the client's auto-permission behavior — read-only tools execute without confirmation prompts; destructive tools always prompt. Distinct from a tool's prose `description`, which targets the LLM, not the UI.
→ `file:supabase/functions/mcp/tools/registry.ts`

**MCP Public URL**:
The user-facing branded URL of the GymLogic MCP server: `https://mcp.gymlogic.me/functions/v1/mcp`. The only URL promoted in user-facing docs (skill, `docs/mcp-connect/*.md`, the eventual Anthropic Connectors Directory submission). Routed by a Cloudflare Worker fronting the **MCP Edge Function URL**.

**MCP Edge Function URL**:
The Supabase-internal URL of the GymLogic MCP server: `https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp`. Stays alive indefinitely for backward compatibility with users who installed before the **MCP Public URL** existed; not promoted in any user-facing docs after the Cloudflare proxy ships.
→ `file:supabase/functions/mcp/index.ts`

**Embedded Agent**:
First-party GymLogic automation in **Edge Functions** (or equivalent server-side orchestration): the LLM drives the flow; MCP tool calls go **server → MCP** using the **MCP Edge Function URL** (deliberately not the **MCP Public URL**, to skip the Cloudflare hop), with the user’s Supabase session JWT as `Authorization: Bearer …`. Same deployed function, tools, and RLS as an **External MCP Client**; the bearer never reaches the model provider or the browser.
→ `file:supabase/functions/mcp/index.ts`

**MCP Personal Access Token (PAT)**:
A `glp_…` secret the user generates in-app; presented as a Bearer token to MCP, verified server-side, then exchanged for a short-lived user-scoped JWT for tool execution. Used when an **External MCP Client** cannot complete OAuth like the PWA session flow.
→ `file:supabase/functions/mcp/lib/pat.ts`

**External MCP Client**:
A third-party host for the LLM (e.g. Claude Desktop, Cursor) that connects to the GymLogic MCP server over the **MCP Public URL**; the user authenticates via OAuth (or an **MCP Personal Access Token (PAT)** where applicable), not via the PWA session cookie.
→ `file:supabase/functions/mcp/lib/authLogic.ts`

---

## Programs & agent flows

**Onboarding form**:
The structured onboarding questionnaire in the PWA. **V1:** keep it — do not replace it with chat-only; drop-off and losing hard constraints (equipment, frequency, etc.) is too risky. The **Embedded Agent** chat is **additive** (qualitative follow-up: injuries, vague goals, nuance), then the **Program draft step** + `**create_program`** path.
→ `file:src/pages/OnboardingPage.tsx`

**Embedded Agent onboarding (v1)**:
The **Embedded Agent** runs **only** after **PathChoice** when the user picks the **AI program** path. **Template** and **Blank** paths **do not** include the chat — keep scope tight.
→ `file:src/pages/OnboardingPage.tsx`

**Embedded Agent onboarding product (v1)**:
Product rules not delegated to engineering defaults: **(1) Branding** — GymLogic-native copy only; do **not** surface external model or assistant **brand names** in UI (provider is infrastructure). **(2) Reach** — **online-only**; chat, **Program draft step**, and MCP require network; no offline **Embedded Agent** in v1. **(3) Content scope** — chat is for **qualitative** gaps (injuries, nuance, goals), not a duplicate **Onboarding form**; do not systematically re-ask structured fields already collected unless the user corrects themselves. **(4) Economics** — **Embedded Agent** consumption counts as **in-app AI usage** in the **same fairness / quota family** as existing AI program generation (exact caps in implementation; no separate “unlimited” lane without an explicit product change).

**Embedded Agent quota**:
Server-side limits on **Embedded Agent** LLM usage (e.g. messages per time window, one active draft thread) enforced in **Edge Functions** using **trusted** state — **not** client-enforced. Required when the inference key is GymLogic-hosted (cost/abuse). **V1:** enforce using the **Embedded Agent thread** table (counts / status per row); optional extra `**ai_generation_log`** rows per turn if we want parity with other AI features — **ships with the Embedded Agent**, not deferred.

**Embedded Agent thread**:
**V1 decision:** persist onboarding **Embedded Agent** chat in a **new Postgres table** (working name `**embedded_agent_threads`**; final name in migration): at minimum `**id**` (uuid PK), `**user_id**` (FK to auth user), `**status**` (`open` | `preview_ready` | `committed` | `abandoned`), `**messages**` (JSONB transcript), `**created_at**`, `**updated_at**`, optional `**locale**` (`en`|`fr`) echo of app locale at thread open, optional `**last_preview**` (JSONB or reference) for `**create_program**` `dry_run` payload, optional `**program_id**` after **committed**, optional `**committed_at`**, `**abandoned_at**`. **RLS** so only the owning user can read/write. **Partial unique index** (or equivalent): at most one row per `user_id` where `status` ∈ (`open`, `preview_ready`). Staleness checks run **server-side** on thread load / chat Edge calls — not PWA-only. **Source of truth** for transcript, resume/multi-tab, and **Embedded Agent quota** — see **Embedded Agent thread lifecycle**.

**Embedded Agent thread retention**:
**Tension:** long retention helps a future **continue coaching** experience, but **Embedded Agent** messages can hold health-ish **PII**. **V1 default:** do **not** assume “forever full transcript” for onboarding threads. **Keep** the thread row and **non-sensitive metadata** (e.g. `status`, `committed_at`, `program_id` link, quota-relevant counts) as long as product/analytics need; **truncate or delete `messages` JSONB** after **90 days** post-`**committed`** or `**abandoned`** (**v1**), unless/until the user **explicitly opts in** to extended coaching memory (separate epic — distinct consent and possibly a **new** thread type). **Rationale:** preserves funnel metrics and program linkage without an open-ended liability on raw chat. **Account deletion:** **hard-delete** **Embedded Agent** thread rows (and messages) **immediately** — retention windows do not delay erasure when the user deletes their account.

**Embedded Agent thread lifecycle**:
**Resume:** entering the **Embedded Agent onboarding (v1)** flow loads the user’s single active row (`open` or `preview_ready`) if present; otherwise insert a new row. `**committed`**: set after `**create_program**` with `dry_run: false` succeeds (post **Onboarding program commit gate**). **Preview reject / regenerate:** **v1 default:** keep the **same** **Embedded Agent thread** — append turns and clear or supersede the stale preview payload; do **not** spin a second active row (one narrative, simpler resume, quota stays one attempt context). `**abandoned` (explicit)**: user navigates back to **PathChoice** and picks a non-AI path — **v1 default:** that is sufficient (no separate Cancel button); add one later only if analytics show accidental drop-off. `**abandoned` (implicit)**: user reaches a program created state without committing via this thread (e.g. other tab, template path) — on next load or guard check, mark the stray active thread abandoned so quota and UI don’t reference dead state. `**abandoned` (staleness)**: **v1 default:** yes, **lazy and server-side only** — on the next Edge handler that loads/processes the thread, if `updated_at` is older than **7 days**, set `abandoned`; no cron and no reliance on the PWA.

**Onboarding program commit gate**:
The **Embedded Agent** may propose a program (via `**create_program`** with `dry_run: true` preview); `**dry_run: false**` runs **only** after an **explicit user confirmation** in the PWA. **Agent proposes, user decides** — always for v1; no model-only auto-commit.

**Embedded Agent error handling (v1)**:
**User-facing:** friendly copy and a clear recovery path (e.g. retry / **Preview reject / regenerate**), **not** raw MCP or validation dumps. **Observability:** structured **server-side** logs and/or **Sentry** (see `file:src/lib/sentry.ts`, Edge `console`/provider of choice) plus existing **analytics** where useful — capture **technical insight** (error kind, tool name, request/thread id, sanitized payload excerpts, stack) under the app’s **privacy** rules so engineers can debug without shipping that detail to the user UI. **Failed `dry_run` / preview path:** **v1 default:** prioritize **regenerate / retry**; surface escape to **Template** or **Blank** **only** after **repeated failure** (e.g. **two** consecutive failures) — avoids training instant bail-out while avoiding a dead-end trap.

**Program draft step**:
Server-side generation that reuses the same catalog + model + validation stack as `**generate-program`** and returns a draft program shape (days + exercise prescriptions) **without** database writes. The **only** program write remains the MCP tool `**create_program`**: `dry_run: true` for preview, then `dry_run: false` to persist (after the **Onboarding program commit gate**). This hybrid avoids a second write tool and avoids expecting the chat model to assemble a full week using only `**search_exercises`** / `**resolve_exercises**`. **V1 prompt shape:** a **small, server-owned system prompt** (safety, catalog norms, GymLogic conventions) plus **user context** = structured **Onboarding form** profile + **Embedded Agent** thread transcript — the chat model is not relied on to restate hard constraints. **Locale (reply language):** every chat / draft **Edge** request carries `**locale: en | fr`** (from `**localeAtom` / `i18n**`); the **system prompt** instructs the provider (e.g. Gemini) to reply in that language for assistant turns and structured fields — no second locale subsystem. If the user changes language mid-thread, subsequent requests send the new `locale`. **V1 inputs:** profile + thread — for brand-new users that is the main signal before GymLogic training history exists. **V1 draft triggers (whichever comes first):** **(A)** the assistant returns a machine-readable “ready for program draft” signal (e.g. JSON field or tool/function output) that Edge parses and validates — not informal prose alone; **(B)** user message count reaches `**N`** — `**N = 6` is a v1 heuristic**, not validated by research; tune post-launch from analytics/cost; **(C)** the user taps Generate my plan. (B) and (C) are backstops so the user never waits indefinitely if (A) never fires. Not on every message. Re-run only on Preview reject / regenerate in the same thread. Current scope: invoked only from the Embedded Agent; External MCP Client flow unchanged.
→ `file:supabase/functions/generate-program/index.ts`, `file:supabase/functions/mcp/tools/createProgram.ts`

**Embedded Agent streaming (follow-up)**:
V1 ships without token streaming (no SSE). To keep streaming additive later, do **not** persist partial assistant chunks in `embedded_agent_threads`. Persist the assistant message only once a response is **final**, while partial text lives client-side during rendering. Quota/logging remains per billable provider call.