# Epic Brief — Migrate Create Program AI to Embedded Agent

## Summary

Migrate the **post-onboarding AI program creation wizard** at `/library/programs/create` (path "AI") from its legacy closed-loop `generate-program` + raw-Supabase write path to an **Embedded Agent**-shaped flow gated by **`create_program`**'s MCP commit pattern. The user-visible result: returning users get the same coaching surface onboarding users got in #295 — but adapted to the fact that they already have a profile, an active **Program**, and weeks-to-months of training history. The agent reads that history before drafting and elicits a structured **change motivation** (variety / plateau / injury / priority shift / equipment change / return from break) before proposing a program. **`AIConstraintStep` is removed** from this branch of the wizard; the path-choice → chat → preview → commit sequence inherits onboarding's machinery (with components relocated from `src/components/onboarding/` to `src/components/embedded-agent/`). Companion to **#342** (Quick Workout AI migration); together they unblock deletion of `file:supabase/functions/generate-program/` — that deletion lives in #342 per **Sequencing with #342** below. Decisions captured in **`docs/CONTEXT.md`** (glossary) and **ADRs 0003 / 0004** (creation-flow shape + thread schema).

---

## Context & Problem

**Who is affected:** Returning **PWA users** creating a second / third / Nth program (the engaged user cohort — the ones using the app *more*, not less), the maintainer paying for hosted **Gemini** inference, and the **Embedded Agent thread** schema (currently constrained to one active row per user, blocking multi-flow coexistence).

**Current state:**

- **UI**: `file:src/pages/CreateProgramPage.tsx` orchestrates `path-choice` → (`ai-constraints` → `ai-generating` → `ai-preview`) | `template-choice` | `blank`. The AI branch is the legacy closed loop.
- **Constraints step**: `file:src/components/create-program/AIConstraintStep.tsx` — chip groups for `daysPerWeek`, `duration`, `goal`, `experience`, `equipmentCategory`, `splitPreference`, plus a `focusAreas` free-text field. Auto-fills from `useUserProfile` on mount.
- **Hook**: `file:src/hooks/useAIGenerateProgram.ts` POSTs to the `generate-program` edge function, returns `{ rationale, days[] }`, resolves exercises against the catalog client-side.
- **Edge function**: `file:supabase/functions/generate-program/index.ts` — own quota source (`program`), own prompt builder, own Gemini wrapper. Closed loop, no MCP involvement.
- **Persistence**: `file:src/components/create-program/AIProgramPreviewStep.tsx:45-107` does **raw `programs` + `workout_days` + `workout_exercises` inserts** with its own `is_active: false` → activate dance. No MCP, no commit gate.

**Pain points:**

| Pain | Impact |
|---|---|
| First-program (onboarding) gets the polished Embedded Agent flow; the *second, third, Nth* program gets the legacy one-shot wizard. Backwards. | The most-engaged users — who'll create the most programs — get the least-evolved experience. UX inconsistency screams "v0.5 left behind". |
| Returning users have a profile, an active program, and training history — none of which the legacy flow reads. The AI's draft is decoupled from the user's actual training reality. | Suggestions feel generic. A user who's been plateauing on bench for 6 weeks gets the same draft as a first-time user with the same goal — the *reason* they want a new program never enters the agent's context. |
| `AIProgramPreviewStep` runs raw inserts + manual `is_active: false` dance — the same pattern `create_program` was built to replace. | One more MCP-contract drift surface; bug fixes in `create_program` (validation, rollback semantics) don't reach this path. |
| `embedded_agent_threads` is constrained to one active row per user (`UNIQUE (user_id) WHERE status IN ('open','preview_ready')`). | A user mid-onboarding cannot start an Additional program creation thread; a user resuming an additional-program flow can't have a parallel onboarding row from a multi-device cutover. Single-flow schema doesn't fit a multi-flow product. |
| `useAIGenerateProgram` + `AIGeneratingStep` + `AIProgramPreviewStep` in `create-program/` are near-clones of the onboarding wizard we already replaced in #295. | Code duplication. Two paths to maintain, two sets of bugs, two sets of i18n keys. |

**Related artifacts:**

