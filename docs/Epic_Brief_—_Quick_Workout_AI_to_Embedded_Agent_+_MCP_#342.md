# Epic Brief — Quick Workout AI to Embedded Agent + MCP

## Summary

Migrate **Quick Workout AI** — the last legacy LLM surface in the GymLogic PWA — from its closed-loop `generate-workout` edge function + raw-Supabase write path to an **Embedded Agent**-shaped flow that goes through a new MCP write tool (**`create_workout_day`**). The user-facing UI stays untouched: `ConstraintStep` → AI generate → `PreviewStep` → start. Internally, the LLM call moves to a new `generate-quick-workout` Edge Function that calls **`create_workout_day`** server → MCP with the user's session JWT, and counts against a new independent quota source **`embedded_workout`**. The legacy `file:supabase/functions/generate-workout/` and `file:supabase/functions/generate-program/` (whose deletion was punted from T123) both die as part of this epic. **No user-visible UX change**, no chat surface, no copy review — pure tech migration. Sequencing: lands **before or alongside** #343. Decisions captured in **`docs/CONTEXT.md`** (ubiquitous-language glossary) and **`docs/adr/0002-quick-workout-ai-mcp-migration.md`** (trade-offs).

---

## Context & Problem

**Who is affected:** Users on the **AI generate** path of the **Quick Workout** flow (daily / multiple-times-daily traffic), the maintainer paying for hosted **Gemini** inference, and **External MCP Clients** (Claude Desktop, Cursor) who today have no MCP-native way to create an ad-hoc training session.

**Current state:**

- **UI**: `file:src/components/generator/QuickWorkoutSheet.tsx` orchestrates `ConstraintStep` → `QuickWorkoutAIGeneratingStep` → `PreviewStep`. The user picks duration, equipment, muscle groups, optionally types **AI Focus Areas**, and taps **AI generate**.
- **Hook**: `file:src/hooks/useAIGenerateWorkout.ts` POSTs to the `generate-workout` edge function and returns `{ exerciseIds, rationale }`.
- **Edge function**: `file:supabase/functions/generate-workout/index.ts` — own quota source (`workout`), own prompt builder, own Gemini wrapper, own validate-and-repair. Closed loop, no MCP involvement.
- **Persistence**: `file:src/hooks/useCreateQuickWorkout.ts` does **raw `workout_days` + `workout_exercises` inserts with `program_id: null`**. Bypasses MCP entirely. The same hook also handles the deterministic non-AI path and `save_as_draft`.

**Pain points:**

| Pain | Impact |
|------|--------|
| Two MCP-contract drift surfaces (LLM call shape + write path) | Quick Workout AI never benefits from MCP-side changes (validation, observability, audit). Drift compounds. |
| `generate-program` still deployed | Per T123, blocked on Quick Workout migration. Dead code carrying ~1k lines + a Gemini integration we maintain for nothing. |
| `program_id: null` writes leak across program-aware screens | Pre-existing data-model issue (handled as follow-up — not this epic). |
| Quota family split (`workout` vs `program` vs `embedded_*`) | Onboarding's Embedded Agent metering has its own counters; Quick Workout's `workout` counter sits orphaned. Inconsistent observability. |
| External MCP Clients have no way to create a quick session | "Claude, schedule me a 30-min push tomorrow" requires `create_program` (which destructively replaces the active program — wrong tool) or nothing. |

**Related artifacts:**

- **`docs/CONTEXT.md`** (`## Quick Workout` section): **AI Focus Areas**, **Quick Workout AI (v1)**, **`create_workout_day` MCP tool**, **`embedded_workout` quota source**, **`generate-quick-workout` Edge Function**.
- **`docs/adr/0002-quick-workout-ai-mcp-migration.md`** — five sub-decisions and the alternatives we rejected.
- **`file:supabase/functions/mcp/tools/createProgram.ts`** — canonical existing MCP write tool. `create_workout_day` mirrors its `dry_run`, `exercises[]` shape, and validator.
- **`file:supabase/functions/mcp/lib/createProgramValidation.ts`** — shared validator that the new tool will reuse (likely with a small extraction of the day-level entry point).
- **`file:supabase/functions/_shared/aiQuota.ts`** — `AIGenerationSource` union to extend with `"embedded_workout"`; underlying `ai_generation_log.source` column type to verify in Tech Plan.
- **`file:supabase/functions/embedded-agent/index.ts`** — reference for the Embedded Agent server-side orchestration shape (quota → LLM → MCP call with user JWT).
- Parent epic **#295** (closed) — explicit punt: *"Quick session can reuse the same tool layer as a follow-on."* This is the follow-on.
- Companion: **#343** — post-onboarding "Create Program" AI wizard cleanup; sequencing lets Quick Workout's tool-design decisions dictate the shared MCP surface.

