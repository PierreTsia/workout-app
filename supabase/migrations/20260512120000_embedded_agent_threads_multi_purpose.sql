-- Embedded Agent threads — multi-purpose extension (T131, #343).
--
-- Adds the `purpose` discriminator so a single user can hold two active
-- threads simultaneously: one for onboarding and one for additional program
-- creation. Existing rows backfill to 'onboarding' via the column DEFAULT,
-- preserving the invariant from the original migration ("the user's currently
-- active row") with zero data migration.
--
-- !! INVARIANT updates
-- 1. "At most ONE active thread per user" becomes "at most ONE active thread
--    per (user, purpose)". The partial unique index is dropped and recreated
--    with the wider key. The 23505 collision handler in threadStore continues
--    to work — it just resumes within the same (user, purpose) bucket.
-- 2. The CHECK constraints on `purpose` and `change_motivation` are intentional
--    enums: they document the controlled vocabulary in the DB layer, so a
--    malformed value from a future client surfaces as a 23514 instead of
--    silently polluting analytics.
--
-- Companion ADRs:
--   - docs/adr/0003-additional-program-creation-shape.md (motivation gate,
--     bundle composition, prompt structure)
--   - docs/adr/0004-embedded-agent-thread-purpose-column.md (this schema
--     decision rationale)

alter table embedded_agent_threads
  -- Multi-purpose discriminator. NOT NULL with a DEFAULT backfills every
  -- existing row to 'onboarding' atomically — no data migration step.
  add column purpose text not null default 'onboarding'
    check (purpose in ('onboarding', 'additional_program')),

  -- Captured by the agent during the motivation gate (additional_program
  -- flow only). Nullable on onboarding rows; nullable on additional_program
  -- rows until the gate passes. Server-side validator enforces non-null
  -- before /draft for additional_program; this column is the audit trail.
  add column change_motivation text
    check (change_motivation is null or change_motivation in (
      'variety', 'plateau', 'injury', 'priority_shift',
      'equipment_change', 'return_from_break', 'other'
    )),

  -- Snapshotted user context at /open time (profile + active program summary
  -- + 4-week training stats). Bound to ~8 KB by the bundle builder
  -- (BUNDLE_MAX_BYTES) so this column stays bounded for analytics queries.
  -- Nullable on onboarding rows (they have no pre-loaded context).
  add column bundle_context jsonb,

  -- Increments on every ready-signal validator rejection (missing motivation,
  -- invalid_override, etc.). Bounded retry counter the agent uses to give up
  -- gracefully instead of looping the user. Default 0 covers legacy rows.
  add column validator_rejection_count int not null default 0,

  -- Race-free handoff between /send and /draft for the constraint_overrides
  -- carried by a validated ready signal. Written by /send when the validator
  -- accepts the signal; consumed (cleared to NULL) by /draft.
  add column pending_constraint_overrides jsonb;

-- Index swap. Drop the per-user uniqueness and add (user, purpose) uniqueness
-- on the same partial predicate. Done as drop+create rather than ALTER for
-- portability across Postgres versions.
drop index embedded_agent_threads_one_active_per_user;

create unique index embedded_agent_threads_one_active_per_purpose
  on embedded_agent_threads (user_id, purpose)
  where status in ('open', 'preview_ready');

-- Helper index for the new (user, purpose) lookup pattern in threadStore.
-- The pre-existing idx_embedded_agent_threads_user_status stays for the
-- per-user retention sweep (`purgeDueForUser`).
create index idx_embedded_agent_threads_user_purpose_status
  on embedded_agent_threads (user_id, purpose, status);