- **`docs/CONTEXT.md`** — entries: **Embedded Agent**, **Embedded Agent thread**, **Embedded Agent thread lifecycle**, **Embedded Agent onboarding (v1)** (sharpened), **Additional program creation flow** (new), **Change motivation (Additional program creation)** (new), **Onboarding program commit gate**, **Program draft step**.
- **`docs/adr/0003-additional-program-creation-shape.md`** — five sub-decisions and 8 rejected alternatives for the product shape.
- **`docs/adr/0004-embedded-agent-thread-purpose-column.md`** — schema migration shape (`purpose` + `change_motivation` + `bundle_context` columns; partial unique index relaxation; backfill strategy).
- **`file:supabase/functions/embedded-agent/`** — onboarding's Embedded Agent server. This epic extends the handler to route by `purpose` and to consume per-flow prompts.
- **`file:supabase/functions/embedded-agent/prompt.ts`** — refactors to a `prompt/` folder with `shared.ts` + `onboarding.ts` + `additional-program.ts` (ADR 0003 §5).
- **`file:src/components/onboarding/EmbeddedAgent{Chat,Preview,Generating}Step.tsx`** — relocate to `src/components/embedded-agent/` and parameterize (ADR 0003 §follow-ups).
- **`file:src/hooks/useEmbeddedAgentThread.ts`** — resume logic keys on `(user, purpose)`.
- **`file:supabase/functions/mcp/tools/createProgram.ts`** — already deactivates other active programs atomically (lines 366-379). No new MCP tool needed for active-program-switch.
- **`file:supabase/functions/_shared/aiQuota.ts`** — `embedded_draft` cap bumps from `3` → `10` (rationale in ADR 0003 §follow-ups).
- Parent epic **#295** (closed) — onboarding's Embedded Agent migration; this is its post-onboarding sibling.
- Companion: **#342** — Quick Workout migration; sequenced for the `generate-program` deletion (this epic does not own that deletion).
- Related: **#282** (bilan mensuel — third Embedded Agent flow, will inherit the multi-flow thread schema this epic ships).
- Related: **#290** (`set_active_program` tool — *not* needed by this epic since `create_program` already owns activation).

---

## Architectural shape — v1 lock

Captured here so tickets cannot re-litigate; full reasoning in **ADR 0003** + **ADR 0004**.

**Flow shape** (replaces `ai-constraints` → `ai-generating` → `ai-preview` in `CreateProgramPage`):

```
PathChoice (existing):
  User picks AI / Template / Blank. Template and Blank are unchanged.

AI branch (new):
  → EmbeddedAgentChatStep    (relocated to src/components/embedded-agent/)
       Edge thread loads with purpose='additional_program'
       Pre-loaded bundle captured at thread open (profile + active program summary + 4w stats)
       Bundle persisted in embedded_agent_threads.bundle_context
       Agent elicits change motivation conversationally
       Ready signal carries motivation:
         READY_FOR_PROGRAM_DRAFT: {"ready":true,"summary":"...","motivation":"plateau"}

  → EmbeddedAgentGeneratingStep  (relocated)
       Calls /draft (existing endpoint), returns draft program shape
       embedded_draft quota burn (cap 3 → 10)

  → EmbeddedAgentPreviewStep   (relocated)
       Renders draft + rationale
       User confirms → MCP create_program (dry_run: false)
       create_program deactivates any other active program atomically
       Thread transitions to committed
       Navigate to /library/programs
```

**What does NOT change in v1:** `CreateProgramPage`'s path-choice step orchestration, Template branch, Blank branch, the existing onboarding flow (it keeps using the same components, just at their new location with `namespace="onboarding"`), `create_program`'s behavior, the Embedded Agent's transport (server → MCP via `MCP Edge Function URL`, user JWT as bearer).

**What changes in v1 (with visible UX implication):** The AI branch of `CreateProgramPage` is a chat surface instead of a constraints form. `AIConstraintStep` is deleted from this flow.

**What changes in v1 (no UX implication):** `embedded_agent_threads` gains three columns + a `(user_id, purpose)`-keyed partial unique index. Components move from `src/components/onboarding/` to `src/components/embedded-agent/`. `prompt.ts` refactors to a folder with shared + per-flow files. Onboarding's `OnboardingPage.tsx` imports update to the new component location and pass `namespace="onboarding"` + `purpose="onboarding"`.

**What dies in v1:** `file:src/hooks/useAIGenerateProgram.ts`, `file:src/components/create-program/AIGeneratingStep.tsx`, `file:src/components/create-program/AIProgramPreviewStep.tsx`, `file:src/components/create-program/AIConstraintStep.tsx`, the `ai-constraints` / `ai-generating` / `ai-preview` wizard step types in `CreateProgramPage`.

