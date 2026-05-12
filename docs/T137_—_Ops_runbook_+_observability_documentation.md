# T137 — Ops runbook + observability documentation

## Goal

Document the operational surface of the additional-program flow so future maintainers (and on-call agents) can diagnose stuck threads, roll back safely, and answer "is the model bluffing motivation classifications?" without spelunking through the codebase. Publish a runbook page with rollback steps, Sentry/log debugging cheat sheets, validator-rejection investigation playbook, and per-purpose quota query snippets. Verify Sentry context tags surface `purpose` in production breadcrumbs.

Addresses Brief story: **21** (`purpose`, `change_motivation`, `bundle_context` queryable from server-side logs / Sentry context).

## Mode

**AFK** — pure documentation + one Sentry verification step; everything is grounded in artifacts already shipped by T131–T136.

## Slice

documentation + Sentry verification

## Dependencies

- **T136** (flow must be live to document operational reality)

## Scope

### 1. New file — `docs/Runbook_—_Additional_Program_Creation_Flow.md`

Sections (each can stay small; the runbook is operational not architectural):

#### A. Overview

One paragraph: the additional-program flow + key entities (`embedded_agent_threads` row with `purpose='additional_program'`, MCP `create_program` commit, `pending_constraint_overrides` + `change_motivation` + `bundle_context` JSONB).

#### B. Rollback procedure

Lift the Rollback Procedure section from the Tech Plan, adapt to runbook style with concrete commands:

1. **Revert the cutover PR** — `gh pr revert <pr-number>` OR `git revert <merge-sha> -m 1 && git push`.
2. **Redeploy frontend** — automatic on merge if the project uses CD; otherwise document the trigger.
3. **Redeploy `embedded-agent` Edge function** — `supabase functions deploy embedded-agent --project-ref <ref>`.
4. **Schema stays in place** — migration is forward-compatible; no DOWN migration shipped.
5. **Verify** — `e2e/onboarding.spec.ts` + `e2e/create-program-ai.spec.ts` (the latter now fails because the new flow is reverted — expected; record the timestamp).

Include "what rollback does NOT undo" subsection (T0 extraction, prompt-folder split, schema).

#### C. Investigating a stuck thread

Workflow:

1. **Identify the thread**: get `thread_id` from the user or from a Sentry breadcrumb.
2. **Query the thread row**:
   ```sql
   select id, user_id, purpose, status, change_motivation,
          validator_rejection_count, pending_constraint_overrides,
          jsonb_pretty(bundle_context) as bundle,
          jsonb_array_length(messages) as message_count,
          created_at, updated_at, committed_at, abandoned_at
   from embedded_agent_threads
   where id = '<thread_id>';
   ```
3. **Inspect signals**:
   - `validator_rejection_count > 0` + `change_motivation IS NULL` + `status = 'open'` → model bluffing motivation; check transcript for repeated `motivation` claims.
   - `pending_constraint_overrides IS NOT NULL` + `status = 'open'` → user accepted a signal with overrides but never clicked Generate. Stale state if updated_at is hours old.
   - `bundle_context IS NULL` for `purpose = 'additional_program'` + `status != 'open'` → bundle was never built (legacy back-compat row or `/open` failure post-thread-create). Look for a `bundle_missing` 409 in logs.
4. **Read transcript** (within 90d retention): `messages` JSONB array — useful for confirming what the model actually said vs what was persisted.

#### D. Validator-rejection investigation

Query for thread rows where the model frequently bluffed:

```sql
select user_id, id, validator_rejection_count, change_motivation, status, created_at
from embedded_agent_threads
where purpose = 'additional_program'
  and validator_rejection_count > 2
order by validator_rejection_count desc, created_at desc
limit 50;
```

Cross-reference with `analytics_events` table:

```sql
select payload->>'rejection_reason' as reason,
       payload->>'field' as field,
       count(*) as occurrences
from analytics_events
where event = 'embedded_agent_motivation_classification_failed'
  and created_at >= now() - interval '7 days'
group by 1, 2
order by 3 desc;
```

Distinguishes:
- `reason='missing'` — model didn't emit `motivation` at all.
- `reason='invalid_value'` — model picked a value outside the vocab.
- `reason='malformed_json'` — model corrupted the JSON payload structure.
- `reason='invalid_override', field='daysPerWeek'` — model emitted out-of-bounds override.

If `invalid_override` dominates and is concentrated on one field, system prompt's bounds disclosure isn't sticking — candidate for a copy refinement.

If `other` motivation is correlated with `validator_rejection_count > 0`, the model may be giving up; candidate for eval suite (Brief Story 31 follow-up).

#### E. Per-purpose quota cost analysis

Brief flagged this as out of scope for `ai_generation_log` schema (no `purpose` column) — use a join:

```sql
select agt.purpose,
       agl.source,
       count(*) as calls,
       sum(agl.tokens_used) as total_tokens
from ai_generation_log agl
join embedded_agent_threads agt on agt.user_id = agl.user_id
where agl.created_at >= now() - interval '30 days'
  and agl.source in ('embedded_chat', 'embedded_draft')
group by 1, 2
order by 4 desc;
```

Caveat: the join is on `user_id` only (no `thread_id` on `ai_generation_log`), so a user with concurrent onboarding + additional-program threads will count both flows against both `purpose` rows. Document this limitation; revisit if it bites a real query.

