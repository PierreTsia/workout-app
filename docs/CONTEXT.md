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

**MCP Circuit Item**:
Third variant in a day's MCP `exercises[]` array (alongside bare UUID and solo prescription object), discriminated by `type: "circuit"`. Expresses an **Exercise Block** on the wire using user-facing "Circuit" vocabulary: rounds, block-level rest/transition, and nested exercises with native `{ amount, weight_kg }` or optional `per_round`. Mapped to `exercise_blocks` / `block_exercises` at persistence; never exposes the internal "block" term to agents or users. Decided for #452.
→ `file:supabase/functions/mcp/tools/createProgram.ts`, ADR `file:docs/adr/0011-mcp-circuit-items-in-exercises-array.md`

---

## AI providers

**AI Provider Fallback**:
The policy that every in-app AI call (the **Embedded Agent** chat, the **Program draft step** / `generate-program`, and **Quick Workout AI (v1)** / `generate-quick-workout`) is served by a **Primary Provider** and, on an **availability failure only**, retried once on a **Fallback Provider** before the user sees an error. **Purpose:** survive **Primary Provider** outages (the recurring Gemini `503` "high demand" we hit in prod — see #405), **not** to pick a "better" model — that is a separate quality concern. **Invariants:** **(1) Availability-only** — falls back on provider-unavailable / upstream-5xx / timeout; **never** on a 4xx config error (our bug, must surface) nor on a 2xx-but-empty response. **(2) Branding** — which provider answered is **infrastructure**: it may appear in server logs / **Sentry** but **never** in the wire response or UI (consistent with **Embedded Agent onboarding product (v1)** rule 1). **(3) Quota** — a fallback-served call counts as exactly **one** in-app AI usage in the same **fairness / quota family**, provider-agnostic; the billable log fires once per logical action regardless of how many providers were tried. **(4) Structured-output parity** — for the two JSON flows, the **Fallback Provider** must return the same shape as the **Primary Provider**; the existing provider-agnostic validators (`validateProgram`, `validateAndRepair`) stay as the safety net. Concrete trigger ordering, time budgets, and provider/model selection are owned by the #405 Tech Plan / ADR, not this glossary.

**Primary Provider**:
The default model provider for in-app AI calls — **Gemini** (`gemini-2.5-flash`) in v1. Tried first on every call; on an availability failure the **AI Provider Fallback** policy routes to the **Fallback Provider**.
→ `file:supabase/functions/embedded-agent/chatModel.ts`, `file:supabase/functions/_shared/programGemini.ts`, `file:supabase/functions/generate-quick-workout/gemini.ts`

**Fallback Provider**:
The secondary provider engaged by **AI Provider Fallback** when the **Primary Provider** is unavailable — **Groq** (OpenAI-compatible, no-card free tier, decorrelated from Google's infrastructure) in v1. Decorrelation — not a higher per-provider SLA — is the point: it is rare for both to be down at the same instant. A future second fallback (OpenRouter, Cerebras…) is out of v1 scope.

---

## Programs & agent flows

**Onboarding form**:
The structured onboarding questionnaire in the PWA. **V1:** keep it — do not replace it with chat-only; drop-off and losing hard constraints (equipment, frequency, etc.) is too risky. The **Embedded Agent** chat is **additive** (qualitative follow-up: injuries, vague goals, nuance), then the **Program draft step** + **`create_program`** path.
→ `file:src/pages/OnboardingPage.tsx`

**Embedded Agent onboarding (v1)**:
The **Onboarding program creation flow** (first program, no prior history) runs the **Embedded Agent** **only** after **PathChoice** when the user picks the **AI program** path. **Template** and **Blank** paths **do not** include the chat — keep scope tight. **Naming note:** historically the term collapsed channel (**Embedded Agent**) and flow (onboarding's program creation) into one label; a sibling flow now exists — see **Additional program creation flow** — sharing the same channel, not the same product purpose.
→ `file:src/pages/OnboardingPage.tsx`

**Embedded Agent onboarding product (v1)**:
Product rules not delegated to engineering defaults: **(1) Branding** — GymLogic-native copy only; do **not** surface external model or assistant **brand names** in UI (provider is infrastructure). **(2) Reach** — **online-only**; chat, **Program draft step**, and MCP require network; no offline **Embedded Agent** in v1. **(3) Content scope** — chat is for **qualitative** gaps (injuries, nuance, goals), not a duplicate **Onboarding form**; do not systematically re-ask structured fields already collected unless the user corrects themselves. **(4) Economics** — **Embedded Agent** consumption counts as **in-app AI usage** in the **same fairness / quota family** as existing AI program generation (exact caps in implementation; no separate “unlimited” lane without an explicit product change).

**Embedded Agent quota**:
Server-side limits on **Embedded Agent** LLM usage (e.g. messages per time window, one active draft thread) enforced in **Edge Functions** using **trusted** state — **not** client-enforced. Required when the inference key is GymLogic-hosted (cost/abuse). **V1:** enforce using the **Embedded Agent thread** table (counts / status per row); optional extra **`ai_generation_log`** rows per turn if we want parity with other AI features — **ships with the Embedded Agent**, not deferred.

**Embedded Agent thread**:
**V1 decision:** persist **Embedded Agent** chat in a **Postgres table** (`embedded_agent_threads`): at minimum **`id`** (uuid PK), **`user_id`** (FK to auth user), **`status`** (`open` | `preview_ready` | `committed` | `abandoned`), **`messages`** (JSONB transcript), **`created_at`**, **`updated_at`**, optional **`locale`** (`en`|`fr`) echo of app locale at thread open, optional **`last_preview`** (JSONB or reference) for **`create_program`** `dry_run` payload, optional **`program_id`** after **committed**, optional **`committed_at`**, **`abandoned_at`**. **Multi-flow extensions (#343):** **`purpose`** (TEXT + CHECK, `'onboarding' | 'additional_program'`, default `'onboarding'`, NOT NULL — distinguishes which flow owns the thread; see **Embedded Agent onboarding (v1)** vs **Additional program creation flow**), **`change_motivation`** (TEXT + CHECK, nullable — controlled vocab from **Change motivation (Additional program creation)**, only relevant when `purpose = 'additional_program'`), **`bundle_context`** (JSONB, nullable — captured-at-thread-open pre-loaded snapshot for **Additional program creation flow**; see ADR 0003). **RLS** so only the owning user can read/write. **Partial unique index** keyed on **`(user_id, purpose)`** where `status` ∈ (`open`, `preview_ready`) — relaxed from the original `(user_id)`-only constraint so a user can simultaneously have one open thread per flow. Staleness checks run **server-side** on thread load / chat Edge calls — not PWA-only. **Source of truth** for transcript, resume/multi-tab, and **Embedded Agent quota** — see **Embedded Agent thread lifecycle**.

**Embedded Agent thread retention**:
**Tension:** long retention helps a future **continue coaching** experience, but **Embedded Agent** messages can hold health-ish **PII**. **V1 default:** do **not** assume “forever full transcript” for onboarding threads. **Keep** the thread row and **non-sensitive metadata** (e.g. `status`, `committed_at`, `program_id` link, quota-relevant counts) as long as product/analytics need; **truncate or delete `messages` JSONB** after **90 days** post-**`committed`** or **`abandoned`** (**v1**), unless/until the user **explicitly opts in** to extended coaching memory (separate epic — distinct consent and possibly a **new** thread type). **Rationale:** preserves funnel metrics and program linkage without an open-ended liability on raw chat. **Account deletion:** **hard-delete** **Embedded Agent** thread rows (and messages) **immediately** — retention windows do not delay erasure when the user deletes their account.

**Embedded Agent thread lifecycle**:
**Resume:** entering a flow that uses the **Embedded Agent** (today: **Embedded Agent onboarding (v1)** or **Additional program creation flow**) loads the user's single active row (`open` or `preview_ready`) **for that `purpose`** if present; otherwise insert a new row keyed on `(user_id, purpose)`. A user can simultaneously have one active onboarding thread and one active additional-program thread — they don't compete for the partial unique index. **`committed`**: set after **`create_program`** with `dry_run: false` succeeds (post **Onboarding program commit gate**). **Preview reject / regenerate:** **v1 default:** keep the **same** **Embedded Agent thread** — append turns and clear or supersede the stale preview payload; do **not** spin a second active row (one narrative, simpler resume, quota stays one attempt context). **`abandoned` (explicit)**: user navigates back to **PathChoice** and picks a non-AI path — **v1 default:** that is sufficient (no separate Cancel button); add one later only if analytics show accidental drop-off. **`abandoned` (implicit)**: user reaches a program created state without committing via this thread (e.g. other tab, template path) — on next load or guard check, mark the stray active thread abandoned so quota and UI don’t reference dead state. **`abandoned` (staleness)**: **v1 default:** yes, **lazy and server-side only** — on the next Edge handler that loads/processes the thread, if `updated_at` is older than **7 days**, set `abandoned`; no cron and no reliance on the PWA.

**Onboarding program commit gate**:
The **Embedded Agent** may propose a program (via **`create_program`** with `dry_run: true` preview); **`dry_run: false`** runs **only** after an **explicit user confirmation** in the PWA. **Agent proposes, user decides** — always for v1; no model-only auto-commit.

**Embedded Agent error handling (v1)**:
**User-facing:** friendly copy and a clear recovery path (e.g. retry / **Preview reject / regenerate**), **not** raw MCP or validation dumps. **Observability:** structured **server-side** logs and/or **Sentry** (see `file:src/lib/sentry.ts`, Edge `console`/provider of choice) plus existing **analytics** where useful — capture **technical insight** (error kind, tool name, request/thread id, sanitized payload excerpts, stack) under the app’s **privacy** rules so engineers can debug without shipping that detail to the user UI. **Failed `dry_run` / preview path:** **v1 default:** prioritize **regenerate / retry**; surface escape to **Template** or **Blank** **only** after **repeated failure** (e.g. **two** consecutive failures) — avoids training instant bail-out while avoiding a dead-end trap.

**Program draft step**:
Server-side generation that reuses the same catalog + model + validation stack as **`generate-program`** and returns a draft program shape (days + exercise prescriptions) **without** database writes. The **only** program write remains the MCP tool **`create_program`**: `dry_run: true` for preview, then `dry_run: false` to persist (after the **Onboarding program commit gate**). This hybrid avoids a second write tool and avoids expecting the chat model to assemble a full week using only **`search_exercises`** / **`resolve_exercises`**. **V1 prompt shape:** a **small, server-owned system prompt** (safety, catalog norms, GymLogic conventions) plus **user context** = structured **Onboarding form** profile + **Embedded Agent** thread transcript — the chat model is not relied on to restate hard constraints. **Locale (reply language):** every chat / draft **Edge** request carries **`locale: en | fr`** (from **`localeAtom`** / **`i18n`**); the **system prompt** instructs the provider (e.g. Gemini) to reply in that language for assistant turns and structured fields — no second locale subsystem. If the user changes language mid-thread, subsequent requests send the new `locale`. **V1 inputs:** profile + thread — for brand-new users that is the main signal before GymLogic training history exists. **V1 draft triggers (whichever comes first):** **(A)** the assistant returns a machine-readable “ready for program draft” signal (e.g. JSON field or tool/function output) that Edge parses and validates — not informal prose alone; **(B)** user message count reaches **`N`** — **`N = 6`** is a v1 heuristic, not validated by research; tune post-launch from analytics/cost; **(C)** the user taps Generate my plan. (B) and (C) are backstops so the user never waits indefinitely if (A) never fires. Not on every message. Re-run only on Preview reject / regenerate in the same thread. Current scope: invoked only from the Embedded Agent; External MCP Client flow unchanged.
→ `file:supabase/functions/generate-program/index.ts`, `file:supabase/functions/mcp/tools/createProgram.ts`

**Additional program creation flow**:
The post-onboarding AI program creation surface at `/library/programs/create` (path "AI"), triggered when a user with an existing profile (and usually an active **Program** + workout history) wants a new program. Uses the **Embedded Agent** channel but is a **distinct product flow** from **Embedded Agent onboarding (v1)** — different inputs (profile + history vs profile only), different agent job, distinct `purpose` value on **Embedded Agent thread**. **Shape (ADR 0003):** pure chat (no constraints form — `AIConstraintStep` is removed from this branch of the wizard); **pre-loaded context bundle** captured once at thread open (profile + active program summary + 4-week training stats) and stored in **`embedded_agent_threads.bundle_context`**; **no in-conversation MCP tool calls** in v1; **hard motivation gate** — the agent must elicit and classify a **Change motivation (Additional program creation)** before emitting the ready-for-draft signal, which carries the `motivation` field in its JSON payload. Same **`create_program`** commit gate (`dry_run: true` → user confirms → `dry_run: false`). The MCP tool already deactivates any other active program atomically — no separate active-program-switch tool needed. Replaces the legacy closed-loop `useAIGenerateProgram` + `AIProgramPreviewStep` raw inserts; `file:supabase/functions/generate-program/` deletion is sequenced with **Quick Workout AI (v1)** (#342). **Out of scope:** modifying the existing active program (this flow always creates a *new* program).
→ `file:src/pages/CreateProgramPage.tsx`

**Change motivation (Additional program creation)**:
Controlled vocabulary captured per **Embedded Agent thread** in the **Additional program creation flow**, persisted in `embedded_agent_threads.change_motivation`. **Values:** `variety | plateau | injury | priority_shift | equipment_change | return_from_break | other`. **Gate:** the agent's system prompt requires eliciting and classifying one of these values *before* it may emit `READY_FOR_PROGRAM_DRAFT` (see ADR 0003); the **`other`** fallback exists so users who genuinely have no specific reason aren't blocked. **Capture mechanism:** included in the ready-signal JSON payload (`{"ready":true,"summary":"...","motivation":"plateau"}`), not a separate side-channel — single signal at the drafting moment. **Persisted on commit**, also surfaced as a payload field on the **new** `embedded_agent_preview_committed` analytics event introduced by #343 (symmetric with the existing `embedded_agent_preview_rejected`) so funnel queries can compare commit rates by motivation. Onboarding threads never set this (NULL).

**Embedded Agent streaming (follow-up)**:
V1 ships without token streaming (no SSE). To keep streaming additive later, do **not** persist partial assistant chunks in `embedded_agent_threads`. Persist the assistant message only once a response is **final**, while partial text lives client-side during rendering. Quota/logging remains per billable provider call.

---

## Quick Workout

**AI Focus Areas**:
Optional free-text hint field on the **Quick Workout AI** flow's constraints step — a one-shot textarea where the user types qualitative nuance ("avoid jumps, sore knee", "push day, hit triceps") that the structured pills (duration / equipment / muscles) can't capture. Capped at `AI_FOCUS_AREAS_MAX_LENGTH`; trimmed via `trimFocusAreas`; sent to the Quick Workout AI generator as `focusAreas`. **Not** a chat: no model echo, no clarification turns, single submit.
→ `file:src/components/generator/ConstraintStep.tsx`, `file:src/lib/aiFocusAreas.ts`

**Quick Workout AI (v1)**:
The **Embedded Agent**-backed AI generation path triggered from `QuickWorkoutSheet`'s **AI generate** button. **V1 decision: one-shot, no chat surface** — the user fills the constraints step (duration, equipment, muscle groups, **AI Focus Areas**) and hits submit; the Edge Function calls the LLM once, returns `{ exerciseIds, rationale }`, and the existing `PreviewStep` renders the result. Chat-style clarification is **explicitly out of scope for v1** — Quick Workout's product promise is daily speed; the bidirectional UX tax of a chat doesn't pay rent here. If post-launch analytics show a high regenerate rate or that **AI Focus Areas** is being misused (users typing "I'm injured" expecting a back-and-forth), revisit with a separate feature ticket. Distinct from **Embedded Agent onboarding (v1)** which is multi-turn by design.

**`create_workout_day` MCP tool**:
**V1** new MCP write tool that persists a single ad-hoc training session for the caller — one `workout_days` row with `program_id: null`, plus its `workout_exercises`. Reuses **`create_program`**'s `exercises[]` shape (UUID-or-prescription-object) and shared validator so the LLM contract stays consistent across both write tools; reuses the `dry_run: true → review → dry_run: false` pattern. **Annotations:** `destructiveHint: false` (insert-only, doesn't deactivate or replace anything), `idempotentHint: false`. **Surface scope:** exposed to **External MCP Clients** (legitimate use: *"Claude, schedule me a 30-min push session for tomorrow"*). **`save_as_draft` is intentionally NOT in the MCP surface** — drafts are an in-app convenience, not a third-party-host concern; the in-app draft path stays out of band. Unblocks deletion of `file:supabase/functions/generate-workout/` once the new Edge Function ships.

**`quick_workout` quota source**:
**V1** new value in `AIGenerationSource` (`file:supabase/functions/_shared/aiQuota.ts`), fired by the new **Quick Workout AI (v1)** Edge Function on each LLM call. Named `quick_workout` (not `embedded_workout`) because the **Quick Workout AI (v1)** flow is a one-shot — the `embedded_*` prefix is reserved for chat-shaped flows (`embedded_chat`, `embedded_draft`); a single-call AI generator does not belong in that family. Independent counter from `program` / `embedded_chat` / `embedded_draft` / legacy `workout` — Quick Workout's daily cadence must not compete with onboarding's once-per-user budget, and the legacy `workout` source dies with `generate-workout`. **Cap (v1):** **10/30days regular** (bumped from legacy `workout`'s 5/30 — Quick Workout AI is now positioned as a daily generator, not a nice-to-have, so 5/30 saturated too fast), **5/24h whitelisted** (unchanged). Implementation requires per-source caps in `file:supabase/functions/_shared/aiQuota.ts` (today's `QUOTA_REGULAR = 5` is shared across sources). Revisit with analytics post-launch. **External MCP clients calling `create_workout_day` directly do not burn this quota** (they pay their own LLM tokens).

**`generate-quick-workout` + `commit-quick-workout` Edge Functions**:
**V1** new Supabase Edge surface that backs **Quick Workout AI (v1)**, split into **two separate functions** (locked decision — see **ADR 0002 §3**). **Two-phase, Embedded-Agent-shaped** (see **Embedded Agent**) because `PreviewStep` allows the user to edit the AI's suggestion before committing — mirrors the **Onboarding program commit gate** pattern. **`generate-quick-workout` (preview, idempotent):** runs quota check (**`quick_workout`**), catalog/profile/history fetch, one-shot Gemini call with workout-specific prompt, validate-and-repair, returns `{ exercises[], rationale }` — **no database write**. **`commit-quick-workout` (commit, mutator):** accepts the post-edit `{ label, exercises[] }` payload, calls **MCP `create_workout_day`** server → MCP via **MCP Edge Function URL** with the user's session JWT as Bearer (auth dualism — PATs vs session JWTs — already supported by `file:supabase/functions/mcp/lib/authLogic.ts:80-82`, no new auth surface), `dry_run: false`. Returns `{ workout_day_id }`. No quota burn on commit (the LLM call already paid). **Why two functions, not one with modes:** preview and commit have different semantics (idempotent vs mutator), different observability shapes, different retry policies — splitting keeps each focused. Replaces `file:supabase/functions/generate-workout/` (deleted as part of this migration). **AI Save-as-draft does not flow through these functions** — drafts stay PWA-local via `useCreateQuickWorkout`.

---

## Programs & cycles

**Program**:
The live training plan the user owns: a named set of **workout days**, each a **Unified Day Sequence** of **Exercise Slots** (and optional **Exercise Blocks**) carrying a **Template Prescription**. Distinct from a **ProgramTemplate** (catalog recipe used at creation) and from a **Cycle** (one pass through the days). The row itself is identity-thin: name, `template_id`, active / archived, `created_at` — no goal, level, or location. Those live on **UserProfile** / **ProgramTemplate**, not on the **Program**.
→ `file:src/types/onboarding.ts`

**Program Page**:
First-class identity route `/programs/:id`. Shows the week as written and the program's raison d'être: **Goal Tracks**, **Program Balance**, **Program Facts**, **Program Score Rubric**. Replaces `ProgramDetailSheet` — the sheet is **removed**, not kept as a peek. Card tap on **Library Programs** goes here. A day row is read-only on this page (the week as written). **Edit** goes to the existing **Builder** (`/builder/:programId`) — no Hevy-floor chrome and no live score banner in v1. No « Commencer » here; launching a **Session** stays on Home. Activate / archive live on the card and on this page. Character sheet is *equal* — no pin, gold, or filter on `profile.goal`.
→ `file:src/pages/ProgramPage.tsx`

**Program Identity v1**:
The first shippable slice: **Program** scoring + **Library Programs** cards + **Program Page** ([#504](https://github.com/PierreTsia/workout-app/issues/504)). Out: live-while-editing banner ([#519](https://github.com/PierreTsia/workout-app/issues/519)); **Builder** restyle / body map / insight ([#503](https://github.com/PierreTsia/workout-app/issues/503)); clone / import / export. Edit is an exit to today's Builder, not a new authoring surface.
→ `file:src/pages/BuilderPage.tsx`

**Goal Track**:
A published scoring axis of the **Program** as written (days + **Template Prescription**), not of last month's **Sessions**. Catalog v1: `hypertrophy` | `strength` | `endurance` — three tracks, not four. Same words as `UserGoal` minus `general_fitness` (a residual, not a score). Weight loss is not a track — it is a caloric deficit, not a reading of the iron. Display is a **published band** (`short` / `ok` / `high`) plus the facts that produced it — not a 0–100. Distinct from **Équilibre** and from **Program Balance**.
→ `file:src/types/onboarding.ts`

**Circuit in Program Scores**:
Same math for **AMRAP** and **Tours**. A **Circuit** is a unit; stations are muscle identities, not sets. **Program Facts**: count (label the mode), never fold into the solo set integer. **Endurance**: +1 per **Circuit** — mode is prose, not extra weight (an AMRAP does not score higher than 3 Tours). **Hypertrophy** volume and **strength**: 0. **Hypertrophy** frequency: a station hitting a muscle that day is one hit. **Program Balance**: presence 1 / 0.5 once per station per **Circuit** on the full 13-axis vector (zeros kept). Do not explode `rounds ×` stations; an AMRAP has no N.
→ `file:src/types/database.ts`

**Hypertrophy (Goal Track)**:
Grades only muscles that appear in the week: ≥1 solo set (primary 1 / secondary 0.5) or a **Circuit** station frequency hit. Volume band 8–20 weekly sets; frequency band 2–3 distinct days. Track rollup = share of *those* muscles in **both** bands: `short` < ⅓, `ok` ⅓–⅔, `high` ≥ ⅔ (draft). Zeros on `MUSCLE_TAXONOMY` are **Program Balance**, not a hypertrophy fail.
→ `file:src/lib/trainingBalance.ts`

**Strength (Goal Track)**:
Share of solo sets that are strength-shaped: `rep_range_max` (or parsed `reps`) ≤ 6 and `rest_seconds` ≥ 150. No compound gate. **Circuits** add no volume. Bands (draft): `short` < 20 %, `ok` 20–40 %, `high` ≥ 40 %. A week with no such sets is `short`, not an error.
→ `file:src/types/database.ts`

**Endurance (Goal Track)**:
**Circuit** count is the primary input. A solo set is dense if reps ≥ 12 (or duration exercise) and `rest_seconds` ≤ 60. Bands (draft): `short` = 0 Circuit and < 20 % dense sets; `ok` = 1 Circuit or ≥ 20 % dense; `high` = ≥ 2 Circuits, or 1 Circuit and ≥ 20 % dense.
→ `file:src/types/database.ts`

**Program Balance**:
A first-class score of the **Program** as written: `computeBalanceScore` on the 13-axis intended vector (zeros kept). Solo sets credit primary 1 / secondary 0.5. Each **Circuit** station adds a *presence* credit (1 / 0.5) once per block — same for **AMRAP** and **Tours**, never `rounds ×`. A Cindy-only week scores **low**, not empty and not "excellent". Same formula as **Équilibre**, different grain (intent vs executed **Sessions**). Fourth number on the **Program Page**, not a **Goal Track**. The only 0–100 on the character sheet. UI: EN **Balance** / FR **Répartition** — never **Équilibre** (that's executed volume on Profil).
→ `file:src/lib/trainingBalance.ts`

**Program Facts**:
Deterministic readouts of the **Program** as written — no rubric, not stored columns. V1: day count; solo set count (`Σ workout_exercises.sets` on **Exercise Slots** only); **Circuit** count (first-class units, mode labeled, never folded into the set integer); equipment *mix* in four buckets — free weights (`barbell`, `dumbbell`, `ez_bar`, `kettlebell`), machines (`machine`, `cable`), bodyweight, other (`band`, `bench`, `other`). Mix grain matches **Program Balance**: solo sets + one presence per **Circuit** station. No estimated clock. Not a « salle » tag.
→ `file:src/lib/catalogTaxonomy.ts`

**Program Score Rubric**:
The published house rules behind **Goal Tracks** and **Program Balance**. In-app and pedagogical — a beginner can read *why* a band is `short` / `ok` / `high`. Thresholds are a product claim we will defend (cite or admit house), not a hidden heuristic. The **Program Page** is the defense surface; `docs/` / an ADR back it. Empty ≠ `short`: 0 days / 0 items → no scores (not a fail). Circuit-only week → **endurance** and **Program Balance** may show; hypertrophy volume / **strength** stay empty (no solo sets); hypertrophy frequency may still hit. A 1-day solo week may legitimately band hypertrophy `short` on frequency.
→ `file:docs/CONTEXT.md`

**Program Score Copy**:
User-facing FR/EN for **Goal Tracks**, **Program Balance**, **Program Facts**, and the **Program Score Rubric**. Density: one rule-sentence always visible on the **Program Page**; worked example on tap; **Library Programs** card = 4 compact scores + one fact line (`Nj · N séries · N circuits`) — equipment mix stays on the **Program Page**. Live Builder banner is out of **Program Identity v1**. A dedicated copy pass is in-epic (HITL) — do not ship glossary voice. Forbidden in UI: **Exercise Slot**, **Template Prescription**, **Goal Track**, `CV`, `log1p`, `MUSCLE_TAXONOMY`, `rep_range_max`, internal file paths. Speak like a coach to a beginner (muscles, séries, jours, repos), not like the schema.
→ `file:src/locales/`

**Cycle**:
One pass through every day of a **Program**. The open **Cycle** is the `cycles` row with `finished_at` null; a **workout day** is done in that **Cycle** when a finished **Session** for that day carries this `cycle_id`. Distinct from a **Session** (one execution) and from the **Program** (the live template).
→ `file:src/hooks/useCycle.ts`

---

## Workout execution

**Session time** (UI: FR **Temps de séance** / EN **Session time**):
Sum of `sessions.active_duration_ms` over finished **Sessions** in the current Profil window (7j / 30j / 100j / 1 an / depuis toujours). When `active_duration_ms` is null, fall back to wall-clock `(finished_at − started_at)` — same rule as `get_cycle_stats`. Pause-excluded when the finish path wrote the column. **Not** `get_training_activity_by_day.minutes`, which is always wall-clock including pauses; the Profil pulse must not bind that field. The UI used to say “time under the bar”; the metric did not change. All-time has no vs-préc. delta.
→ `file:supabase/migrations/20260324140000_sessions_active_duration_ms.sql`, `file:supabase/migrations/20260802170000_secure_definer_rpcs.sql`

**RIR 0 rate** (UI: **% RIR 0**):
Share of **declared** sets taken to **muscular failure** — the athlete explicitly tapped `rir = 0` in the drawer (not the default 2, not a missing value). Job on the Records combo: how often you went to failure, next to PR bars. Denominator is `set_logs.rir IS NOT NULL` only (duration sets and pre-RIR logs out). Null is **not** imputed as 2. A bucket with no declared RIR has **no point** (not `0 %`). Not mean RIR, not a count of failure sets (that would rise with volume).
→ `file:src/components/workout/RirDrawer.tsx`

**Tonnage** (UI: FR / EN **Tonnage**):
Iron that moved in a sliding window: `Σ weight_logged × numeric reps` on finished **Session** sets where `weight_logged > 0` and `duration_seconds` is null. **Exercise Block** / **Circuit** sets count when they carry load (a deadlift station is still iron). Bodyweight at 0 kg and duration holds are out — Cindy is 0 t because nothing was loaded, not because it is a Circuit. Do not filter on `block_exercise_id` or `equipment`. Do not `SUM` the 13 **Équilibre** axes (secondary muscles are 0.5-credited). Same grain as Mix / Rythme; delta vs the equal prior window except **depuis toujours** (no vs-préc.).
→ `file:supabase/migrations/20260802170000_secure_definer_rpcs.sql`

**Mix slice**:
Exclusive label of a finished **Session** on the Profil stacked Mix (one session, one stack). Bar height is the session count in that grain bucket, not a 100% share. Precedence: **(1) Circuits** if that session's **workout day** has an **Exercise Block** with `benchmark_circuit_id` not null (**Benchmark Circuit**, including a programmed Athena / Cindy day); **(2)** else **Quick Workout** if `workout_days.program_id` is null; **(3)** else **Programme**. Jetable Circuits (`benchmark_circuit_id` null) never take slice (1) — they fall through to QW or Programme. Same grain as Rythme. Overlay / double-count is out.
→ `file:docs/Vision_—_Profil_dashboard.md`

**Regulars** (UI: FR **Récurrents** / EN **Regulars**):
The movements you actually repeat **in the current Profil window** (7j / 30j / 100j / 1 an / Toujours) — the toggle applies, same as Mix. Rank = total numeric reps in that window (duration-only last); tie-break `max(logged_at)`. Top ~8. An exercise needs ≥2 distinct finished **Sessions** in the window to appear (once is not a habit). **Circuit** station logs count (Cindy pull-ups can be a Regular). No Program pin — `Sur le programme` / `Hors plan` are out of the fold. Not a fixed 100d habit list.
→ `file:docs/Vision_—_Profil_dashboard.md`

**Profil tenure** (UI: FR **Actif depuis {{span}}** / EN **Active since {{span}}**):
Human duration since the first finished **Session** (`MIN(sessions.started_at)`), falling back to `profiles.created_at` when there are none. Days / months / years-and-a-half (`file:src/lib/profile/tenure.ts`). This is the Profil Hero caption. Not a **Training streak**. Not `consistency_streak`.
→ `file:src/lib/profile/tenure.ts`

**Training streak** (UI: FR **Série · {n} j** / EN **Streak · {n} d**):
Live chain of local calendar days with ≥1 finished **Session**. Grace: the chain may end **yesterday** (same idea as `hundred_a_day`). Not on the Profil Hero — Hero shows **Profil tenure**. Not the `consistency_streak` badge (lifetime `session_count`). Not **Streak King**. `0` is a real value, not an empty state.
→ `file:src/hooks/useTrainingActivityByDay.ts`

**Hero hop line** (UI: FR **Aussi {other} cette semaine** / EN **Also {other} this week**):
Shown only when ≥2 distinct `workout_days.program_id` (non-null) produced a finished **Session** in the **current Profil window** (7j / 30j / 100j / 1 an / depuis toujours), not a calendar ISO week when the toggle is 100d. **Quick Workout** (`program_id` null) does not count as a hop. One **Program** + QW / Circuits → no line.
→ `file:docs/Vision_—_Profil_dashboard.md`

**Profil not-enough-data**:
Per-graph floor below which Profil shows an empty / not-enough-data state, not a fake series. Distinct from loading and from an honest zero (e.g. **Rythme** all-empty days). Floors: pulse stats ≥1 finished **Session** in the window (else the whole strip); Mix ≥1 session; Records combo **line** ≥2 buckets with a declared **RIR 0 rate** (bars may render from 1); Équilibre score + radar ≥3 sessions (`hasEnoughBalanceData`); **Tonnage** ≥1 loaded set (`weight_logged > 0`); **Regulars** an exercise needs ≥2 distinct sessions **in the current window** to appear; Circuits sparkline ≥2 runs, **best** score + run count from 1. Rythme has no floor — empty rings *are* the story.
→ `file:src/lib/volumeByMuscleGroup.ts`

**Profil PR**:
Unit on the Records block: a distinct `(session_id, exercise_id)` pair that has ≥1 `set_logs.was_pr` in the window, including duration PRs. Not a set count. Not `get_cycle_stats` (that COUNT drops `duration_seconds IS NOT NULL`). **Circuit** stations use the same `was_pr` / `prDetection` as solos (`file:src/lib/blockSetLog.ts` — T226 done). A loaded deadlift in a Circuit shares the solo PR stream. Historical rows need `scripts/backfill-was-pr.ts` before T236; new finishes are already correct. **Circuit** score PBs (AMRAP / Tours) stay in the Circuits block. Not a second PR type.
→ `file:src/lib/prDetection.ts`

**Profil Circuit PB**:
A finished **Benchmark Circuit** run in the current window whose type-aware score (AMRAP = max rounds then leftover; Tours = min completion time) beats **all** prior complete runs of the same `template_fingerprint` (career), not the last-8 History slice. `annotateAmrapRuns.isPb` on `RUN_LIMIT 8` is the wrong function. The first complete run is not a PB (nothing to beat). The Circuits **PBs** stat is the count of such runs in the window. The row **score** is the best run **in the window** (may or may not be a PB). The row **run count** is complete catalog runs of that fingerprint in the window. Sparklines stay last-8 chronological. Jetable Circuits stay in History.
→ `file:src/lib/amrapScore.ts`

**Prescribed session duration**:
`users.session_duration_minutes` from the onboarding / Account questionnaire — the minutes the athlete told the app a session should last. Profil pulse **Durée moy.** is the mean **Session time** per finished **Session** in the window, compared to this field. Weak if stale; the stat links to the form that edits it (`/account` today, Settings later). Not a per-**workout day** template duration (that column does not exist).
→ `file:src/components/onboarding/QuestionnaireTrainingFields.tsx`

**Last Session Recap**:
Home-only surface for a **workout day** that is already done in the current **Cycle**: two tabs under the day card — **Dernière séance** (default) vs **Programme**. **Dernière séance** is the last finished **Session** on that day, grouped like history (a **Circuit** stays a **Circuit**, score **AMRAP** `4+0` / **Tours**; solos stay solos), plus a fact line when **Benchmark Circuit** / solo `exercise_id` identities differ from the live **Unified Day Sequence**. **Programme** is that sequence, read-only, no kg. Hidden when `set_logs` are empty. The hero card stays today's identity (sequence item count, body map) — not last-session duration or set count.
_Avoid_: Last Performance, preview, flattening a Circuit into `sets × reps`
→ `file:src/pages/WorkoutPage.tsx`

**Duration Set Timer**:
The in-session timer for duration-based exercises (planks, hollow holds, dead hangs) — distinct from the rest timer. Renders inside `SetsTable` as a two-cell unit (live MM:SS countdown + Play/Stop button). Fires audio + vibration at T=0 and auto-logs the set; the user does not tap a separate Log button. **Pre-existing limitation:** `elapsedSec` is **not pause-aware** (uses raw wall-clock vs **`useRestTimer`**'s `accumulatedPause`); resuming after a long pause insta-fires the alarm. Tracked separately from #374.
→ `file:src/components/workout/DurationSetTimer.tsx`

**Eyes-off Feedback**:
The product-level promise that during a held isometric (plank, hollow hold, etc.) the user never needs to look at the screen to know how the set is going. Three layers, in order of reliability: **(1)** screen wake lock via **`useKeepScreenAwake`** to keep the visual countdown legible without re-unlocking the phone (foreground only); **(2)** sequenced audio cues at T-3 / T-2 / T-1 (660 Hz / 150 ms `playWarningBeep`) and a finish chime at T-0 (`playFinishBeeps`, two-note 880 → 1100 Hz) for eyes-closed / looking-up moments; **(3)** a service-worker notification at T-0 (best-effort, mirrors **`useRestTimer`**'s pattern) for the backgrounded / phone-in-pocket case. Centralized through **`src/lib/audio.ts`** + **`useKeepScreenAwake`** (see ADR 0006). Currently scoped to **Duration Set Timer**; **`useRestTimer`**'s 10-second warning is a credible future caller.
→ `file:src/components/workout/DurationSetTimer.tsx`, `file:src/lib/audio.ts`, `file:src/hooks/useKeepScreenAwake.ts`

---

## Supersets & Circuits

**Exercise Block**:
A group of exercises trained **round-by-round** (supersets, trisets, circuits) — the unit of work is the **Round**, not the individual exercise. Introduced by #351 as the target-vision (Freeletics-style) model, deliberately rich from day one: per-round prescriptions, a block-level rest between rounds, and a **Transition** between exercises within a round. A block lives inside a **workout day** alongside solo `workout_exercises` (see **Unified Day Sequence**). **V1 decision (ADR 0007):** structure ships rich, but block exercises are **excluded from the progression engine** — frozen prescription, hand-edited in the **Builder**, no **Progression Suggestion** / **Prescription Snapshot** / **Progression Rule**. In-app Builder / Round Screen / history shipped; MCP + AI generation of Circuits is #452 (see **MCP Circuit Item**).
**Naming (ADR 0007 §Decision.5):** "Exercise Block" / "block" is the **internal** domain term — tables (`exercise_blocks`, `block_exercises`), types, hooks, and i18n **keys** (`blockRunner.*`, `createBlock`). It must **never** appear in UI copy. Every user-facing string (i18n **values**, labels, dialog titles, history cards) says **"Circuit"** (FR & EN). Code speaks "block"; humans speak "circuit".
→ ADR `file:docs/adr/0007-exercise-blocks-rich-structure-no-progression.md`

**Round**:
One pass through every exercise of an **Exercise Block** (A → B → C). The block's **unit of work**: an N-round block means doing A, B, C in sequence N times. The block-level rest is armed **between rounds** (after the last exercise of a round), never between A→B→C inside a round — that gap is the **Transition**. Distinct from a `set` on a flat `workout_exercise`, though a block round produces one `set_logs` row per exercise for history. Resolves issue #351 open-question 0: "1 round = pass through the exercises once", **not** "1 rep = pass through the exercises once" (the latter — dumbbell complex / tight EMOM — is a separate, out-of-scope primitive). Distinct from **Tours** / **AMRAP**, which are *termination modes* for a Circuit, not the unit of work.

**Tours** (mode, FR; EN: **Rounds**):
Circuit termination whose constraint is a fixed round count. You set N **Rounds**; the score is time (**Circuit Completion Time**). User-facing opposite of **AMRAP**. Internal `mode: "rounds"` (the v1 default — every Circuit shipped before this mode exists is **Tours**).

**AMRAP**:
Circuit termination whose constraint is a time cap and whose score is **Rounds** completed (+ leftover reps on the station in progress, written `27+3`). User-facing term in **FR and EN** — not translated, same loanword policy as **Circuit**. Internal `mode: "amrap"`.

**Never shown naked.** Every surface (Builder segmented control, `BlockCard`, pre-session, **Round Screen**, history, MCP `rendered` / details / history) pairs the word with the cap **and** a one-line gloss: FR *« Autant de tours que possible. »* / EN *« As many rounds as possible. »* Canonical badge: `AMRAP 20 min`, never `AMRAP` alone. The gloss is part of the term, not a tooltip you can skip.

Same rule for the score: `27+3` is never shown alone. Hero numeral plus a gloss naming the leftover movement — FR `27 tours · 3 pompes` / EN `27 rounds · 3 push-ups`. TIME, Terminer, history, and MCP all use that pair.

**WOD** (*Workout of the Day*):
Search / CrossFit colloquial for a *named* workout (Cindy, Fran, Zeus). **Not** a GymLogic type, and **not** a synonym of **AMRAP**. Some WODs terminate as **AMRAP**, some as **Tours**. In this codebase the catalog object is **Benchmark Circuit**.

**Block Run**:
One execution of an **AMRAP** Circuit in a **session**. Persisted row (`block_runs`) keyed by `(session_id, block_id)`: GO `started_at`, optional `finished_at` (TIME / Terminer), a **template fingerprint** snapshot (mode + cap + exercise amounts/weights), and — when the block is a **Benchmark Circuit** — `benchmark_circuit_id` snapshotted at GO so a later **Circuit Fork** of the day slot cannot rewrite past identity. Leftover is **not** stored here — it is the ragged last **Round** in `set_logs`. **Tours** Circuits do not write a **Block Run**; their time stays **Circuit Completion Time** (ADR 0008). Cindy and the Pantheon seeds share this AMRAP identity stamp.
→ `file:docs/adr/0014-amrap-mode-and-block-runs.md`

**Transition** (`transition_seconds`):
The block-level pause **between exercises inside a single Round** (e.g. 20s between burpees and lunges in a station circuit). `0` for a pure superset; 15-30s for a circuit with equipment changes. Distinct from the block's `rest_seconds`, which applies **between rounds**. Block-level scalar in v1 (not per-round, not per-exercise).

**Per-round Prescription**:
The prescription for a single (exercise × round) cell of an **Exercise Block**: shape `{ amount, weight }` where `amount` is reps or a duration. This is what enables pyramidal blocks (20 → 15 → 10) and charged pyramids (rising weight per round). **V1 decision:** reps/duration **and** weight vary per round; `rest_seconds` (between rounds) and **Transition** stay block-level scalars. The **Builder** edits these in a grid (rows = exercises, columns = rounds); a default "fill round 1, auto-propagate" UX is owned by the Tech Plan.

**Exercise Slot**:
A solo `workout_exercises` row in a **workout day** — the structural unit that carries a **Template Prescription**. Distinct from an **Exercise Block** cell (`block_exercises`): solos progress; block cells do not (ADR 0007). Post-#463, **Last Performance** for the progression engine is scoped to an **Exercise Slot** (matched with the catalog `exercise_id`, so a Builder swap onto the same row does not inherit the previous movement's logs). Seed weight when *adding* or *swapping* a catalog exercise into a day may still read the athlete's last catalog-global load — that is bootstrap for a new/changed slot, not session progression. **Quick Workout** / `create_workout_day` days mint new slots each time — progression does not accumulate across ad-hoc days (v1, #463).
→ `file:src/types/database.ts` (`WorkoutExercise`), ADR `file:docs/adr/0012-slot-scoped-last-performance.md`, issue #463

**Unified Day Sequence**:
The #351 model where a **workout day** is an ordered list of *items*, each item being **either** a solo **Exercise Slot** (`workout_exercise`) **or** an **Exercise Block** — freely interleaved and reordered together (e.g. heavy Squat solo → finisher Circuit block → Curl solo). Chosen over "separate blocks section" (rigid UX) and "everything is a block" (big-bang rewrite of builder/session/history/MCP/engine). Implies a `sort_order` shared across solos and blocks within a day.

**Round Screen**:
The dedicated in-session UI for traversing an **Exercise Block**: it renders the **current Round's** exercises stacked with **that round's** numbers, arms a **Transition** timer between exercises and the block's rest between rounds, then advances to the next round with its own **Per-round Prescription**. Chosen over reusing the auto-advancing single-exercise strip (`file:src/pages/WorkoutPage.tsx` → `ExerciseStrip` → `ExerciseDetail`), which has no natural place for per-round numbers under the pyramidal model.

**Circuit Completion Time**:
Wall-clock time to grind through one run of an **Exercise Block** in a session, **derived with no schema** (#396, decision A1) as `MAX(logged_at) − MIN(logged_at)` over that block's `set_logs` rows — works retroactively on all past circuits. **Pauses/rests are included by design** (mirrors Freeletics; never pause-adjusted, unlike **`useRestTimer`**'s `accumulatedPause`). A **stat, not an auto-judged score**: shown as raw time, with a delta ("−18s") rendered **only between runs of identical shape** — same `block_id`, same rounds × exercises, same per-cell reps/weight/duration reconstructed from `set_logs` (no **Prescription Snapshot** exists for blocks per ADR 0007). Anchored on **`block_id` identity** (stable across sessions, survives Builder edits); a run only counts when **all** expected cells are logged (`count == rounds × exercises`), so partial / `discardBlock` runs never pollute the trend or the **PB** (`MIN` over shape-matched complete runs). **Known wart:** the first `logged_at` fires *after* the first cell completes, so the measured start is slightly late — accepted for a non-judging stat in exchange for zero migration + retroactive history. V1 surfaces: **History card** (per-run time) + a **Block history sheet** (trend list/sparkline + delta + PB); per-round splits, pre-session "last time" hook, and finish-screen badge are deferred. The "fixed-benchmark, scored WOD" model lives in **Benchmark Circuit** (#398), deliberately out of scope here. Score is **mode-aware**: **Tours** → time; **AMRAP** → `27+3`.
→ `file:src/lib/blockSetLog.ts`, `file:src/components/history/BlockHistoryCard.tsx`, ADR `file:docs/adr/0008-circuit-completion-time-derived-not-scored.md`

**Benchmark Circuit** (#398 shipped):
A **named, reusable, catalog-level circuit** — its own entity (`benchmark_circuits`), not a promoted **Exercise Block**. Its public machine handle is an immutable ASCII `slug`; its display name is the `label` (`Zeus ⚡`). The GymLogic roster is Cindy plus eight Pantheon seeds (`zeus`, `heracles`, `ares`, `theseus`, `athena`, `atlas`, `hades`, `achilles`), all flat bodyweight **AMRAP** prescriptions in this wave. Dropping one onto a **workout day** snapshot-copies its fixed Rx into a day-scoped **Exercise Block** and stamps `benchmark_circuit_id`; catalog Rx wins over caller- or LLM-reconstructed exercises. A generic Circuit with no seed name stays jetable. Comparability uses `templateFingerprint`; history / PR reads the GO snapshot in `block_runs.benchmark_circuit_id`, not the live day FK. Canonical Rx is JSONB; a different Rx is a different catalog row, while label, tagline, story, and other editorial metadata may be patched. Breaking a seed's Rx contract creates a **Circuit Fork**. A Tours or pyramidal benchmark catalog is deferred; see ADR `file:docs/adr/0017-pantheon-amrap-seeds-and-label.md`.

**Olympien**:
Editorial cast for the four 20-minute Pantheon **Benchmark Circuits** (Zeus, Ares, Athena, Hades). It is roster language, not a database column. The achievement group that scores this cast is **Olympians**.

**Héros**:
Editorial cast for the four 10-minute Pantheon **Benchmark Circuits** (Heracles, Theseus, Atlas, Achilles). It is roster language, not a database column. The achievement group that scores this cast is **Heroes**.

**Specialty**:
The canonical tagline category assigned to one Pantheon matrix column: Full body, Upper-body strength, Core, or Legs. Each Specialty pairs one **Olympien** with one **Héros** and lives in localized tagline copy, not a dedicated column.

**Circuit Fork**:
The act of breaking a **Benchmark Circuit** Rx contract on a row the athlete does **not** own (GymLogic seed; later: published). V1 **mints a new user-owned Benchmark Circuit** (`owner_id` = the athlete, `forked_from` = source id) with the mutated Rx; the day's **Exercise Block** points at the new id. The source catalog row is never edited in place. Editing a private row you own is **not** a fork — same id, mutate in place. Distinct from logging leftover / missed reps — that is performance, not a fork.

**Meet Cindy** (#393):
The PWA job that makes a GymLogic **Benchmark Circuit** seed discoverable and **droppable** onto a programmed **workout day**. Surface: Builder **Add Exercise** picker, kind toggle **Exercises | Circuits** (not a muscle filter, not a third DayEditor button). **Circuits** lists GymLogic seeds only (`owner_id` NULL, `slug` set). Each hit is a WOD card (name, `AMRAP 20 min`, tagline) — not an exercise row. Tap calls `instantiateBenchmark` on the **current** day and closes the sheet; a `BlockCard` appears in the **Unified Day Sequence**. Search punches through the kind: `cindy` / `holland` / `tom holland` from **Exercises** pins the card above muscle groups. Empty **Exercises** does not promo Cindy. **Create circuit** stays jetable authoring. Pencil on the day card stays — Rx edits are **Circuit Fork** (T196). No home / Quick Workout CTA, no ad-hoc `program_id: null` day, no auto-GO, no picker Info (story lives on the **Circuit Catalog** shelf and the history sheet), no pre-session add. Write path: PWA mutation, same insert shape as `useCreateBlock`; catalog JSONB wins; never hardcode 5-10-15. Distinct from the **Circuit Catalog** encyclopedia — that is browse, this is drop. ADR `file:docs/adr/0016-meet-cindy-builder-seed-drop.md`.
→ `file:src/components/builder/ExerciseLibraryPicker.tsx`, `file:src/lib/instantiateBenchmark.ts`

**Circuit Catalog** (#483 v1 encyclopedia; north star of #398 still later):
The browse-only roster of GymLogic **Benchmark Circuits**. v1 surface: SideDrawer → Bibliothèque → **Circuits** → `/library/circuits` and `/library/circuits/:slug` (slug URLs; forks have `slug` NULL). List + detail (story, Rx, personal history / PB). Tap **navigates**; it does not instantiate — **Meet Cindy** remains the only drop. Seeds only (`owner_id` NULL). Ranked leaderboards, publish, `visibility`, share, and a social WOD shelf **do not** land under **Library** (ADR `file:docs/adr/0018-circuit-catalog-encyclopedia-under-library.md`). **Library** stays programs + exercise catalog + this encyclopedia; it is not the north-star ranked board. User-published Rx, blank named authoring, and live leaderboards come later. A no-program home CTA remains a later on-ramp, not #393 / not #483.

---

## Exercises & catalog

**Catalog Snapshot**:
The frozen copy of an exercise's catalog display fields taken at write time — `name_snapshot`, `muscle_snapshot`, `emoji_snapshot` on `workout_exercises`, and `exercise_name_snapshot` on `set_logs`. Exists so a program or a past session survives a catalog rename — or a catalog row absent from the query payload; deletion is not one of these cases, since `workout_exercises.exercise_id` and `set_logs.exercise_id` are `NOT NULL REFERENCES exercises(id)` with no `ON DELETE`, so a referenced exercise cannot be deleted. Deliberately **not** the display source. Per ADR 0010 the UI resolves labels from the joined `exercises` row (`name_en` then `name`, by **Display Locale**) and falls back to the **Catalog Snapshot** only when the catalog row is unavailable. Written by **six** paths (AI/quick-workout persistence, MCP persistence, three **Builder** mutations, template onboarding, pre-session edits, block persistence) — none of which is locale-aware, which is precisely why display-time resolution won over write-time. Distinct from **Prescription Snapshot**, which freezes engine intent on `set_logs.prescribed_*` and *is* authoritative for its consumer.
→ `file:src/lib/exerciseSelects.ts`, ADR `file:docs/adr/0010-localize-catalog-at-display-time.md`

**Display Locale**:
The language used to render user-facing content (`en` | `fr`). **Resolution rule:** `localStorage["locale"]` **always wins for rendering** — read synchronously at boot (`file:src/lib/persistedLocale.ts`, then the override in `file:src/lib/i18n.ts`) so the path stays network-free and flash-free — while `user_profiles.locale` only **seeds** a device that has no local value (new device, cleared storage, private browsing). Two devices may therefore disagree indefinitely; accepted deliberately, since language can legitimately be per-device (shared or work machine). Note the app's two defaults currently contradict each other: `localeAtom` starts at `"fr"` while `i18n.fallbackLng` is `"en"`. Distinct from the **per-request** `locale` that **Embedded Agent** chat / draft Edge calls carry (see **Program draft step**), and from `embedded_agent_threads.locale`, which is thread metadata frozen at open.
→ `file:src/store/atoms.ts`, `file:src/lib/persistedLocale.ts`

---

## Progression engine

**Progression Rule**:
The decision the engine emits for a given exercise's next session, based on **Last Performance** + RIR averaging. Enum: `WEIGHT_UP | REPS_UP | SETS_UP | DURATION_UP | HOLD_INCOMPLETE | HOLD_NEAR_FAILURE | PLATEAU`. The first four are **auto-applied** (the **Progression Suggestion**'s value differs from the previous session); the last three hold the value steady for explanatory reasons.
→ `file:src/lib/progression.ts`

**Progression Suggestion**:
Engine output for a single exercise: `{ rule, reps, weight, sets, delta, reasonKey, volumeType, duration? }`. The canonical "what should the user do this session" payload — drives the in-session **`SetsTable`**, the in-session `ProgressionPill`, and (post-#371) the pre-session list rows. Computed by `computeNextSessionTarget(prescription, lastPerformance)`. Falls back to `null` when there is no **Last Performance** to anchor against.
→ `file:src/lib/progression.ts`, `file:src/hooks/useProgressionSuggestion.ts`

**Template Prescription**:
The `weight` / `reps` / `sets` (+ optional `target_duration_seconds`, `rest_seconds`, range, and increment fields) on an **Exercise Slot** (`workout_exercises`), written exclusively by the **Builder** and program-creation flows (manual or AI). Authoritative source of **user intent** for that slot's prescription. **`rest_seconds` is part of the prescription but NOT a progression axis** — it is deliberately absent from the **Manual Override Window** trigger (`UPDATE OF reps, weight, sets, target_duration_seconds`), so editing rest never bumps `template_updated_at` and has no effect on the engine. Read by the engine only as **bootstrap** (no **Prescription Snapshot** yet for that exercise) or during the **Manual Override Window** (user edited the template since the last session). Per ADR 0006: prior to #373, `enqueueSessionFinish` wrote the engine's suggestion back into this row — that writeback is removed because it silently corrupted Builder edits, range strings (`"8-12"` → `"9"`), and the engine's own subsequent reads (the bug's feedback loop).
→ `file:src/types/database.ts`

**Prescription Snapshot**:
The `prescribed_reps` / `prescribed_weight` / `prescribed_sets` / `prescribed_duration_seconds` columns on `set_logs`, capturing the engine's pristine **Progression Suggestion** at the moment the session started — i.e. the value the **`SetsTable`** row was *initialized* with, before any in-session edits. **The single rule:** `prescribed_*` = what the engine prescribed for this session. Mid-session row edits affect `reps_logged` / `weight_logged` (the actuals), not the snapshot — permanent intent shifts go through **Manual Override Window** instead. On bootstrap (no **Last Performance** yet), the snapshot captures the **Template Prescription** values directly. Source of `volume.current` and `currentSets` for the engine on subsequent sessions, replacing the legacy "read **Template Prescription** + writeback" pattern. Legacy rows backfilled to `prescribed_X = X_logged` (and `prescribed_sets = COUNT(*) over (session_id, exercise_id)`) at migration time; columns stay nullable as a defensive shape only. Per ADR 0006.
→ `file:src/lib/syncService.ts`, `file:src/lib/progression.ts`

**Manual Override Window**:
The condition `workout_exercises.template_updated_at > last_session.finished_at` for an **Exercise Slot** — meaning the user edited that slot's **Template Prescription** since the most recent session that logged **this same slot** (same scope as **Last Performance**, #463). When true, the engine reads its target from **Template Prescription** instead of the most recent **Prescription Snapshot**, so manual Builder edits to `reps` / `weight` / `sets` / `target_duration_seconds` actually land. Unlocks deload, return-from-injury, and "last session was a fluke" flows for all four volume axes (closes the historical `weight`-only override gap). `template_updated_at` is maintained by a Postgres trigger that fires `BEFORE UPDATE OF reps, weight, sets, target_duration_seconds` on `workout_exercises` and only bumps when the value actually changes (`IS DISTINCT FROM` checks inside the trigger function). `DEFAULT NOW()` on INSERT so every row carries a non-null timestamp from creation. Per ADR 0006.

**Last Performance**:
The `set_logs` rows from the most recent session that logged a given **Exercise Slot** (keyed by `workout_exercise_id` + catalog `exercise_id`), carrying both actuals (`reps_logged`, `weight_logged`, `duration_seconds`) and the **Prescription Snapshot** (`prescribed_*`) captured at log-time. Source of the engine's `volume.current` and `currentWeight` on subsequent sessions, unless the **Manual Override Window** applies. **Exercise Block** logs stay out (`block_exercise_id` set / `workout_exercise_id` null — ADR 0007). Legacy or orphaned rows with null `workout_exercise_id` do not anchor — the engine bootstraps from **Template Prescription**. Athlete-level history, trends, and PRs remain catalog-global; only session prescription / prefill follows the slot (#463). Filtered by `logged_at < sessionStartedAt` when called in-session (so the live session's own logs don't pollute the comparison) or unfiltered pre-session.
→ `file:src/hooks/useLastSessionDetail.ts`, `file:src/hooks/useProgressionSuggestionsForDay.ts`, ADR `file:docs/adr/0012-slot-scoped-last-performance.md`

---

## Achievements

**Profil achievements strip** (UI: **Succès** / **Achievements**):
Three jobs on Profil, not Account's top-3-by-`tier_level`. **Plus récent** / **Latest** = max `granted_at` over the career. **Plus haut** / **Highest** = max rank / `tier_level` over the career (often the equipped title). Neither is window-scoped. **Derniers reçus** / **Recently earned** = `granted_at` inside the current Profil window — a date filter, not a new metric. Count `{n}/{total}` is career. CTA **Voir tout** → `/achievements`.
→ `file:src/types/achievements.ts`

**Circuit Achievement Run**:
One finished **Block Run** on a GymLogic **Benchmark Circuit** seed (`owner_id` NULL) whose AMRAP score has `fullRounds ≥ 1`. TIME-empty closes (`0+0`) and **Circuit Fork** / jetable Circuits do not qualify. Each qualifying run increments that seed's ledger by one. Shared unit for **Circuit runner**, **Cast Clearing**, and the collection tracks below.
→ `file:src/lib/amrapScore.ts`, `file:supabase/migrations/20260817120000_circuit_achievement_tracks.sql`

**Circuit runner**:
Achievement group `circuit_runner` (accordion *Circuit runner* / *Circuit Runner*). Metric: count of **Circuit Achievement Run**s across all GymLogic seeds (Cindy included). Thresholds 1 / 5 / 15 / 40 / 100. Surfaces: `/achievements` + session unlock overlay — not the **Circuit Catalog** (ADR 0018).

**Spidey**:
Achievement group `spidey` (accordion *L’Araignée* / *Spidey*). Metric: personal-best Cindy score in **full rounds only** (same run identity as history / `amrapScore`; leftover does not cross a tier). Thresholds 1 / 10 / 18 / 23 / 27; diamond equals Holland (`reference` 27), not 28+. Catalog label stays **Cindy**; Holland remains editorial `reference`, not the group name.

**Cast Clearing**:
Progress on a collection track: `MIN` of **Circuit Achievement Run** counts over that track's hardcoded seed cast. Surplus runs on one seed are advance toward later tiers, not wasted. Accordion v1 shows the numeric `MIN` only; naming the bottleneck seed is a follow-up.
→ ADR `file:docs/adr/0019-circuit-achievement-cast-clearing-and-spidey.md`

**Olympians** (achievement group):
Group `olympians` (accordion *Au sommet de l’Olympe* / *Olympus Summit*). **Cast Clearing** over the four **Olympien** seeds (`zeus`, `ares`, `athena`, `hades`). Thresholds 1 / 5 / 10 / 50 / 100. Distinct from the editorial cast term **Olympien**.

**Heroes** (achievement group):
Group `heroes` (accordion *Le tour des Héros* / *Heroes’ Tour*). **Cast Clearing** over the four **Héros** seeds (`heracles`, `theseus`, `atlas`, `achilles`). Same thresholds as **Olympians**. Distinct from the editorial cast term **Héros**.

**Pantheoniste**:
Achievement group `pantheoniste` (accordion *Le Pantheoniste* / *Pantheoniste*). **Cast Clearing** over all eight Greek Pantheon seeds (Cindy excluded). Same thresholds as **Olympians** / **Heroes**. A single seed run can feed **Circuit runner** plus the matching quatuor plus this capstone.

**Bodyweight Trinity**:
Three hardcoded catalog **families** (not a `movement_family` column) that feed the cumulative-rep achievement tracks and **100 jours ferme**. Canonical cores: **Pompes**, **Tractions**, **Squat au poids du corps**. Harder / grip variants count (diamond, déficit, pike, pistol, sumo bodyweight, chin-up, archer, … — lists locked in `file:docs/Epic_Brief_—_Bodyweight_Trinity_achievement_tracks_#509.md`). Regressions and loaded work do not (knee / incline / assisted / inverted row / **Squat barre**). Duration rows such as **Squats sautés** are out of the rep sum. **Circuit** station reps on family rows count 1:1 in `set_logs` (same rule as Volume King / Leg Day). Distinct from **Cindy** the **Benchmark Circuit**, even though Cindy Rx is the three cores.
→ `file:docs/Epic_Brief_—_Bodyweight_Trinity_achievement_tracks_#509.md`

**Grant Batch**:
Every newly unlocked achievement tier from one finish (RPC return + any Realtime inserts that landed before the overlay opened), frozen as the ceremony opens. Late grants wait for the next ceremony. The unit of the unlock overlay.
_Avoid_: slot machine, serial queue, one-medal-at-a-time ceremony

**Hero** (unlock ceremony):
The highest-rank tier in a **Grant Batch** (`diamond > platinum > gold > silver > bronze`; ties keep queue order). Title, rank chip, track name, threshold line, and Equip all describe this tier only.
_Avoid_: featured badge, primary tile among equals

**Supporting medal**:
A non-hero grant in the same **Grant Batch**. Count 2: overlaps the hero bottom-right. Count 3+: one under-row. Count 5+: under-row with a `+N` overflow tile. Never an equal grid.
_Avoid_: second hero, 2×2 grid, carousel, app-icon row

---

## Marketing site

**Product Tour**:
The capability journey page on the Astro mini-site at `/tour` (nav label **Tour**). Six scenes of dry-fun product facts with a desktop **Tour Split Stage** (sticky rail + device stage) and dual doors (**Open the app** → gymlogic.me, **Connect your agent** → `/connect/claude`). Quick Workout is folded into scene 1. Distinct from the agentic/MCP homepage pitch at `/`. EN-only in v1. See Epic Brief `file:docs/done/Epic_Brief_—_Product_Tour_(tour)_#466.md`, ADR `file:docs/adr/0013-product-tour-separate-from-homepage.md`.
→ `file:web/src/pages/tour.astro`

**Tour Split Stage**:
Desktop interaction model for the **Product Tour**: left sticky scene rail (01–06) + right sticky device stage that crossfades / focal-zooms as the active scene changes (scroll or click). Mobile uses a linear stack of the same six scenes instead. Scene 04 swaps phone chrome for a desktop window (BYOA / External MCP Client). Zig-zag feature rows are explicitly out.
→ `file:web/src/pages/tour.astro`
