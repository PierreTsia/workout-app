# ADR 0003 — Additional program creation flow shape

- **Status:** Accepted
- **Date:** 2026-05-12
- **Decided in:** grilling session on branch `feat/343/create-program-embedded-agent`

## Context

#295 / #338 migrated the AI program flow inside **onboarding** to the **Embedded Agent** + **`create_program`** commit gate. The same wizard exists post-onboarding at `/library/programs/create` (path "AI") and is still on the legacy closed-loop, bypassing MCP entirely:

- **UI**: `file:src/pages/CreateProgramPage.tsx` → `file:src/components/create-program/AIGeneratingStep.tsx` + `file:src/components/create-program/AIProgramPreviewStep.tsx`
- **Hook**: `file:src/hooks/useAIGenerateProgram.ts`
- **Edge function**: `file:supabase/functions/generate-program/`
- **Persistence**: raw `programs` + `workout_days` + `workout_exercises` inserts. No MCP, no commit gate.

The forces at play that distinguish *this* migration from the onboarding one (#295):

1. **The user is not a blank slate.** They already have a profile, almost certainly an active **Program**, weeks or months of training history, and exercise-level progression signals. The agent's job is qualitatively different — read history before drafting, not "fill qualitative gaps" on a fresh questionnaire.
2. **They have a *reason* to want a new program.** Variety, plateau, injury, priority shift, new equipment, return from break. Eliciting and capturing that **change motivation** is the single most underrated input — and it doesn't fit in a chip group. A form-first wizard structurally cannot extract it without an awkward "Why do you want a new program?" textarea.
3. **The legacy form was load-bearing for onboarding but not for this surface.** The **Onboarding form** decision (kept the questionnaire to avoid drop-off and losing hard constraints for first-time users) does not transfer. Returning users have the profile already; re-collecting it is friction.
4. **Repeat creation is repeatable.** The economic / quota model that assumed "once per user" for onboarding's draft generation is wrong here. We expect 4-6 program creations per engaged user per year.
5. **Vocabulary debt.** The existing glossary term `Embedded Agent onboarding (v1)` collapsed the channel (**Embedded Agent**) and the flow (onboarding's program creation) into one label. A sibling flow exposes the conflation: same channel, different product purpose.

The issue body (#343) framed this as "continuous coaching, not 'create program v2'", but the grilling session pulled back from that framing — the surface is still one-shot-per-creation, no recurring touchpoints. Calling it continuous coaching front-loads a product promise we haven't committed to. The right framing is "the same Embedded Agent doing a categorically different task".

## Decision

We will migrate the post-onboarding AI program creation wizard to the **Embedded Agent** with **five coupled sub-decisions**.

### 1. Pure chat — no constraints form

`AIConstraintStep` is deleted from this branch of the wizard. The user picks "AI" from the path-choice step and lands directly in an Embedded Agent chat — no chips, no pre-form, no structured input. The agent's job is to elicit motivation and any constraint nuance conversationally.

This explicitly diverges from onboarding, which keeps **Onboarding form**. Justification: returning users have a profile (the structured constraints already exist), and forcing them through a form locks in a wrong default (the user picks "hypertrophy" because it's pre-filled, then *actually* wants to deload).

### 2. Pre-loaded context bundle, zero in-conversation tool calls

When the thread opens, the Edge function fetches a fixed bundle:

- **Profile**: goal, experience, equipment, days/week, session duration, age, gender (the existing `generate-program` profile shape).
- **Active program summary**: name, day count, day labels, exercise counts per day.
- **4-week training stats**: completed sessions, top muscle groups by volume, plateau flags (exercises with no PR in 4+ weeks).

The bundle is injected into the system prompt as static context and **persisted on the thread row** (`embedded_agent_threads.bundle_context`, JSONB) — captured once at thread open, never refreshed during the conversation. The agent makes **zero MCP read calls** during the chat in v1.

Trade-off accepted: snapshot can be 1-7 days stale by the end of a paused conversation. Acceptable because the 7-day staleness rule abandons threads anyway, and the data drift in a week is minor relative to the conversation cost.

This is *not* a one-way door. If post-launch evidence shows conversations frequently asking for data we didn't pre-load, we can add narrow read tools (`getWorkoutHistory` with date filter) later. The reverse direction — taking capability away once the model has it — is much harder.

### 3. Hard motivation gate with controlled vocabulary

The agent's system prompt requires eliciting and classifying a **Change motivation (Additional program creation)** before emitting the `READY_FOR_PROGRAM_DRAFT` signal. Controlled vocab: `variety | plateau | injury | priority_shift | equipment_change | return_from_break | other`. The `other` value is intentionally permitted so users who genuinely have no specific reason ("I just want variety in my routine") aren't blocked behind theatre.

Enforcement lives in the **ready-signal validator** (per-flow): a ready signal without a valid `motivation` field is rejected, and the model is asked to try again. The validator is the gate; the system prompt is the instruction. We trust the model with the classification — if post-launch analytics show high "other" rates or visible misclassification, that's the signal to add an eval suite for motivation classification.

Persisted on the thread row (`embedded_agent_threads.change_motivation`) and surfaced in the `embedded_agent_preview_committed` analytics event payload so funnel queries can compare commit rates by motivation.

### 4. Ready signal carries motivation in its JSON payload

Single-signal capture: the existing `READY_FOR_PROGRAM_DRAFT: {...}` line is extended for this flow to include the `motivation` field:

```
READY_FOR_PROGRAM_DRAFT: {"ready":true,"summary":"<recap>","motivation":"plateau"}
```

Onboarding's signal stays as-is (`motivation` field absent). The shared `parseReadySignal` mechanics (regex + JSON.parse) are unchanged; only the **per-flow schema validator** differs — onboarding accepts the original shape, additional-program requires the `motivation` field present and matching the controlled vocab.

We considered a separate `MOTIVATION_CAPTURED:` side-channel that fires earlier in the conversation. Rejected for v1: the analytical value (motivation-capture-rate as an independent funnel step) doesn't justify the second signal-handling code path. If we later want that visibility, the side-channel is additive.

### 5. System prompt: hybrid folder structure with shared primitives

`supabase/functions/embedded-agent/prompt.ts` (current single file) refactors to:

```
prompt/
  shared.ts            # LOCALE_INSTRUCTION, parseReadySignal regex core, "no provider namedrop" rule
  onboarding.ts        # existing scope rules + buildUserContext (profile only) + onboarding signal validator
  additional-program.ts  # new scope rules + buildUserContext (profile + bundle) + motivation-required signal validator
```

Each flow file imports `shared.ts` and composes its own prompt + per-flow signal schema validator. Tests colocated per file.

Trade-off accepted: a folder restructure of a 117-line file. Justification: pure branching (`prompt-onboarding.ts` + `prompt-additional-program.ts`) silently duplicates `LOCALE_INSTRUCTION` and the "never namedrop provider" brand rule — those are *cross-cutting GymLogic concerns*, not per-flow choices, and they must never diverge. Parameterization (one `prompt.ts` with `purpose` branching) accumulates conditional creep and makes every change risk the other flow.

## Consequences

- **Positive:**
  - Vocabulary debt cleared — channel (**Embedded Agent**) and flow (**Additional program creation flow** / **Embedded Agent onboarding (v1)**) now have separate names in the glossary.
  - The change-motivation hypothesis is testable: we'll have structured data on what fraction of users cite plateau vs variety vs injury *from day one*, not as a post-launch retrofit.
  - Maximum code reuse with onboarding — same `EmbeddedAgent{Chat,Preview,Generating}Step` components (after relocation to `src/components/embedded-agent/`), same hooks, same MCP commit gate, same thread lifecycle. The diff is prompt + bundle + ready-signal-schema, not a parallel UI tree.
  - `create_program` MCP tool already deactivates other active programs atomically — zero work needed for active-program-switch.
  - Component relocation (`onboarding/` → `embedded-agent/`) sets up a clean home for future flows (#282 bilan mensuel).
- **Negative:**
  - Adversarial users ("just give me a 5-day strength program, stop asking") will hit the motivation gate. The `other` fallback is a real escape but the chat is still a chat — power-user speed is sacrificed for v1. Mitigation: watch abandonment-during-elicitation as a metric; if high, bolt on a UI "skip" path post-launch.
  - The pre-loaded bundle is a fixed snapshot. Conversations that surface needs we didn't pre-load (e.g. "tell me about my bench progression specifically") will get generic answers. Mitigation: add narrow read tools post-launch if analytics show this.
  - The per-flow signal validator is a small but real piece of new code that must keep onboarding's signal accepting unchanged. Test coverage on both validators is non-negotiable.
- **Follow-ups:**
  - ADR 0004 records the schema migration that this product shape requires (`purpose` + `change_motivation` + `bundle_context` columns; partial unique index relaxation).
  - Bump `embedded_draft` quota cap from `3` → `10` in `file:supabase/functions/_shared/aiQuota.ts` to accommodate repeat-creation traffic. Documented inline next to the `quick_workout` rationale.
  - Delete `useAIGenerateProgram`, `AIGeneratingStep` (under `create-program/`), `AIProgramPreviewStep` once the new flow ships. `supabase/functions/generate-program/` deletion is sequenced with #342.
  - Analytics: extend all `embedded_agent_*` event payloads with a `purpose` field matching the thread schema; include `motivation` in `embedded_agent_preview_committed` payload.
  - Motivation classification reliability — if "other" rate is suspiciously high post-launch, add an eval suite.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **Hybrid form-first + chat for nuance only** (form → 1-3 motivation questions → draft) | Forces the user to pick `goal/daysPerWeek/etc.` before they've articulated *why* they want a new program — locks in wrong defaults. Two interrogations (form + chat) feel worse than one well-designed chat. The form asks for things the profile already has, then the chat asks for nuance — redundant. |
| **Hybrid skip-able form (chip group or "talk to coach")** | Two parallel UX paths, two code paths. The "talk to coach" branch becomes the unloved sibling — analytics will show ~5% usage and the maintenance cost won't pay rent. ADR 0002 split things to *reduce* path multiplicity; this would add it back. |
| **Soft motivation guidance (no hard gate)** | System prompts drift. Without enforcement we'd see this collapse to "just draft something" within 3 weeks. We'd get no structured motivation data — the whole hypothesis becomes untestable. |
| **Skippable motivation gate with UI escape ("Skip and generate" button)** | Defensible but adds UI surface. v1 should test the gate-as-default hypothesis cleanly; if abandonment shows the gate is too friction-y, this is a 1-week bolt-on. |
| **Cold-open agent with on-demand MCP read tools** | Maximum flexibility, but first-message latency becomes unpredictable, cost balloons (every conversation pays for the agent's "let me check..." rounds), and we'd be debugging tool-call loops in production. Onboarding shipped with zero in-conversation tool calls and that pattern works. |
| **Pre-loaded core + on-demand read tools for depth** | Splits the difference but doubles the surface to maintain (bundle composition + tool exposure). Risk of the agent never using the tools and us discovering that in analytics, not at design time. Defer to v2 if needed. |
| **Sibling table `additional_program_threads`** | Forces duplicating the entire **Embedded Agent thread lifecycle** machinery (resume, staleness, abandonment) and 2× the RLS / retention code. Schema purity is theoretical; the maintenance cost is permanent. The NULL-heavy `bundle_context` column smell is a 2-second cost, not a 2-month one. |
| **Pure branching prompts (`prompt-onboarding.ts` + `prompt-additional-program.ts`)** | Silently duplicates `LOCALE_INSTRUCTION` and the "never namedrop provider" brand rule. Those are cross-cutting GymLogic concerns that must never diverge — and copy-paste of cross-cutting concerns is the bad kind of duplication (nobody updates both copies). |
| **Parameterized single prompt (`prompt.ts` with `purpose` branching)** | Conditional creep. The `purpose` parameter leaks into every internal helper, every change risks the other flow, tests get unwieldy. |