**What does NOT die in v1:** `file:supabase/functions/generate-program/` — that deletion sequences with #342 (Quick Workout migration). See below.

### Sequencing with #342

Both epics block deletion of `file:supabase/functions/generate-program/`. Per the issue body and the #342 Epic Brief:

- **Default expectation: #342 ships first.** Quick Workout's MCP write-tool decisions (`create_workout_day` shape, `dry_run`, `destructiveHint`) tend to dictate the shared MCP surface; ADR 0002 already locked them. By the time this epic ships, the post-onboarding wizard becomes the *last caller* of `generate-program` — and gets cleaned up here. **`generate-program` deletion then moves to #342's closing act once this epic's post-onboarding wizard cleanup is in.** Per the #342 brief, this is the "#343 ships first" branch — they explicitly accept this sequencing.
- **If #343 ships first** (this epic): `generate-program` stays alive for Quick Workout AI until #342 lands. This epic deletes only its *callers* in `src/`.
- **No circular dependency**: tool / schema decisions land in each epic's ADR independently; Edge function deletion is plumbing that follows whichever epic finishes second.

This epic does **not** own the `generate-program/` directory deletion.

---

## User Stories

1. As a **returning PWA user** opening `/library/programs/create` and picking **AI**, I want a **chat surface** (not a constraints form), so that I can describe *why* I want a new program in my own words instead of guessing which chip group encodes "I'm bored of push/pull/legs".

2. As a **returning PWA user**, I want the agent to **open with a greeting that references my current program and recent training** ("I see you're on a 4-day hypertrophy plan and you've been pretty consistent lately — what's pushing you to switch?"), so that I'm not retreading what the app already knows about me.

3. As a **returning PWA user** mid-plateau, I want the agent to **acknowledge specific signals** (e.g. "your bench has been flat for 6 weeks") when I bring up the plateau, so that the conversation feels grounded in my actual data and not in a generic coach script.

4. As a **returning PWA user with an injury** ("my left shoulder is acting up"), I want the agent to **classify my motivation as `injury` and adjust the draft accordingly** (avoiding aggravating exercises), so that the resulting program respects the constraint without me having to explain it twice.

5. As a **returning PWA user with no specific reason** ("I just want something different"), I want the agent to **accept `other` as a valid motivation** without grilling me into picking a label that doesn't fit, so that I'm not blocked behind theatre.

6. As a **returning PWA user** who has discussed my goals, I want the agent to **emit a ready-for-draft signal** when it has enough context (and not before), so that I'm not waiting for a draft while it's still asking questions, nor stuck answering questions when the draft is ready.

7. As a **returning PWA user reviewing the draft**, I want **the same preview step as onboarding** (per-day exercise breakdown, sets/reps/rest, regenerate button, commit button), so that the UX is consistent across my first and Nth program.

8. As a **returning PWA user**, I want **`Create program`** to **commit via MCP `create_program`** (with `dry_run: true` → confirm → `dry_run: false`), so that the same commit gate that protects me in onboarding protects me here — agent proposes, I decide.

9. As a **returning PWA user**, I want the new program's **commit to atomically deactivate my previous active program** (existing `create_program` behavior), so that I don't end up with two "active" programs and confused workout-day routing.

10. As a **returning PWA user** who closes the tab mid-conversation, I want to **resume my draft thread** when I come back to `/library/programs/create`, so that I don't have to restart the chat from scratch.

11. As a **returning PWA user** with an open additional-program thread, I want to **simultaneously have an open onboarding thread** (if I ever ended up in that state via a multi-device edge case), so that the schema's "one active thread per user" constraint isn't applied across unrelated flows.

12. As a **returning PWA user** who hits the `embedded_chat` or `embedded_draft` quota cap, I want a **clear cap message** + a friendly recovery path, so that I understand my window has limits and I know my Template / Blank options still work.

13. As a **returning PWA user offline**, I want the AI path to be **clearly unavailable** (offline copy + escape to Template / Blank), so that I don't tap into a dead chat.

14. As a **returning PWA user** whose agent fails to classify motivation correctly (the model returned an invalid `motivation` value), I want a **retry path** + a friendly "let's try that again" message, so that one model burp doesn't bail me out of the flow.

