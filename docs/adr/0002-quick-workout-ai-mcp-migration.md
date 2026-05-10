# ADR 0002 — Quick Workout AI migrates to Embedded Agent + MCP

- **Status:** Accepted
- **Date:** 2026-05-10
- **Decided in:** grilling session on branch `refactor/342/quick-workout-embedded-agent-mcp`

## Context

**Quick Workout AI** is the last legacy LLM surface in the GymLogic PWA and the only reason `file:supabase/functions/generate-program/` is still deployed (per T123: removal of `generate-program` was punted to "after Quick Workout migrates"). It has **two** drift surfaces vs. the **MCP** contract:

1. **The LLM call shape.** `useAIGenerateWorkout` (`file:src/hooks/useAIGenerateWorkout.ts`) hits a closed-loop edge function `generate-workout` that runs its own quota source (`workout`), prompt builder, and Gemini integration — none of which align with the **Embedded Agent** pattern that onboarding adopted in #295 / Phase B.
2. **The write path.** `useCreateQuickWorkout` (`file:src/hooks/useCreateQuickWorkout.ts`) does **raw `workout_days` + `workout_exercises` inserts with `program_id: null`**, bypassing MCP entirely. This is the only write into the program tables that doesn't go through `create_program`.

Forces at play:

- **Cleanup blocker.** Deleting `file:supabase/functions/generate-program/` is blocked on this migration; the post-onboarding "Create Program" AI wizard cleanup (#343) is also blocked on shared decisions about the MCP write surface.
- **Cadence mismatch.** Quick Workout is a **daily, 30-second** flow. Onboarding is a **once-per-user, multi-minute** flow. The shape of the migration cannot be a copy-paste of onboarding's chat-driven Embedded Agent — Quick Workout's product promise is speed.
- **External MCP surface.** Whatever write tool ships will be available to **External MCP Clients** (Claude Desktop, Cursor) and is therefore a versioned public API. Hard to remove later.
- **Pre-existing leak.** `program_id: null` rows in `workout_days` already leak in unexpected places (program-list queries, achievement counters). This is a real bug, but it predates this migration and trying to fix it here turns a refactor into a data-model rework.

The issue body (#342) listed five open questions; the grilling session resolved all of them. This ADR captures the trade-offs behind the answers — the glossary in `docs/CONTEXT.md` records the *outcomes*; this ADR records the *reasoning*.

## Decision

We will migrate Quick Workout AI to the **Embedded Agent** pattern with **five coupled sub-decisions**:

### 1. No chat surface for v1

**Quick Workout AI (v1)** stays one-shot: the user fills `ConstraintStep` (duration, equipment, muscle groups, **AI Focus Areas**), hits submit, and gets a single LLM response back — no clarifying turns, no message bubbles. The model echoes the user's inputs in a richer `rationale` string, which the existing `PreviewStep` already renders.

The "Embedded Agent" tag in `docs/CONTEXT.md` does **not** require chat — it requires LLM-driven server-side flow with MCP tool calls. A one-turn LLM call still qualifies.

### 2. New MCP write tool: `create_workout_day`

Insert a single `workout_days` row with `program_id: null`, plus its `workout_exercises`. Reuse `create_program`'s `exercises[]` shape (UUID-or-prescription-object) and shared validator (`file:supabase/functions/mcp/lib/createProgramValidation.ts`); reuse the `dry_run: true → review → dry_run: false` pattern.

Annotations: `destructiveHint: false`, `idempotentHint: false`. **`save_as_draft` is intentionally excluded** from the MCP surface — drafts are an in-app convenience, not an external-client concern.

Exposed to **External MCP Clients** — *"Claude, schedule me a 30-minute push session for tomorrow"* is a legitimate use case and costs us nothing (Claude pays its own LLM tokens).

### 3. Two-phase server flow, two Edge functions: `generate-quick-workout` + `commit-quick-workout`

The new Edge surface is **two separate Edge functions** (not one with modes). The split is forced by `PreviewStep`'s edit affordances (rename, swap, add/remove, sets/reps, shuffle): the workout the user **starts** is rarely byte-identical to what the LLM returned, so we can't write on the LLM call.

**Phase 1 — `generate-quick-workout` (preview, idempotent):** quota check (`quick_workout`) → catalog/profile/history fetch → one-shot Gemini → validate-and-repair → return `{ exercises[], rationale }`. **No database write.**

**Phase 2a — `commit-quick-workout` (live workout, AI Start, mutator):** accepts the (post-edit) `{ label, exercises[] }` payload, calls **MCP `create_workout_day` server → MCP via `MCP Edge Function URL` with the user's session JWT as Bearer**, `dry_run: false`. Returns `{ workout_day_id }`. No quota burn (the LLM call already paid).

**Phase 2b — AI Save-as-draft:** stays in-app via `useCreateQuickWorkout` (raw Supabase insert with `saved_at`). **Drafts are not in the MCP surface by design** — they're a PWA concept that doesn't make sense for External MCP Clients.

**Why two Edge functions, not one with modes.** Preview and commit have meaningfully different semantics: preview is idempotent (rerunnable, GET-like, retriable on transient failure), commit is mutator (POST-like, idempotency requires extra design, retry policy is different). One function with a `phase: "preview" | "commit"` discriminator would force shared error handling, shared logs, and shared retry semantics on two flows that should diverge. The deploy-overhead delta is negligible (Supabase Edge functions share runtime); the clarity-of-ownership win is real.

**Auth.** Server-side calls use the user's Supabase session JWT as `Bearer`; the MCP function's existing auth router (`file:supabase/functions/mcp/lib/authLogic.ts:80-82`) routes non-PAT bearers through `createUserClient(authHeader)` unchanged — same path onboarding's Embedded Agent already uses. No new auth surface.

This pattern mirrors the existing **Onboarding program commit gate** (`dry_run: true` preview → user confirms → real commit), keeps the migration faithful to the **Embedded Agent** glossary entry (server drives the LLM, server hits MCP, the bearer token never reaches the model provider or the browser), and preserves today's edit-before-commit UX in `PreviewStep` exactly.

Two server roundtrips on the AI Start happy path (one for generate, one for commit). Same number as today's "tap → train" sequence (one for `generate-workout`, one for `useCreateQuickWorkout`'s Supabase insert) — net latency is roughly equivalent.

### 4. Independent quota source: `quick_workout`

Add `quick_workout` to `AIGenerationSource` in `file:supabase/functions/_shared/aiQuota.ts`. Independent counter from `program` / `embedded_chat` / `embedded_draft` / legacy `workout`. **Cap: 10/30days regular** (bumped from legacy `workout`'s 5/30), **5/24h whitelisted** (unchanged). Today's `QUOTA_REGULAR = 5` is shared across sources, so the bump requires introducing a per-source cap map (`QUOTA_REGULAR_BY_SOURCE: Record<AIGenerationSource, number>`); `program` and `workout` keep `5`, `quick_workout` gets `10`.

**Why bump.** The legacy `workout` cap was sized when AI generation was an occasional nice-to-have. Post-migration, Quick Workout AI is positioned as the **daily** AI assistant. 5/30 saturates a daily user in 5 days — 25 days of "limit reached" per month. 10/30 doubles headroom, still bounded, modest token-budget impact (today AI generation is < 5% of Quick Workout starts; even a 3x bump barely moves the cost needle). Revisit with telemetry; 15/30 stays open as a v2 lever.

**Naming.** The first instinct was `embedded_workout` (matches the `embedded_*` family of `embedded_chat` and `embedded_draft`). Rejected: those sources are artifacts of a chat-shaped flow (per-turn or per-draft within a chat thread). Quick Workout AI is a one-shot generator — `embedded_*` would mislead anyone reading logs or quota errors. `quick_workout` matches the simple top-level naming of `program` / `workout`. The legacy `workout` source dies in this same migration so there's no clash.

Quick Workout's daily cadence must not steal the once-a-month program quota — merging into `program` would mean a user who hits the Quick Workout cap loses the ability to (re)generate a program, and vice versa.

### 5. Scope narrowed: keep `useCreateQuickWorkout` for non-AI Start + all save-as-draft

The issue body framed `useCreateQuickWorkout` as "decommission or rewrite on top of MCP". We reject both halves: it survives untouched for **(a) deterministic Start, (b) deterministic Save-as-draft, (c) AI Save-as-draft**. Only the **AI Start** path moves to MCP (via `commit-quick-workout` → `create_workout_day`). Drafts and the deterministic flow are non-AI / no quota / no LLM contract drift — none of the reasons we're going through MCP for the AI Start path apply.

The migration's actual goal — delete `generate-workout` and `generate-program`, write AI-Started workouts via MCP — does not depend on `useCreateQuickWorkout` going away. Its caller surface narrows but the hook itself stays.

## Consequences

**Positive**

- `file:supabase/functions/generate-workout/` and `file:supabase/functions/generate-program/` both get deleted. Net code reduction.
- **Single LLM/quota story** for AI flows: all server-side AI generation goes through Embedded-Agent-shaped Edge Functions, MCP write tools, `embedded_*` quota sources. Future agent flows (e.g. monthly recap #282 generation) inherit the pattern for free.
- **External MCP Clients gain `create_workout_day`** — a non-destructive, useful tool that doesn't burn our quota.
- The fallback story stays simple — `useCreateQuickWorkout` + deterministic `generateWorkout()` is well-tested and fast (~80ms write).
- The PWA UI (`QuickWorkoutSheet`, `ConstraintStep`, `PreviewStep`) genuinely doesn't change. **Pure tech migration, no UX rework, no copy review needed.**

**Negative**

- **Two write paths persist** for `workout_days` rows: MCP `create_workout_day` (AI Start only) and `useCreateQuickWorkout` (deterministic Start, deterministic Save-as-draft, AI Save-as-draft). Audits and analytics that want a single chokepoint will need to query both. Acceptable for v1; revisit if/when we move drafts to MCP.
- **Pre-existing `program_id: null` leak is not fixed** by this migration. Filed as a separate follow-up issue; if it bites users between this ticket landing and the follow-up, that's on us.
- **Adding a new public MCP tool is a versioned API commitment.** External MCP Client installations now expect `create_workout_day` to remain available. Removal would be a breaking change.
- **The `quick_workout` cap (10/30d regular) is a product call without telemetry** — we doubled the legacy `workout` cap based on cadence framing, not user-data. If real usage shows daily-active users still saturating, bump to 15/30. If usage is < 5/month per heavy user, the bump was overkill (no harm, just unused headroom).
- **`save_as_draft` cannot be requested by external MCP clients** — by design, but if a future use case appears ("Claude, save this as a draft I'll review later"), we'd need a separate MCP tool or to revise the call.

**Follow-ups**

- File a separate issue for the `program_id: null` leak (data-model rework — likely needs a `workouts` table or similar separation between programmed and ad-hoc sessions).
- Tech Plan: verify `ai_generation_log.source` column type (TEXT vs enum) and write the migration accordingly.
- Tech Plan: decide whether `generate-quick-workout`'s catalog/profile/history fetchers get extracted to `_shared/` (since `generate-program` is also dying), or stay duplicated and we extract on the third use.
- Tech Plan: decide the new function's prompt builder location (`supabase/functions/generate-quick-workout/prompt.ts` is the obvious mirror of today's `generate-workout/prompt.ts`).
- Post-launch: review **`quick_workout`** regenerate-rate and `AI Focus Areas` usage telemetry; if either signals frustration with the one-shot UX, revisit the chat-surface decision via a new ADR.
- After this ships and `generate-program` is gone, file the deletion of `generate-program` as part of this PR or as a tail-end follow-up (per T123).

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **Add a chat surface to Quick Workout (parity with onboarding's Embedded Agent)** | Different cadence (daily vs once), different information asymmetry (already-collected constraints vs vague new-user goals), different UX cost (every second matters vs minutes are fine). Bidirectional chat doesn't pay rent here. |
| **Reuse `create_program` with a single-day shape** | `create_program` is `destructiveHint: true` because activating a new program **deactivates the user's current active program** (`file:supabase/functions/mcp/tools/createProgram.ts:430-443`). Using it for Quick Workout would silently nuke the user's training program every tap. Disqualified unless we add a `dont_activate` flag, at which point we've polluted the program tool with non-program concerns. |
| **Model a Quick Workout as a real 1-day program (insert a `programs` row)** | Trades the existing `program_id: null` leak for a worse one — junk 1-day programs cluttering the program list, achievement counters, monthly recap, "active program" semantics. The current leak is one query bug; this would be a data-model lie surfaced across every program-aware screen. |
| **Edge does only LLM; client calls MCP from the browser** | Two network hops from the client (Edge LLM call + MCP write call). Adds 200–500ms to "tap → train" on flaky mobile. The whole point of the migration is MCP-cleanness *without* paying UX. Also, PWA calling its own MCP via session cookie isn't the canonical **External MCP Client** pattern (which uses OAuth or **MCP Personal Access Token (PAT)**). |
| **Inline Quick Workout into the existing `embedded-agent` Edge Function as a new "mode"** | The `embedded-agent` function is chat-orchestration-shaped. Jamming a one-shot generator in there couples two flows that should evolve independently — different prompts, different validation, different quota, different tooling. If onboarding adds streaming or multi-active threads, Quick Workout would inherit complexity for free. |
| **Merge the new flow's quota into the existing `program` source** | Different cadence — daily Quick Workouts would steal once-a-month program quota, and a user who hits one cap would lose access to the other flow. Same-bucket fairness is the wrong shape. |
| **Reuse `embedded_draft` quota** | Contaminates onboarding's analytics with daily quick-workout traffic. Onboarding is once-per-user; mixing makes the funnel metrics meaningless. |
| **Decommission `useCreateQuickWorkout` and route all `workout_days` writes through MCP** | Forces the deterministic-fallback path through MCP (~150–250ms vs ~80ms direct Supabase insert), and forces `save_as_draft` back onto the MCP surface (or invents a separate MCP draft tool). Net: more surface area, slower fallback, no actual user benefit. The "single write path" purity isn't worth it for non-AI flows. |
| **Fix the `program_id: null` leak as part of this migration** | Scope explosion. The leak is a pre-existing data-model issue (likely needs a separate `workouts` table); fixing it here would 3× the ticket size and require schema migration on a path users hit daily. Filed as a follow-up. |