---

## Architectural shape — v1 lock

Captured here so tickets cannot re-litigate; details in **ADR 0002** and the glossary.

**Two-phase flow** because `PreviewStep` allows the user to edit the AI's suggestion (rename, swap, add/remove, change sets/reps, shuffle) before committing — mirrors onboarding's **Onboarding program commit gate** pattern (`dry_run` preview → user confirms → real commit).

```
AI Generate (phase 1 — preview, no write):
  Client → POST /generate-quick-workout
            { duration, equipment, muscleGroups, focusAreas?, locale }
  Edge  → checkQuota("embedded_workout")
       → fetch catalog/profile/history
       → Gemini one-shot
       → validate-and-repair (retry once on catastrophic failure)
       ← { exercises[], rationale }   (NO database write)

PreviewStep:
  User edits freely (rename, swap, add/remove, sets/reps, shuffle).

Phase 2 — Start (MCP write):
  Client → POST /commit-quick-workout
            { name, exercises[] }   (post-edit payload)
  Edge  → MCP create_workout_day server → MCP via MCP Edge Function URL,
          Authorization: Bearer <user JWT>, dry_run: false
       ← { workout_day_id }
  Client navigates to workout_day_id.

Phase 2 — Save as draft (PWA-local, no MCP):
  Client → useCreateQuickWorkout (raw Supabase insert with saved_at)
  Drafts stay an in-app concept; MCP surface stays scoped to live workouts.

Phase 2 — Shuffle (PWA-local, no LLM, no MCP):
  Local deterministic generateWorkout() — no quota burn, instant.
```

`/generate-quick-workout` and `/commit-quick-workout` may be one Edge function with two modes or two separate functions — Tech Plan call. The **important invariant** is that no write happens until the user explicitly Starts.

**Why not write on first call?** It would orphan rows whenever the user dismisses the sheet without starting, and would either ignore the user's PreviewStep edits or require fragile sync logic to update an already-written row.

**Why not call MCP from the client on Start?** The PWA doesn't speak MCP RPC today; adding a client-side MCP client is non-trivial. The thin Edge wrapper is cheaper, satisfies the issue body's "write path through MCP" requirement, and stays consistent with the **Embedded Agent** glossary entry (server → MCP, user JWT as Bearer).

**What does NOT change in v1:** `QuickWorkoutSheet`'s step orchestration, `ConstraintStep`, `PreviewStep`, the `QuickWorkoutAIGeneratingStep` skeleton/spinner UI, the deterministic `lib/generateWorkout.ts` fallback, the in-app **`save_as_draft`** path (still uses `useCreateQuickWorkout` for both AI and deterministic flows).

**What changes in v1 (no UI implication):** `useAIGenerateWorkout` is replaced by a new hook that POSTs to `/generate-quick-workout` and returns `{ exercises, rationale }` (resolved against the catalog client-side, same as today). On Start, the AI path no longer calls `useCreateQuickWorkout` — it calls a new commit hook that POSTs to `/commit-quick-workout`.

**What dies in v1:** `file:supabase/functions/generate-workout/`, `file:src/hooks/useAIGenerateWorkout.ts`, `file:supabase/functions/generate-program/` (only after this lands — explicitly part of this epic, completing the T123 punt).

**`useCreateQuickWorkout` survives but its caller surface narrows** to: (a) deterministic Start, (b) deterministic Save-as-draft, (c) AI Save-as-draft. The AI Start path is the only one that moves to MCP.

---

## User Stories