15. As a **returning PWA user with no active program** (rare edge case — manual deactivation), I want the agent to **handle the empty active-program state gracefully** (greet without "I see you're on a 4-day plan"), so that the absence of a current program isn't a stuck conversation.

16. As a **returning PWA user** whose chat has been idle for 7+ days, I want my thread to **be marked abandoned server-side** on next load (existing staleness rule, applied to my `(user, additional_program)` row), so that I get a fresh chat instead of resuming an obsolete one.

17. As a **returning PWA user**, I want the chat copy to be **consistent with the rest of the app** (FR/EN), with motivation-classification prompts that read naturally in both locales, so that I'm not staring at machine translations.

18. As a **first-time PWA user** in **onboarding**, I want my chat experience to be **identical to today** (no regressions from the component relocation, no behavior drift from the `purpose` discriminator), so that the migration is invisible to my flow.

19. As a **maintainer** auditing per-flow analytics, I want **all `embedded_agent_*` event payloads to carry a `purpose` field** matching `embedded_agent_threads.purpose`, so that funnel queries can group / filter by flow without joining to the thread table.

20. As a **maintainer evaluating commit-rate-by-motivation**, I want **`embedded_agent_preview_committed`** events to include the captured **`motivation`** in their payload, so that I can answer "do plateau-motivated users commit at higher rates than variety-motivated ones?" from a single event stream.

21. As a **maintainer investigating a stuck thread**, I want **the thread's `purpose`, `change_motivation`, and `bundle_context` columns to be queryable from server-side logs / Sentry context**, so that I can debug without reconstructing state from the transcript alone.

22. As a **maintainer** of the **Embedded Agent** prompt surface, I want the system prompt code to live in a **`prompt/`** folder with `shared.ts` + `onboarding.ts` + `additional-program.ts`, so that flow-specific scope rules and signal schemas can diverge cleanly while cross-cutting truths (locale instruction, brand rules) stay in one place.

23. As a **maintainer**, I want the **per-flow ready-signal validators** (one for onboarding, one for additional-program) to be **independently tested**, so that adding `motivation` to additional-program's schema cannot regress onboarding's signal acceptance.

24. As a **maintainer**, I want the **`embedded_agent_threads.purpose` migration** to **backfill existing rows to `'onboarding'`** via the `DEFAULT 'onboarding' NOT NULL` clause on `ADD COLUMN`, so that no manual backfill script is needed and no row is left with NULL.

25. As a **maintainer**, I want the **partial unique index swap** (`(user_id) → (user_id, purpose)`) to happen **inside the same migration** as the column addition, so that there's no window where the old constraint is gone but the new one isn't in place, and so the relaxation is strictly weaker than the prior constraint (no concurrent-write violations possible).

26. As a **maintainer** of `useEmbeddedAgentThread`, I want the **resume logic to key on `(user, purpose)`**, so that the same hook serves both onboarding and additional-program callers without behavior collisions.

