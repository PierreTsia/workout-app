# ADR 0004 — `embedded_agent_threads.purpose` and multi-flow extensions

- **Status:** Accepted
- **Date:** 2026-05-12
- **Decided in:** grilling session on branch `feat/343/create-program-embedded-agent`

## Context

`embedded_agent_threads` was introduced in #295 / Phase B for a single flow — **Embedded Agent onboarding (v1)** — and its constraints reflect that single-flow assumption. Most visibly: the partial unique index that enforces "at most one open thread per user":

```sql
UNIQUE (user_id) WHERE status IN ('open', 'preview_ready')
```

ADR 0003 introduces a second flow that uses the same channel and table — the **Additional program creation flow**. A user who has a committed onboarding thread and now wants a new program needs to open a *second* thread, against the same table, without the unique index blocking it. The existing constraint reads "user has at most one active conversation, ever" — which is wrong the moment we have two flows that can both be in-flight.

Additionally, ADR 0003 commits to per-thread state that doesn't fit the current columns:

- A captured-at-thread-open **bundle context** (profile + active program + 4-week stats), referenced by every assistant turn.
- A structured **change motivation** (controlled vocabulary), required for the additional-program flow's ready-signal gate, NULL for onboarding.
- A way to distinguish *which flow* a thread belongs to — for resume logic, analytics joins, future flow registration (#282 bilan mensuel will be #3).

This is a schema change on a production table with RLS policies, a partial unique index, and a quota system that reads from it. It's hard to walk back once data flows in. It deserves to exist as a checkpoint.

## Decision

We will extend `embedded_agent_threads` with **five new columns** and relax the partial unique index in a single migration:

- `purpose` — flow discriminator (§1)
- `change_motivation` — controlled-vocab classification, additional-program flow only (§2)
- `bundle_context` — snapshotted user context, additional-program flow only (§3)
- `validator_rejection_count` — bounded retry counter for the ready-signal validator (§4)
- `pending_constraint_overrides` — race-free handoff for validated constraint overrides between `/send` and `/draft` (§5)

The first three are the conceptual core of the multi-flow extension and got grilled out during the brief / Tech Plan phase. `validator_rejection_count` and `pending_constraint_overrides` are *implementation-shape* columns that fell out of T134 (handler wiring) — captured here as part of the same audit trail so future schema spelunkers find the full picture in one place.

### 1. `purpose` column — flow discriminator

```sql
ALTER TABLE embedded_agent_threads
  ADD COLUMN purpose TEXT NOT NULL DEFAULT 'onboarding'
  CHECK (purpose IN ('onboarding', 'additional_program'));
```

- **Type**: `TEXT` with `CHECK` constraint, **not** a Postgres `ENUM`. `ENUM` is a pain to extend (`ALTER TYPE … ADD VALUE` is non-transactional pre-PG12; renaming values is rough). Bilan mensuel (#282) will need a new value soon. `CHECK` constraints are trivial to amend.
- **Default `'onboarding'`** for existing rows; all historical threads are onboarding. The default is also kept post-migration as a backstop — onboarding is the legacy default flow, and any code path that forgets to set the column won't fail mysteriously.
- **NOT NULL** — the discriminator must always be set. Hard-fail at insert is better than NULL-handling at every read site.

### 2. `change_motivation` column — controlled vocabulary for additional-program flow

```sql
ALTER TABLE embedded_agent_threads
  ADD COLUMN change_motivation TEXT
  CHECK (
    change_motivation IS NULL
    OR change_motivation IN ('variety', 'plateau', 'injury', 'priority_shift', 'equipment_change', 'return_from_break', 'other')
  );
```

- **Nullable** — onboarding threads never set this; additional-program threads only set it once the agent classifies (mid-conversation, before the ready signal). NULL is the legitimate "not yet captured" state.
- **Controlled vocab** matches the **Change motivation (Additional program creation)** glossary entry exactly. The `other` value is intentionally permitted — see ADR 0003 §3.

### 3. `bundle_context` column — captured-at-thread-open snapshot

```sql
ALTER TABLE embedded_agent_threads
  ADD COLUMN bundle_context JSONB;
```

- **Nullable** — only the additional-program flow uses it. Onboarding threads leave it NULL (they have no pre-loaded history to capture).
- **JSONB**, not a relational shape, because the bundle is a *snapshot* of denormalized state (profile fields + active program summary + 4-week stats) that the agent reads as-is. Normalizing it back into FKs would make the snapshot semantics impossible — the whole point is that subsequent training activity doesn't mutate it.
- **Persisted, not recomputed**. Captured once on thread open by the Edge function (the `/thread` endpoint that materializes the row). Never refreshed during the thread's lifetime. ADR 0003 §2 accepts the staleness trade-off.

### 4. `validator_rejection_count` column — bounded retry counter

```sql
ALTER TABLE embedded_agent_threads
  ADD COLUMN validator_rejection_count INT NOT NULL DEFAULT 0;
```

- The ready-signal validator (additional-program flow) can reject the model's `{"ready":true,...}` line when motivation is missing/invalid or constraint overrides are out of bounds. Each rejection bumps this counter so the system prompt can surface a bounded retry hint and the agent can give up gracefully instead of looping the user (§"Validator rejection investigation" of the runbook).
- **NOT NULL DEFAULT 0** — onboarding rows leave it at 0 (no motivation gate, no rejections). The default keeps reads from caring whether a thread predates the column.
- Server-side only. The counter is never exposed on the wire; the chat UI fires a separate `embedded_agent_motivation_classification_failed` analytics event when `/send` returns a `validator_rejection`.
- The read-modify-write pattern in `incrementValidatorRejection` is *not* atomic across concurrent writers. We accepted this trade-off because the column is a prompt-side tripwire, not a billing or quota field — a dropped increment under a multi-tab race means the agent is at most one rejection more patient than intended, which is a UX rounding error rather than a correctness bug. If the counter ever gains a behavior with sharper edges (e.g. billing) the pattern should be promoted to an SQL `col + 1` via RPC.

### 5. `pending_constraint_overrides` column — race-free `/send` → `/draft` handoff

```sql
ALTER TABLE embedded_agent_threads
  ADD COLUMN pending_constraint_overrides JSONB;
```

- The validator may accept a ready signal that carries structured `constraint_overrides` (e.g. `{"sessions_per_week": 5}`). Those overrides need to reach `/draft` exactly as `/send` validated them — without re-parsing the assistant turn (race) or stuffing them through a query parameter.
- Written by `/send` on validator-accept; consumed (cleared to `NULL`) by `/draft` after `setStatusToPreviewReady` succeeds, so an MCP dry-run failure preserves them for retry. `/reject` also clears them so a stale override doesn't survive into the next chat round.
- **JSONB** for the same reasons as `bundle_context` — the shape is small but unconstrained at the SQL layer; the server validator is the source of truth for what values are valid.
- **Nullable** is the default state. Onboarding threads never touch this column.

### 6. Relax the partial unique index to be `purpose`-keyed

```sql
DROP INDEX <existing_index_name>;

CREATE UNIQUE INDEX embedded_agent_threads_one_active_per_purpose
  ON embedded_agent_threads (user_id, purpose)
  WHERE status IN ('open', 'preview_ready');
```

- Allows one active onboarding thread **and** one active additional-program thread per user, simultaneously. Multiple active threads of the **same** purpose remain forbidden — that's still the right constraint (no zombie second-open thread on the same flow).
- Preserves the resume semantics defined in **Embedded Agent thread lifecycle**: load the single active row for the `(user, purpose)` pair, or insert a new one.

### 7. Backfill strategy

The `purpose` column gets `DEFAULT 'onboarding'` on the `ADD COLUMN` statement, so existing rows are populated transactionally with no manual backfill needed. `change_motivation`, `bundle_context`, and `pending_constraint_overrides` default to NULL, which is correct for all existing (onboarding) rows. `validator_rejection_count` defaults to 0.

The index swap (`DROP INDEX` + `CREATE UNIQUE INDEX`) is done **inside the same migration** as the column addition. The window between drop and create is microseconds; production write traffic on this table is low (one INSERT per onboarding start) and the new constraint is strictly *weaker* than the old one (any data that satisfied the old constraint also satisfies the new one), so concurrent inserts can't violate it during the swap.

## Consequences

- **Positive:**
  - The schema now models the actual product reality: one table for **Embedded Agent threads**, discriminated by flow. Future flows (#282 bilan mensuel) add a `purpose` value and a row in the `CHECK` clause — no new table, no new lifecycle code.
  - RLS policies, retention policy (90d truncation of `messages`), staleness rules, quota integration — all stay unchanged and apply uniformly across flows. Single set of code paths to maintain.
  - Analytics get a clean dimension: `purpose` is the *same* name in the schema and in event payloads (see ADR 0003 §follow-ups). Funnel queries don't translate between vocabularies.
- **Negative:**
  - `bundle_context` will be NULL for ~all existing rows and for every future onboarding row. NULL-heavy column. Mild schema smell, but the alternative (a sibling table) was worse by every measure we considered.
  - Two CHECK constraints to amend every time we ship a new flow or a new motivation value. Trivial migrations, but they ARE migrations.
- **Follow-ups:**
  - Update `useEmbeddedAgentThread` resume logic in `file:src/hooks/useEmbeddedAgentThread.ts` (and the Edge function's `threadStore`) to key on `(user, purpose)` instead of just `user`.
  - Update analytics dispatch sites to include `purpose` in payloads — exhaustive sweep of `embedded_agent_*` events.
  - The **Embedded Agent thread** glossary entry has been updated to document the new columns and the relaxed index.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **Sibling table `additional_program_threads`** | Duplicates the entire **Embedded Agent thread lifecycle** machinery (resume, staleness, abandonment) and 2× the RLS / retention / quota integration code. Every future flow demands another `*_threads` table. The NULL-heavy `bundle_context` smell is a 2-second cost; the duplicated machinery cost is permanent. |
| **Postgres ENUM for `purpose`** | Extending an ENUM is painful (`ALTER TYPE … ADD VALUE` non-transactional pre-PG12, value renames are rough). Bilan mensuel will need a new value soon. `CHECK` constraint on `TEXT` is trivial to amend. |
| **Drop the partial unique index entirely, manage active-thread count in app code** | Loses the DB-level guarantee. The whole point of the index was to prevent zombie second-active threads. Step backward. |
| **Per-purpose `bundle_context` column per flow** (`onboarding_bundle JSONB`, `additional_program_bundle JSONB`, etc.) | Schema-as-flag pattern. Every new flow adds a column. Single JSONB column where the *shape* differs per `purpose` is honest about what's being stored: "a snapshot specific to whatever flow this thread is". |
| **Recompute the bundle on every turn instead of persisting** | The Edge function reads it on every chat turn for the system prompt — refetching profile + active program + 4-week stats on each turn means 2-3 extra DB queries per LLM call, which we already pay once per turn for transcript load. Snapshot semantics are also a feature (subsequent training activity doesn't shift the conversation context out from under the user mid-thread). |