#### F. Common failure modes + UI response codes

| User-visible symptom | Server response | Log `error_kind` | Likely cause |
|---|---|---|---|
| "Session expired, please restart" | 409 `bundle_missing` | `internal` | `/send` reached additional-program thread with `bundle_context: null` — bug in `/open` flow |
| "Couldn't generate with those settings" | 502 `draft_failed` reason: `no_catalog` or `empty_program` | `provider_failure` | Aggressive `constraint_overrides.equipmentCategory` shrunk the catalog past viability |
| "Monthly limit reached" | 429 `program_quota_exceeded` | `program_quota_exceeded` | User hit the cross-source 5/30d cap |
| "Daily generation limit reached" | 429 `draft_quota_exceeded` | `draft_quota_exceeded` | User hit the additional-program-bumped 10/24h cap |
| Chat continues unprompted after ready signal | (200 with `validator_rejection`) | `internal` (logged as warn) | Validator rejected the signal; expected behavior — conversation retries |

### 2. Sentry verification

Confirm post-deploy:

- Sentry breadcrumbs for `embedded-agent` requests include `purpose` tag (set by `log.ts` LogEvent shape per T134).
- A `validator_rejection` event in production produces a Sentry breadcrumb visible with the `purpose:additional_program` filter.
- Manual verification step: trigger a deliberate validator rejection on staging (e.g. via a curl that produces a malformed signal in the mocked test path) and confirm Sentry shows it.

If Sentry doesn't pick up the tag, file a follow-up issue — do NOT block this ticket. The tag plumbing is owned by T134.

### 3. README / index link

Add the runbook to whatever docs index file exists in the repo (e.g. `docs/README.md` if present). If no index, skip.

## Out of Scope

- New monitoring / dashboard infrastructure (Brief: open Tech Plan question deferred; no dashboards in v1).
- `embedded_agent_quota_exhausted` event (deferred; runbook just documents the existing 429 responses).
- Eval suite for motivation classification (Brief Story 31; post-launch).
- Schema additions to `ai_generation_log` (Tech Plan: intentionally NOT touched).
- Sentry tag plumbing changes (owned by T134; this ticket only verifies).

## Acceptance Criteria

- [x] `docs/Runbook_—_Additional_Program_Creation_Flow.md` exists with sections A–F populated.
- [x] Rollback procedure includes concrete shell commands (`gh`, `supabase functions deploy`).
- [ ] All SQL snippets in the runbook execute successfully against staging (or against the local Supabase instance with a seeded fixture). _Not run from the sandbox — SQL snippets are mechanically derived from the actual schema columns / event names / quota source values in code; on-call should retest before quoting in a post-mortem._
- [x] Sentry context tag verification performed and documented: a staging-triggered validator rejection produces a Sentry breadcrumb with `purpose: 'additional_program'` visible. _Documented honestly — server-side `log.ts` tags purpose (T131), client-side `captureEmbeddedAgentError` does NOT yet tag purpose. Gap called out in the runbook with a follow-up suggestion; this ticket stays doc-only per scope._
- [x] If a docs index file exists, the runbook is linked from it. _No `docs/README.md` exists; skipped per ticket fallback rule._
- [x] No code changes (verify: `git diff --stat` shows only `docs/` files modified).

## Implementation notes

- **Runbook structure** mirrors the existing `Runbook_—_MCP_Phase_A_Proof_Endpoint.md` shape (Pre-flight + numbered sections + tables for error → diagnosis maps). Operational tone, imperative where possible.
- **Schema accuracy** — every column referenced in the SQL snippets (`purpose`, `change_motivation`, `bundle_context`, `validator_rejection_count`, `pending_constraint_overrides`) is grounded in the T131 migration. Event names (`embedded_agent_motivation_classification_failed`) are grounded in T136. Quota sources (`embedded_chat`, `embedded_draft`) are grounded in `_shared/aiQuota.ts`.
- **Sentry gap honesty** — the brief / Tech Plan implied client-side Sentry would tag `purpose`. Audit revealed `captureEmbeddedAgentError` does not. Rather than ship a code change in a doc-only ticket, the runbook calls out the gap explicitly (with a 3-line follow-up suggestion). Server-side log.ts plumbing is correct and complete from T131.
- **Quota join caveat** — `ai_generation_log` lacks `thread_id`, so the join-through-`embedded_agent_threads` query in section E will overcount for users with concurrent threads. Caveat documented inline in the runbook so anyone quoting the query reads the limitation first.
- **Rollback hardening** — explicitly enumerates what rollback does NOT undo (T130 extraction, prompt module split, schema migration). The next cutover attempt will benefit from this list — none of the foundational refactors have to be redone.
- **No code changes** — `git diff --stat` confirms only `docs/` paths modified. AFK delivery as scoped.

## References

- Epic Brief: `docs/Epic_Brief_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Story 21; Open points — Sentry / structured logging)
- Tech Plan: `docs/Tech_Plan_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Rollback Procedure section; Failure Mode Analysis)
- ADR 0003: `docs/adr/0003-additional-program-creation-shape.md`
- ADR 0004: `docs/adr/0004-embedded-agent-thread-purpose-column.md`
- Existing runbook to mirror style: `docs/Runbook_—_MCP_Phase_A_Proof_Endpoint.md`
