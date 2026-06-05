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

## Workout execution

**Duration Set Timer**:
The in-session timer for duration-based exercises (planks, hollow holds, dead hangs) — distinct from the rest timer. Renders inside `SetsTable` as a two-cell unit (live MM:SS countdown + Play/Stop button). Fires audio + vibration at T=0 and auto-logs the set; the user does not tap a separate Log button. **Pre-existing limitation:** `elapsedSec` is **not pause-aware** (uses raw wall-clock vs **`useRestTimer`**'s `accumulatedPause`); resuming after a long pause insta-fires the alarm. Tracked separately from #374.
→ `file:src/components/workout/DurationSetTimer.tsx`

**Eyes-off Feedback**:
The product-level promise that during a held isometric (plank, hollow hold, etc.) the user never needs to look at the screen to know how the set is going. Three layers, in order of reliability: **(1)** screen wake lock via **`useKeepScreenAwake`** to keep the visual countdown legible without re-unlocking the phone (foreground only); **(2)** sequenced audio cues at T-3 / T-2 / T-1 (660 Hz / 150 ms `playWarningBeep`) and a finish chime at T-0 (`playFinishBeeps`, two-note 880 → 1100 Hz) for eyes-closed / looking-up moments; **(3)** a service-worker notification at T-0 (best-effort, mirrors **`useRestTimer`**'s pattern) for the backgrounded / phone-in-pocket case. Centralized through **`src/lib/audio.ts`** + **`useKeepScreenAwake`** (see ADR 0006). Currently scoped to **Duration Set Timer**; **`useRestTimer`**'s 10-second warning is a credible future caller.
→ `file:src/components/workout/DurationSetTimer.tsx`, `file:src/lib/audio.ts`, `file:src/hooks/useKeepScreenAwake.ts`

---

## Progression engine

**Progression Rule**:
The decision the engine emits for a given exercise's next session, based on **Last Performance** + RIR averaging. Enum: `WEIGHT_UP | REPS_UP | SETS_UP | DURATION_UP | HOLD_INCOMPLETE | HOLD_NEAR_FAILURE | PLATEAU`. The first four are **auto-applied** (the **Progression Suggestion**'s value differs from the previous session); the last three hold the value steady for explanatory reasons.
→ `file:src/lib/progression.ts`

**Progression Suggestion**:
Engine output for a single exercise: `{ rule, reps, weight, sets, delta, reasonKey, volumeType, duration? }`. The canonical "what should the user do this session" payload — drives the in-session **`SetsTable`**, the in-session `ProgressionPill`, and (post-#371) the pre-session list rows. Computed by `computeNextSessionTarget(prescription, lastPerformance)`. Falls back to `null` when there is no **Last Performance** to anchor against.
→ `file:src/lib/progression.ts`, `file:src/hooks/useProgressionSuggestion.ts`

**Template Prescription**:
The `weight` / `reps` / `sets` (+ optional `target_duration_seconds`, `rest_seconds`, range, and increment fields) on `workout_exercises`, written exclusively by the **Builder** and program-creation flows (manual or AI). Authoritative source of **user intent** for an exercise's prescription. **`rest_seconds` is part of the prescription but NOT a progression axis** — it is deliberately absent from the **Manual Override Window** trigger (`UPDATE OF reps, weight, sets, target_duration_seconds`), so editing rest never bumps `template_updated_at` and has no effect on the engine. Read by the engine only as **bootstrap** (no **Prescription Snapshot** yet for that exercise) or during the **Manual Override Window** (user edited the template since the last session). Per ADR 0006: prior to #373, `enqueueSessionFinish` wrote the engine's suggestion back into this row — that writeback is removed because it silently corrupted Builder edits, range strings (`"8-12"` → `"9"`), and the engine's own subsequent reads (the bug's feedback loop).
→ `file:src/types/database.ts`

**Prescription Snapshot**:
The `prescribed_reps` / `prescribed_weight` / `prescribed_sets` / `prescribed_duration_seconds` columns on `set_logs`, capturing the engine's pristine **Progression Suggestion** at the moment the session started — i.e. the value the **`SetsTable`** row was *initialized* with, before any in-session edits. **The single rule:** `prescribed_*` = what the engine prescribed for this session. Mid-session row edits affect `reps_logged` / `weight_logged` (the actuals), not the snapshot — permanent intent shifts go through **Manual Override Window** instead. On bootstrap (no **Last Performance** yet), the snapshot captures the **Template Prescription** values directly. Source of `volume.current` and `currentSets` for the engine on subsequent sessions, replacing the legacy "read **Template Prescription** + writeback" pattern. Legacy rows backfilled to `prescribed_X = X_logged` (and `prescribed_sets = COUNT(*) over (session_id, exercise_id)`) at migration time; columns stay nullable as a defensive shape only. Per ADR 0006.
→ `file:src/lib/syncService.ts`, `file:src/lib/progression.ts`

**Manual Override Window**:
The condition `workout_exercises.template_updated_at > last_session.finished_at` for an exercise — meaning the user edited the **Template Prescription** since their most recent session. When true, the engine reads its target from **Template Prescription** instead of the most recent **Prescription Snapshot**, so manual Builder edits to `reps` / `weight` / `sets` / `target_duration_seconds` actually land. Unlocks deload, return-from-injury, and "last session was a fluke" flows for all four volume axes (closes the historical `weight`-only override gap). `template_updated_at` is maintained by a Postgres trigger that fires `BEFORE UPDATE OF reps, weight, sets, target_duration_seconds` on `workout_exercises` and only bumps when the value actually changes (`IS DISTINCT FROM` checks inside the trigger function). `DEFAULT NOW()` on INSERT so every row carries a non-null timestamp from creation. Per ADR 0006.

**Last Performance**:
The `set_logs` rows from the most recent session that logged a given exercise, carrying both actuals (`reps_logged`, `weight_logged`, `duration_seconds`) and the **Prescription Snapshot** (`prescribed_*`) captured at log-time. Source of the engine's `volume.current` and `currentWeight` on subsequent sessions, unless the **Manual Override Window** applies. Filtered by `logged_at < sessionStartedAt` when called in-session (so the live session's own logs don't pollute the comparison) or unfiltered pre-session.
→ `file:src/hooks/useLastSessionDetail.ts`