27. As a **maintainer** of `src/components/onboarding/`, I want **`EmbeddedAgent{Chat,Preview,Generating}Step.tsx`** (and their tests) **relocated to `src/components/embedded-agent/`** and parameterized with `namespace` + flow-specific fallback handlers, so that the directory reflects the actual domain and bilan mensuel (#282) lands somewhere that already exists.

28. As a **maintainer**, I want the i18n keys for the additional-program chat to live under the **existing `create-program` namespace** (extended, not forked), so that the page-level namespace convention stays intact.

29. As a **maintainer** of `_shared/aiQuota.ts`, I want **`embedded_draft`** bumped from **`3` → `10`** at v1, with the rationale inline (engaged user creates ~6 programs / year × ~1.5 drafts each with regenerates = ~9 / year peak), so that repeat-creation traffic doesn't immediately saturate the lane sized for onboarding's once-per-user assumption.

30. As a **maintainer**, I want **`useAIGenerateProgram`, `AIGeneratingStep` (under `create-program/`), `AIProgramPreviewStep`, and `AIConstraintStep` deleted** as part of this epic (after the new path is wired and live), so that the codebase has one AI program creation path, not two.

31. As a **maintainer planning evals**, I want the **motivation classification reliability** flagged as a follow-up (post-launch eval suite if "other" rate is suspiciously high or visible misclassifications surface), so that we have a documented signal-to-action loop without blocking v1 on eval scaffolding.

### Success measures

| Story # | Measure |
|---|---|
| 2, 3 | Manual review on staging: agent's opening message references at least one concrete fact from the pre-loaded bundle (program name, day count, recent training cadence) for users with an active program; for empty-active-program users, opens without fabricated references |
| 6, 14, 23 | Per-flow ready-signal validator tests pass: onboarding accepts the legacy `{ready, summary}` shape; additional-program rejects payloads missing or mis-valued `motivation`; both validators have unit tests |
| 9 | Existing `create_program` rollback test coverage applies — no new measure needed, but verified by an integration test that asserts post-commit there is exactly one active program |
| 10, 11, 16, 26 | Thread resume on `/library/programs/create` returns the user's `(user, 'additional_program')` row when it exists; concurrent `(user, 'onboarding')` rows are not affected; staleness rule (7d) applies independently per row |
| 18 | Existing onboarding E2E + unit tests continue to pass after the component relocation and the `prompt/` folder refactor — non-negotiable regression gate |
| 19, 20, 21 | All `embedded_agent_*` events carry `purpose`; `embedded_agent_preview_committed` carries `motivation` when present; verified by analytics dispatch test or grep + manual inspection |
| 24, 25 | Migration applied to a copy of production data leaves zero rows with NULL `purpose`; index swap completes in the same transaction; verified by migration test or staging dry-run |
| 29 | `embedded_draft` cap is `10` in `QUOTA_REGULAR_BY_SOURCE` post-merge; inline comment cites this brief / ADR 0003 follow-ups |
| 30 | After epic completion, `git ls-files src/hooks/useAIGenerateProgram.ts src/components/create-program/AI*.tsx` returns empty (excepting non-AI files in that directory if any) |
| Tests scope | **One Playwright happy-path E2E** covering path-choice → AI → chat (1-2 turns) → motivation classified → draft → preview → commit, with Gemini mocked (no real LLM in CI). Plus the existing Embedded Agent test suite generalized to cover both `purpose` values. |

Stories without a numeric measure are validated qualitatively via the story itself or by code review against the canonical glossary / ADR entries.

---

## Scope

**In scope:**

1. **Schema migration** — add `purpose` (TEXT + CHECK, NOT NULL, default `'onboarding'`), `change_motivation` (TEXT + CHECK, nullable), `bundle_context` (JSONB, nullable) to `embedded_agent_threads`. Drop existing partial unique index, create `(user_id, purpose) WHERE status IN ('open','preview_ready')`. Single migration file, transactional.
2. **`embedded-agent` Edge function changes** — handler routes by thread `purpose`; on thread open for `additional_program`, fetches and persists the **pre-loaded bundle** (profile + active program summary + 4-week training stats) into `bundle_context`; per-flow prompt builder selection; per-flow ready-signal validator (additional-program requires `motivation`); thread lifecycle (resume / staleness / abandonment) keyed on `(user, purpose)`.
3. **System prompt restructure** — `prompt.ts` → `prompt/{shared,onboarding,additional-program}.ts` + colocated tests. Additional-program scope rules explicitly require change-motivation elicitation; user-context builder consumes the bundle.
4. **Bundle composition** — new server-side function (`buildAdditionalProgramBundle(userId)`) producing the snapshot shape. Lives in `embedded-agent/` or `_shared/` per Tech Plan.
5. **Quota bump** — `embedded_draft: 3 → 10` in `file:supabase/functions/_shared/aiQuota.ts`, with rationale comment.
6. **Component relocation + parameterization** — `EmbeddedAgent{Chat,Preview,Generating}Step.tsx` (and tests) move from `src/components/onboarding/` to `src/components/embedded-agent/`. New props: `namespace: 'onboarding' | 'create-program'`, `purpose: ThreadPurpose`, plus existing fallback handlers stay. `useTranslation` consumes the new `namespace` prop instead of hardcoded `"onboarding"`.
7. **PWA wiring change** — `CreateProgramPage`'s AI branch swaps `ai-constraints` / `ai-generating` / `ai-preview` for the relocated Embedded Agent components, passing `purpose="additional_program"` + `namespace="create-program"`. `OnboardingPage`'s imports update; same components, new path, explicit `purpose="onboarding"` + `namespace="onboarding"`.
8. **`useEmbeddedAgentThread` resume logic** — accept a `purpose` parameter; route Edge requests with it; resume the matching `(user, purpose)` row.
9. **Analytics extension** — extend all `embedded_agent_*` event payloads with `purpose`; add `motivation` to `embedded_agent_preview_committed` payload when present.
10. **i18n** — extend the `create-program` namespace with the chat / motivation / commit copy keys (FR + EN). The `locale` flow on every Edge request stays as-is.
11. **Decommission** — delete `file:src/hooks/useAIGenerateProgram.ts`, `file:src/components/create-program/AIGeneratingStep.tsx`, `file:src/components/create-program/AIProgramPreviewStep.tsx`, `file:src/components/create-program/AIConstraintStep.tsx`, and the obsolete wizard step types in `file:src/pages/CreateProgramPage.tsx`.
12. **Glossary patches** — already landed in this session (`Additional program creation flow`, `Change motivation (Additional program creation)`, extended `Embedded Agent thread` + `Embedded Agent thread lifecycle`, sharpened `Embedded Agent onboarding (v1)`). No further glossary churn unless tickets surface a gap.
13. **Tests** — explicit minimum bar:
    - **Server-side unit / integration:** thread purpose routing; bundle composition (happy + empty-active-program + missing-profile edge cases); per-flow ready-signal validators (both flows, both happy and error paths); migration smoke test against a copy of staging data (no NULL `purpose` rows post-migration); index relaxation does not regress onboarding's "one active thread per user-per-purpose" guarantee.
    - **Client-side:** `EmbeddedAgentChatStep` renders with each `namespace` prop; existing onboarding tests pass post-relocation; new `purpose` prop is wired through.
    - **Resume logic:** `useEmbeddedAgentThread` returns the right row for `(user, purpose)`; doesn't return cross-purpose rows.
    - **E2E (mandatory, scoped):** **one** Playwright happy-path test that runs `/library/programs/create` → AI → chat (1-2 user turns, mocked Gemini response classifying motivation) → ready signal → preview → commit, asserting a `programs` row + `workout_days` + `workout_exercises` rows land via `create_program`. **Gemini MUST be mocked** — never hit the real provider in CI.

**Out of scope:**

- **Deletion of `file:supabase/functions/generate-program/`** — owned by #342 per the sequencing branch.
- **Adding in-conversation MCP read tools** (`getWorkoutHistory`, `getTrainingStats`, etc.) — ADR 0003 §2: pre-loaded bundle only in v1.
- **A "skip the chat" UI escape** for power users — ADR 0003 §3: deferred to post-launch decision based on abandonment metrics.
- **Continuous-coaching surface** (proactive nudges, "revisit in 4 weeks" reminders, ongoing thread for the same program) — the issue body floated this framing; we explicitly de-framed it. The surface is still one-shot-per-creation.
- **Multiple active programs** — the schema continues to enforce one active program per user; `create_program` continues to atomically deactivate others on commit.
- **Modifying the existing active program in place** — this flow always creates a *new* program; editing the active one stays in the existing program-edit UI (out of scope here).
- **`set_active_program` MCP tool (#290)** — `create_program` already owns activation atomically; this epic does not require a separate tool.
- **Motivation classification eval suite** — flagged as post-launch follow-up (Story 31).
- **Refreshing `bundle_context` mid-thread** — captured-once semantics is intentional (ADR 0003 §2).
- **A new analytics event taxonomy** — reuse existing `embedded_agent_*` events with the `purpose` payload field (ADR 0003 §follow-ups).
- **Onboarding UX or copy changes** — the migration is invisible to onboarding by design.

---

## Success Criteria

- **Qualitative — coaching feels grounded**: A manual run of the AI path on staging with a user account that has an active program and ≥4 weeks of training history shows the agent's opening message referencing concrete bundle facts (program name, recent cadence, top muscle groups) — not a generic "tell me about your goals".
- **Qualitative — motivation gate works**: A manual run where the user types "I want a new program" (without any motivation) shows the agent probing for *why* before drafting; the ready signal is not emitted until a motivation is captured.
- **Qualitative — onboarding regression-free**: Existing onboarding E2E + unit tests pass post-component-relocation and post-prompt-refactor; a manual run of `/onboarding` AI path shows no visible behavior change.
- **Qualitative — cleanup complete**: After this epic ships, `git ls-files src/hooks/useAIGenerateProgram.ts 'src/components/create-program/AI*.tsx'` returns empty.
- **Qualitative — schema migration safe**: `embedded_agent_threads` rows in production all have non-NULL `purpose` post-migration; the partial unique index allows one `'open'/'preview_ready'` row per `(user_id, purpose)` and rejects duplicates.
- **Qualitative — MCP write surface unchanged**: Every AI-generated additional program lands via `create_program` (same path as onboarding); raw inserts from `AIProgramPreviewStep` no longer exist in the codebase.
- **Qualitative — quota observability**: `embedded_chat` and `embedded_draft` rows in `ai_generation_log` distinguish flows via thread `purpose` (joined or denormalized — Tech Plan decides whether to denormalize `purpose` onto `ai_generation_log` rows).
- **Engineering**: RLS on `embedded_agent_threads` continues to scope reads/writes to the calling user; the new columns inherit existing policies.

---

## Decisions already locked (see `docs/CONTEXT.md` and ADRs 0003 / 0004)

Ubiquitous-language entries **Additional program creation flow**, **Change motivation (Additional program creation)**, the extended **Embedded Agent thread** entry, the `(user, purpose)`-keyed **Embedded Agent thread lifecycle** Resume rule, and the sharpened **Embedded Agent onboarding (v1)** entry — these should not be re-litigated in tickets except via explicit ADR amend or glossary update.

Five sub-decisions captured in **ADR 0003** with 8 rejected alternatives:

1. Pure chat — no constraints form on the AI branch (vs. hybrid form-first + nuance chat; vs. skippable form).
2. Pre-loaded context bundle at thread open; **zero in-conversation MCP tool calls** in v1 (vs. cold-open agent with on-demand tools; vs. pre-loaded core + tools for depth).
3. Hard motivation gate via per-flow ready-signal validator, controlled vocab + `other` fallback (vs. soft guidance; vs. skip path with UI escape).
4. Ready signal carries `motivation` in its JSON payload — single signal (vs. separate `MOTIVATION_CAPTURED:` side-channel earlier in conversation).
5. Hybrid prompt folder — `prompt/{shared,onboarding,additional-program}.ts` (vs. pure branching; vs. parameterized single file).

Five sub-decisions captured in **ADR 0004** with 5 rejected alternatives:

1. `purpose` column on existing `embedded_agent_threads` (vs. sibling `additional_program_threads` table).
2. `TEXT + CHECK` for `purpose` (vs. Postgres `ENUM` — pain to extend).
3. `change_motivation` column nullable, controlled vocab (vs. drop the structure and rely on transcript parsing).
4. `bundle_context` persisted JSONB, captured-once at thread open (vs. recompute on every turn; vs. per-purpose bundle columns).
5. Index swap `(user_id) → (user_id, purpose)` in the same migration as column adds (vs. multi-step migration).

Additional locked-in points not in the ADRs but in the glossary:

- **Component reuse strategy**: relocate to `src/components/embedded-agent/` + parameterize (vs. parameterize in-place; vs. fork into `create-program/`).
- **Quota strategy**: share `embedded_chat` (cap unchanged at 40) and `embedded_draft` (cap bumped 3 → 10) lanes with onboarding (vs. fork sources per flow; vs. single new `embedded_program_revision` source).
- **Analytics**: reuse `embedded_agent_*` events with a `purpose` payload field matching the thread schema (vs. forked event names; vs. `flow`-named field with different vocabulary).
- **Active program switch**: `create_program` already owns it atomically — no separate tool needed.
- **Post-commit navigation**: `/library/programs` (parity with current `AIProgramPreviewStep` behavior).

---

## Open points for Tech Plan

- **Bundle composition shape** — exact JSONB shape for `bundle_context`: column-by-column profile snapshot vs. the existing `UserContextProfile` shape; active program summary fields (just `{ name, days_count, day_labels[], exercises_per_day[] }` or richer?); 4-week stats fields (`{ completed_sessions, top_muscle_groups[], plateau_flags[] }` — what counts as a plateau flag?). Decide and document.
- **`bundle_context` storage location** — JSONB column on `embedded_agent_threads` (locked) but: do we also persist a denormalized `purpose` on `ai_generation_log` rows so analytics queries don't need a join? Cheap denormalization; recommended yes.
- **Bundle builder location** — `supabase/functions/embedded-agent/lib/bundle.ts` or `_shared/`? If `_shared/`, future flows (bilan mensuel) can reuse. Default: `_shared/embeddedAgentBundle.ts`.
- **Empty active-program handling** — Story 15: a user with no active program (deleted / deactivated manually). Bundle reports `active_program: null`; agent's system prompt needs to handle this without fabricating ("I see you're on..."). Specify the prompt rule + a test.
- **Component prop API** — exact prop signature for the relocated components: `namespace` strongly typed (`'onboarding' | 'create-program'`)? `purpose` as a separate prop, or derived from `namespace`? Default: pass both explicitly — they're related but not redundant (e.g. future flow may share `create-program` namespace but have a different `purpose`).
- **Fallback handler routing** — additional-program flow's `onFallbackTemplate` / `onFallbackBlank` routes back to `CreateProgramPage`'s path-choice step; onboarding's routes to its own path-choice. Concrete handlers per page.
- **i18n key naming** — convention for additional-program chat keys under the `create-program` namespace (e.g. `create-program:ai.chat.*`, `create-program:ai.motivation.*`, `create-program:ai.preview.*`). Settle and document.
- **Motivation classification prompt copy** — the FR + EN system prompt instructions for eliciting + classifying motivation. Drafts welcome at Tech Plan time; final copy in tickets.
- **Resume UX** — when a user lands on `/library/programs/create` and an open `(user, additional_program)` thread exists: silently resume? Show a "Resume your draft / Start over" choice? Onboarding silently resumes; matching that for parity.
- **Tests for the prompt folder refactor** — colocated `*_test.ts` per file; the shared parser core test stays unified. Decide whether to keep the existing `prompt_test.ts` or split it into `prompt/{shared,onboarding,additional-program}_test.ts`.
- **`ai_generation_log` schema** — does the table have a column we can store `purpose` in, or do we add one? If adding, tiny migration in this epic. Otherwise denormalize the join.
- **`useEmbeddedAgentThread` API change** — accepts `purpose` parameter or two hook variants (`useOnboardingThread`, `useAdditionalProgramThread`)? Default: single hook with `purpose` parameter (keeps the resume mechanics in one place).
- **Sentry / structured logging** — confirm Sentry context tags include `purpose` and `change_motivation` when present; small breadcrumb plumbing.
- **Feature flag?** — onboarding's Phase B used a flag for staged rollout. This surface has lower traffic than onboarding (only triggered when a user creates an additional program). Default position: **no flag**, ship behind tests + soak period; failure mode (regression of AI program creation on `/library`) is recoverable via Template / Blank paths the user already has.

---

## References

- GitHub **#343** (this epic)
- GitHub **#342** (companion — Quick Workout migration, owns `generate-program` deletion)
- GitHub **#295** (parent — onboarding Embedded Agent migration)
- GitHub **#282** (bilan mensuel — third Embedded Agent flow, inherits the multi-flow thread schema)
- GitHub **#290** (`set_active_program` tool — not needed by this epic)
- **`docs/CONTEXT.md`** (entries: Embedded Agent, Embedded Agent thread, Embedded Agent thread lifecycle, Embedded Agent onboarding (v1), Additional program creation flow, Change motivation (Additional program creation), Onboarding program commit gate, Program draft step)
- **`docs/adr/0003-additional-program-creation-shape.md`**
- **`docs/adr/0004-embedded-agent-thread-purpose-column.md`**
- **`docs/adr/0002-quick-workout-ai-mcp-migration.md`** (companion ADR; the source-by-shape naming convention)
- **`docs/Epic_Brief_—_Quick_Workout_AI_to_Embedded_Agent_+_MCP_#342.md`** (companion brief)
- `file:src/pages/CreateProgramPage.tsx`
- `file:src/components/create-program/AIConstraintStep.tsx`
- `file:src/components/create-program/AIGeneratingStep.tsx`
- `file:src/components/create-program/AIProgramPreviewStep.tsx`
- `file:src/hooks/useAIGenerateProgram.ts`
- `file:src/components/onboarding/EmbeddedAgentChatStep.tsx`
- `file:src/components/onboarding/EmbeddedAgentPreviewStep.tsx`
- `file:src/components/onboarding/EmbeddedAgentGeneratingStep.tsx`
- `file:src/hooks/useEmbeddedAgentThread.ts`
- `file:supabase/functions/embedded-agent/`
- `file:supabase/functions/embedded-agent/prompt.ts`
- `file:supabase/functions/mcp/tools/createProgram.ts`
- `file:supabase/functions/_shared/aiQuota.ts`
- `file:supabase/migrations/20260508155713_create_embedded_agent_threads.sql`