1. As a **PWA user** opening the **Quick Workout** sheet on the **AI generate** path, I want the **same UI as today** (constraints → loading → preview), so that the migration is invisible to me and I keep the same speed of "tap → train".

2. As a **PWA user** filling **AI Focus Areas** ("avoid jumps, sore knee"), I want the **rationale** in the preview to **explicitly acknowledge my notes**, so that I can tell the model heard me without typing them twice.

3. As a **PWA user**, I want the AI generation to **complete in one round-trip from my device** (~3–6s, same as today), so that the migration doesn't make a daily flow noticeably slower.

4. As a **PWA user** whose AI generation **times out** or returns a network error, I want a **friendly retry button** + a **"Use Quick Generate instead"** escape, so that I'm never stranded on an error screen for a flow whose whole job is "give me a workout in 5 seconds".

5. As a **PWA user** who hits the **`embedded_workout` quota cap** (5/30days regular), I want a **clear message** explaining I've hit a limit, so that I'm not confused by an opaque error and I know my deterministic fallback still works.

6. As a **PWA user offline**, I want the **AI generate** button to be visibly disabled (as today via `navigator.onLine`), and I want the deterministic generate path to keep working, so that I can still build a session.

7. As a **PWA user** previewing an AI-generated workout, I want **Start**, **Save as draft**, **Shuffle**, **rename**, **swap exercises**, **add / remove exercises**, and **edit sets / reps** to behave exactly as today, so that I keep full control of the AI's suggestion before committing — and the workout is **only persisted when I explicitly hit Start or Save**, never on AI generation alone.

8. As a **PWA user** repeatedly hitting the AI button (intentional or accidental), I want **server-side quota enforcement** (not client-only), so that the cap is reliable and not bypassable by tampered clients.

9. As a **PWA user** whose generation succeeds but **returns no valid exercises** (catalog/model drift), I want the server to **retry once internally** before bubbling failure to me, so that one-off model burps don't burn a fallback experience.

10. As a **PWA user** who chose the **deterministic Quick Generate** path (non-AI), I want it to **continue working unchanged** with no MCP involvement, so that the fastest workout-creation path stays as fast as it is today.

11. As a **PWA user** who **saves a workout as draft** (whether AI-generated or deterministic), I want the in-app draft path to **continue using `useCreateQuickWorkout`** (no MCP, no extra latency), so that drafts stay snappy and don't pay the migration's roundtrip cost — drafts remain an in-app concept, MCP stays scoped to live training sessions.

12. As an **External MCP Client user** (e.g. via Claude Desktop), I want a `create_workout_day` tool that **inserts a single ad-hoc training session** without touching my active program, so that I can ask "schedule me a 30-min push tomorrow" without nuking my training plan.

13. As an **External MCP Client user**, I want `create_workout_day` to follow the same `dry_run` review pattern as `create_program`, so that I can verify the rendered prescription lines before persistence.

14. As an **External MCP Client user**, I want `create_workout_day` to be marked **`destructiveHint: false`** so that my host (Claude Desktop, Cursor) doesn't gate the call behind a confirmation prompt — inserting a workout is non-destructive, I can delete it in two taps if I don't like it.

15. As an **External MCP Client user** asking for a workout via Claude, I want my call to **not burn GymLogic's quota** (Claude pays its own LLM tokens, GymLogic only persists), so that third-party AI use cases don't compete with my in-app `embedded_workout` allowance.

