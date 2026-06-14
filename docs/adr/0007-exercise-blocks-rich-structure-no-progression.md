# ADR 0007 — Exercise Blocks: rich structure, no progression engine (v1)

- **Status:** Accepted
- **Date:** 2026-06-13
- **Decided in:** grilling session (`grill-with-docs`) for issue #351 — supersets / circuits

## Context

Issue #351 asks for supersets / circuits — grouping several exercises into a
round-by-round block. The original issue draft proposed the most minimal,
backward-compatible model (**Option A**): two nullable columns on
`workout_exercises` (`group_id` + `group_position`), with the application
invariant that every exercise in a group shares its `sets` (= rounds) and a
single `reps` value per exercise.

User feedback steered toward the **target vision from day one** (Freeletics-style
training): the user explicitly wants **pyramidal blocks** where reps (and weight)
**vary per round** (e.g. 20 → 15 → 10), plus a configurable transition between
exercises inside a round. Option A cannot express per-round prescriptions: today
`workout_exercises.reps` / `weight` is a single scalar applied to all sets.

The user's premise was "doing the target vision isn't much more expensive."
That premise is **true for the schema** but **false for two deep systems**:

1. **The progression engine.** Everything assumes **one prescription per
   exercise**: a single **Progression Suggestion** `{ rule, reps, weight, sets,
   delta }`, scalar **Prescription Snapshot** columns on `set_logs`, and a
   **Last Performance** that anchors one value. A pyramidal exercise has one
   prescription *per round*; the engine has no model for that.
2. **The session UI.** The current single-exercise strip
   (`file:src/pages/WorkoutPage.tsx` → `ExerciseStrip` → `ExerciseDetail`) and
   the mono-stream rest timer (`file:src/components/workout/SetsTable.tsx`,
   `file:src/hooks/useRestTimer.ts`) have no natural place to show per-round
   numbers or transition timers.

## Decision

We will introduce a rich **Exercise Block** model (Option B), but **decouple
structure from intelligence**:

- **Structure ships rich in v1.** A block carries an ordered list of exercises,
  a round count, a block-level `rest_seconds` (between rounds) and
  `transition_seconds` (between exercises within a round), and a **per-round
  prescription** for each (exercise × round) cell of shape `{ amount, weight }`
  where `amount` is reps or duration.
- **Intelligence stays flat in v1.** Exercises inside a block are **excluded
  from the progression engine**: no **Progression Suggestion**, no per-round
  **Prescription Snapshot**, no auto-applied **Progression Rule**. The
  prescription is frozen; the user edits it by hand in the **Builder**. Session
  logging still writes `set_logs` actuals for history.

Coupled product decisions locked in the same session:

1. **Unified day sequence.** A workout day is an ordered list of *items*, each
   item being a solo exercise **or** a block; solos and blocks interleave freely
   and reorder together. (Not separate sections; not "everything is a block".)
2. **What varies per round:** reps/duration **and** weight vary per round;
   `rest_seconds` and `transition_seconds` are block-level scalars in v1
   (round-varying rest is a later, non-breaking refinement: scalar → array).
3. **Dedicated round screen in session** (not the auto-advancing strip), because
   each round renders different numbers under the pyramidal model.
4. **Scope edges:** mixing reps + duration exercises in one block is allowed; the
   same exercise may appear twice in a block; a completed block renders as a
   light grouped history card (not "two solo exercises in disguise"); MCP
   (`create_program` / `create_workout_day`) and AI (Embedded Agent / Quick
   Workout) do **not** produce blocks in v1; grouping/ungrouping during an active
   session is blocked (Builder-only); blocks are exposed directly in the Builder
   with **no** "advanced mode" gate.
5. **Naming — "Block" is internal, "Circuit" is user-facing.** The domain/code
   term is **Exercise Block** (tables `exercise_blocks` / `block_exercises`,
   types `ExerciseBlock*`, hooks `useExerciseBlocks`, i18n **keys** like
   `blockRunner.*` / `createBlock`). It is **technical** and must **never** leak
   into UI copy. Every user-facing string — i18n **values**, button labels,
   dialog titles, history cards — says **"Circuit"** (FR & EN; `circuit`).
   Rationale: "block" reads as engineering jargon to a lifter, whereas "circuit"
   is an established gym word that also covers supersets/trisets. This keeps the
   ubiquitous language honest (code speaks "block", humans speak "circuit") while
   avoiding a churny rename of the schema.

## Consequences

- **Positive:**
  - The data model reaches its target shape immediately; Option A would have
    required a re-migration + builder/session rewrite to add pyramids later.
  - The two most expensive systems (progression engine, in-session strip) are
    **not** touched — the v1 cost is bounded to a new builder surface, a new
    session round screen, and the schema.
  - Block "intelligence" (progression over rounds) becomes a clean downstream
    ticket on an already-correct schema.

- **Negative:**
  - Two prescription models now coexist (flat `workout_exercises` with engine
    progression, vs. blocks with frozen per-round prescriptions). Newcomers must
    learn which path applies. Mitigated by: blocks are visually distinct and
    explicitly out of the engine.
  - The grouped history card adds UI scope beyond the issue's original "looks
    like two solo exercises" note — accepted deliberately because the rich model
    would make a flat history view incoherent.
  - A unified `sort_order` spanning solos and blocks adds builder/persistence
    complexity vs. a flat list.

- **Follow-ups:**
  - Epic Brief + Tech Plan own the concrete schema (table shape, where the
    shared `sort_order` lives, per-round storage as rows vs JSONB), the builder
    grid UX (default "fill round 1, auto-propagate"), and the round-screen
    session component.
  - Progression over blocks (per-round suggestions, snapshots) is an explicit
    future epic — do not pre-build it.
  - MCP / AI awareness of blocks is a later additive bump (legacy-detection
    pattern already proven via `detectLegacyExerciseIds`).

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **A. Nullable `group_id` + `group_position` on `workout_exercises`, single `reps`** | Cannot express per-round prescriptions (pyramids). Would need a re-migration + builder/session rewrite to reach the target vision the user explicitly wants now. |
| **B + progression in v1** | Forces redefining **Prescription Snapshot**, **Last Performance**, and `computeNextSessionTarget` as arrays-of-prescriptions. Doubles cost and risk on the deepest, most-tested system, for intelligence we can add later on the same schema. |
| **C. "Everything is a block" (a solo = 1-exercise, 1-round block)** | Conceptually elegant but a big-bang rewrite of builder, session, history, MCP, and the engine. Blows the budget; rejected. |
| **Separate "blocks" section in the builder** | Rigid and poor UX (can't put a heavy squat *before* a finisher circuit). Rejected in favor of the unified sequence. |