16. As a **maintainer** auditing AI generation, I want **all `embedded_workout` quota events logged consistently** in `ai_generation_log`, so that the monthly recap (#282) and any future fairness analytics see Quick Workout AI traffic alongside `embedded_chat` / `embedded_draft` / `program`.

17. As a **maintainer** investigating a broken Quick Workout AI generation, I want **structured server-side logs / Sentry events** with technical detail (tool name, request id, sanitized payload excerpts, error kind), so that I can debug without leaking internals to the user UI — same posture as `Embedded Agent error handling (v1)`.

18. As a **maintainer**, I want `generate-quick-workout` to **call MCP server-side via `MCP Edge Function URL` with the user's session JWT** (not the public Cloudflare-fronted URL), so that the bearer never reaches the model provider or the browser and we skip the Cloudflare hop for first-party traffic.

19. As a **maintainer**, I want `file:supabase/functions/generate-workout/` and `file:src/hooks/useAIGenerateWorkout.ts` **deleted** as part of this epic (after the new path is wired and live), so that we don't carry dead code with its own quota source forever.

20. As a **maintainer**, I want `file:supabase/functions/generate-program/` **deleted** as part of this epic (completing the T123 punt), so that the post-T123 cleanup is finally done — assuming #343's deprecation of the post-onboarding AI wizard lands first or in parallel.

21. As a **maintainer**, I want **`useCreateQuickWorkout` to remain unchanged** and used for the deterministic + draft paths, so that this migration does not balloon into a write-path rewrite or change the in-app draft semantics.

22. As a **maintainer evaluating prompt drift**, I want `generate-quick-workout` to use a **workout-specific prompt** (one-day shape, target exercise count, equipment/muscle constraints) — not a copy of `generate-program`'s — so that the LLM isn't asked to assemble a multi-day plan when we want a single day.

23. As a **maintainer of the MCP surface**, I want `create_workout_day` to **reuse `create_program`'s `exercises[]` shape and validator** (with a tiny extraction of the day-level validator), so that LLM clients see a consistent prescription contract across both write tools and we share the test surface.

24. As a **maintainer**, I want `create_workout_day` to **NOT include `save_as_draft`** in its inputs, so that the public MCP surface stays scoped to "create a session ready to train" and in-app concepts don't leak to External MCP Clients.

25. As a **maintainer planning post-launch tuning**, I want **`embedded_workout`** to inherit the existing **5/30days regular, 5/24h whitelisted** caps unchanged at v1, so that we ship without a cost-shape decision and revisit with real telemetry.

### Success measures

| Story # | Measure |
|---------|---------|
| 3 | AI generate latency from tap to preview within ±20% of today's baseline (manual measurement on staging across one slow-network and one fast-network run) |
| 4 | Quota / network / timeout / validation errors all surface friendly copy + retry button + "Use Quick Generate" escape; covered by component tests on `QuickWorkoutAIGeneratingStep` error states |
| 8 | Cap enforced in `generate-quick-workout` Edge using `checkQuota("embedded_workout")` before any LLM call (server-side only) — verified by integration test |
| 9 | Server-side retry on catastrophic validation failure (zero valid exerciseIds) implemented and tested as in today's `generate-workout/index.ts:147-170` |
| 17 | At least one error path emits structured log fields (function name, user id hash, error kind, sanitized payload excerpt) on Edge |
| 19, 20 | `generate-workout` and `generate-program` directories no longer exist on `main` after epic completion; `useAIGenerateWorkout` deleted |

Stories without a numeric measure are validated qualitatively via the user story itself or by code review against the canonical glossary entries.

---

## Scope

**In scope:**

1. **New Edge endpoint: `generate-quick-workout`** (preview phase) — quota check (`embedded_workout`), parallel catalog/profile/history fetch, Gemini one-shot with workout-specific prompt, validate-and-repair (retry once on catastrophic failure), return `{ exercises[], rationale }`. **No database write.**
2. **New Edge endpoint: `commit-quick-workout`** (write phase, AI Start path only) — accepts `{ name, exercises[] }` (post-edit payload), calls MCP `create_workout_day` server → MCP via `MCP Edge Function URL` with user JWT, `dry_run: false`. Returns `{ workout_day_id }`. **May be one Edge function with two modes or two separate functions** — Tech Plan call.
3. **New MCP write tool: `create_workout_day`** — inputs `{ label, emoji?, exercises[], dry_run? }`; reuses `create_program`'s `exercises[]` shape and validator (with a small refactor to expose the day-level validator); `destructiveHint: false`; exposed to External MCP Clients via the existing tool registry.
4. **Quota source extension** — add `"embedded_workout"` to `AIGenerationSource`; verify and migrate `ai_generation_log.source` column if needed (Tech Plan determines TEXT vs enum). Quota fires only on `generate-quick-workout` (the LLM call); `commit-quick-workout` is a pure write, no quota.
5. **PWA wiring change** — replace `useAIGenerateWorkout` with a new hook (`useGenerateQuickWorkoutPreview`?) that POSTs to `/generate-quick-workout` and returns `{ exercises, rationale }`. Add a new commit hook (`useCommitQuickWorkout`?) wired to `QuickWorkoutSheet`'s `handleStart` for the AI path. `QuickWorkoutSheet`'s state machine (constraints → ai-generating → preview) **does not change**. `useCreateQuickWorkout` stays for: (a) deterministic Start, (b) deterministic Save-as-draft, (c) AI Save-as-draft.
6. **i18n** — any new copy (quota cap message, error states for the new path, commit failure copy) gets FR/EN strings. The `locale` field continues to flow on every Edge request (already present in today's hook).
7. **Decommission** — delete `file:supabase/functions/generate-workout/`, `file:src/hooks/useAIGenerateWorkout.ts`, and (as the closing act) `file:supabase/functions/generate-program/`.
8. **Tests** — server-side: `generate-quick-workout` happy / quota / timeout / validation paths; `commit-quick-workout` happy / MCP failure / RLS paths; MCP `create_workout_day` dry_run + persist paths; client-side: `QuickWorkoutAIGeneratingStep` error states; a smoke E2E if affordable that runs constraints → AI → preview (with at least one exercise edit) → start.

**Out of scope:**

- **Adding a chat surface** to Quick Workout (one-shot only — see ADR 0002 §1).
- **Reusing `create_program`** with a single-day shape or modeling Quick Workouts as 1-day programs (rejected in ADR 0002, alternatives table).
- **Routing the deterministic Quick Generate or in-app `save_as_draft` flows through MCP** (`useCreateQuickWorkout` stays).
- **Fixing the pre-existing `program_id: null` leak** across program-aware screens (separate follow-up issue — likely needs a `workouts` table or similar separation between programmed and ad-hoc sessions).
- **Tuning `embedded_workout` cap numbers** (inherit existing `workout` cap; revisit post-launch with telemetry).
- **Migrating `embedded_agent_threads`** to a multi-purpose / multi-active-thread schema (covered in #343 if it lands first; otherwise inherits whatever shape that epic settles on — orthogonal to this migration since v1 has no threads).
- **New product capabilities** for Quick Workout (parity, not features).

---

## Success Criteria

- **Qualitative — invisible to the user**: A regression-test pass on the AI generate flow (constraints → AI → preview → start) shows identical UX to today, with no new screens, no chat, no copy review beyond error/quota strings.
- **Qualitative — MCP write surface for AI Start**: Every AI-generated *live* quick workout (user pressed Start) lands in the database via `create_workout_day`. AI Save-as-draft continues via `useCreateQuickWorkout` by design (drafts are an in-app concept, not an MCP tool surface).
- **Qualitative — cleanup complete**: After this epic ships, `git ls-files supabase/functions/generate-workout supabase/functions/generate-program` returns empty.
- **Qualitative — quota independence**: `embedded_workout` increments only on `generate-quick-workout` LLM calls; in-app deterministic generate and External MCP Client calls do not increment it. Verified by integration test or manual log inspection.
- **Qualitative — External MCP Client parity**: A manual run from Claude Desktop calling `create_workout_day` with `dry_run: true` then `dry_run: false` produces a workout day visible in the PWA without affecting the user's active program.
- **Engineering**: RLS on `workout_days` / `workout_exercises` continues to scope writes to the calling user (no new policy required — `create_workout_day` runs with user JWT).
- **Engineering**: New Edge function emits structured logs on at least one error path; `embedded_workout` rows visible in `ai_generation_log`.

---

## Decisions already locked (see `docs/CONTEXT.md` and `docs/adr/0002-quick-workout-ai-mcp-migration.md`)

Ubiquitous-language entries **AI Focus Areas**, **Quick Workout AI (v1)**, **`create_workout_day` MCP tool**, **`embedded_workout` quota source**, **`generate-quick-workout` Edge Function** — these should not be re-litigated in tickets except via explicit ADR amend or glossary update. Five sub-decisions captured in **ADR 0002** with rejected alternatives:

1. No chat surface for v1 (vs. parity with onboarding's Embedded Agent).
2. New `create_workout_day` MCP tool (vs. reusing `create_program`'s destructive-on-activate shape; vs. modeling as 1-day program).
3. Server-side MCP write from `generate-quick-workout` (vs. client calling MCP directly).
4. Independent `embedded_workout` quota (vs. merging into `program` or reusing `embedded_draft`).
5. `useCreateQuickWorkout` survives untouched for non-AI paths (vs. issue body's "decommission or rewrite").

---

## Open points for Tech Plan

- **`ai_generation_log.source` column type** — TEXT vs. enum vs. CHECK constraint; migration accordingly when adding `"embedded_workout"`.
- **Validator extraction** — refactor `file:supabase/functions/mcp/lib/createProgramValidation.ts` to expose a day-level entry point (`validateDayExercises` is already there; ensure it's importable by `create_workout_day`'s handler).
- **Prompt builder location** — `supabase/functions/generate-quick-workout/prompt.ts` mirrors today's `generate-workout/prompt.ts`; decide whether catalog/profile/history fetchers move to `_shared/` or stay duplicated until the next consumer appears.
- **One Edge function or two?** `generate-quick-workout` (preview) and `commit-quick-workout` (write) can be two functions or one with two modes (e.g. `POST /quick-workout-agent` with `{ phase: "preview" | "commit" }`). Two functions = clearer logs, simpler routing. One function = less deploy overhead. Tech Plan call — minor.
- **Commit auth + idempotency** — the commit endpoint accepts a user-edited payload. Tech Plan should specify (1) the request validation (sane bounds, exercise UUIDs exist), (2) idempotency story if any (today's `useCreateQuickWorkout` is not idempotent — duplicate Start clicks would create duplicate rows; `commit-quick-workout` likely inherits this and that's fine for v1).
- **Sequencing with #343** — both epics block deletion of `generate-program`. Decide whether #343 ships first (so its post-onboarding wizard cleanup is done before we delete the function), or whether they land in the same window. Per the issue body, Quick Workout's tool-design decisions tend to dictate the shared MCP surface, so this epic should lock decisions first; #343 inherits.
- **Feature flag?** — onboarding's Phase B used a flag for staged rollout. Quick Workout's UX is identical to today's; not clear a flag is needed. Tech Plan decides — default position: **no flag**, ship behind tests + soak period, since the failure mode (regression of AI generate) is recoverable via the deterministic fallback the user already has.
- **Analytics events** — names for `embedded_workout` quota hit, `create_workout_day` success / failure, retry / fallback button presses.
- **External MCP Client tool description** — the `create_workout_day` tool's `description` (LLM-targeted prose) and `annotations.title` (UI-targeted) — needs careful wording so Claude understands when to use it vs `create_program`.
- **`PreviewStep` rationale rendering** — does today's `PreviewStep` already give the rationale enough visual prominence to satisfy Story 2 ("explicitly acknowledge my AI Focus Areas"), or does the v1 migration also touch the rationale rendering? Quick code check before tech-plan kickoff.

---

## References

- GitHub **#342** (this epic)
- GitHub **#295** (parent — explicit punt of Quick Workout migration)
- GitHub **#343** (companion — post-onboarding AI wizard cleanup)
- GitHub **#282** (monthly recap — consumer of `ai_generation_log` analytics)
- T123 — `file:docs/T123_—_Cutover_+_Legacy_AI_Onboarding_Cleanup.md` (the original `generate-program` deletion punt)
- **`docs/CONTEXT.md`** (`## Quick Workout` section)
- **`docs/adr/0002-quick-workout-ai-mcp-migration.md`**
- `file:src/components/generator/QuickWorkoutSheet.tsx`
- `file:src/components/generator/ConstraintStep.tsx`
- `file:src/components/generator/QuickWorkoutAIGeneratingStep.tsx`
- `file:src/hooks/useAIGenerateWorkout.ts`
- `file:src/hooks/useCreateQuickWorkout.ts`
- `file:supabase/functions/generate-workout/index.ts`
- `file:supabase/functions/generate-program/index.ts`
- `file:supabase/functions/mcp/tools/createProgram.ts`
- `file:supabase/functions/mcp/lib/createProgramValidation.ts`
- `file:supabase/functions/embedded-agent/index.ts`
- `file:supabase/functions/_shared/aiQuota.ts`
