# Runbook — Additional Program Creation Flow

Operational reference for the additional-program creation flow shipped
in #343. Use this when an on-call agent (or your future self) needs to
diagnose a stuck thread, roll back the cutover, or answer "is the model
bluffing motivation classifications?" without spelunking through the
codebase.

This is intentionally an **operational** document, not an architectural
one. Architecture lives in the Epic Brief and Tech Plan referenced at
the bottom; this file answers questions in the imperative.

---

## A. Overview

The additional-program flow lets a user who already has an active
program (post-onboarding) build a new one through the Embedded Agent
chat surface. It reuses the same components and Edge function as
onboarding, scoped via `purpose='additional_program'`.

Key entities to know about when debugging:

- **`embedded_agent_threads` row with `purpose='additional_program'`** —
  one row per attempted conversation. Active threads have
  `status IN ('open','preview_ready')`; terminal states are
  `'committed'` or `'abandoned'`. The unique constraint is
  `(user_id, purpose)` for active rows — a user can have onboarding +
  additional-program threads concurrently.
- **`bundle_context` (JSONB)** — snapshot of the user's profile,
  active program summary, and recent training stats. Written **once**
  by `/open` at thread creation; the system prompt reads from it on
  every turn (no per-turn DB reads). See `lib/bundle.ts` for the wire
  shape.
- **`change_motivation` (text)** — controlled vocabulary
  (`variety | plateau | injury | priority_shift | equipment_change |
  return_from_break | other`). Set once by the validator on the FIRST
  accepted ready signal; never overwritten.
- **`pending_constraint_overrides` (JSONB)** — overrides parsed from
  the latest accepted ready signal. Read by `/draft`, cleared by
  `/draft` success or `/reject`. Stale rows here = user accepted a
  signal but never clicked Generate.
- **`validator_rejection_count` (int)** — counter bumped every time
  the additional-program validator rejects a ready signal. Useful for
  spotting threads where the model is consistently bluffing.
- **MCP `create_program` tool** — the only commit path. Atomic
  active-program deactivation lives in the tool, not the handler. See
  `supabase/functions/mcp/tools/createProgram.ts`.

The legacy AI wizard (`useAIGenerateProgram` + `AIConstraintStep` +
`AIProgramPreviewStep`) is deleted as of #343 — there is no fallback
path to debug. If the chat flow is broken, the user falls back to
Template or Blank via the in-app escape (Story 15) or the rollback
procedure below.

---

## B. Rollback procedure

Use this when the cutover is causing user-visible damage that can't be
hotfixed in <30 minutes. Schema is forward-compatible — no DOWN
migration ships with this epic.

### Steps

1. **Revert the cutover PR.** Either:
   ```bash
   gh pr revert <pr-number-of-cutover-merge>
   ```
   or, if the merge is recent enough to revert cleanly:
   ```bash
   git revert <merge-sha> -m 1 && git push origin main
   ```

2. **Redeploy the frontend.** Automatic on `main` if the project uses
   continuous deployment. Otherwise trigger the CD pipeline manually.

3. **Redeploy the `embedded-agent` Edge function.**
   ```bash
   supabase functions deploy embedded-agent --project-ref favusepjqwpcroiolvaz
   ```

4. **Schema stays in place.** The migration (`20260512120000_embedded_agent_threads_multi_purpose.sql`)
   only adds columns + a wider unique index — every prior row stays
   valid and `purpose='onboarding'` is backfilled. Reverting the code
   on top of the wider schema is a no-op from the schema's
   perspective. **Do not run a DOWN migration** — there isn't one,
   and creating one ad-hoc risks data loss on the new columns.

5. **Verify.**
   ```bash
   npm run test:e2e -- --grep "Onboarding"
   ```
   `e2e/onboarding.spec.ts` must pass (regression gate).
   `e2e/create-program-ai.spec.ts` is expected to fail after a
   rollback — record the timestamp of the failure so post-mortems
   match up.

### What rollback does NOT undo

- **The T130 extraction** (`_shared/programDraft.ts`,
  `_shared/programGemini.ts`). Pure refactor; safe to keep.
- **The prompt module folder split** (`prompt/shared.ts`,
  `prompt/onboarding.ts`, `prompt/additional-program.ts`,
  `prompt/index.ts`). Pure refactor; safe to keep.
- **The schema migration.** Forward-compatible — see step 4.
- **The relocated components** (`src/components/embedded-agent/*`).
  Onboarding still consumes them post-rollback; revert only touches
  `CreateProgramPage` and analytics wiring.

In other words: a rollback shrinks the user-visible surface but
preserves all the internal plumbing. The next cutover attempt will
NOT have to redo T130–T135.

---

## C. Investigating a stuck thread

### Step 1 — Identify the thread

Get `thread_id` from one of:
- The user's report (most chat surfaces expose a short ID in the header).
- A Sentry breadcrumb tagged `feature=embedded-agent`.
- The `analytics_events` table: filter on `payload->>'thread_id'`.

### Step 2 — Query the thread row

```sql
select id, user_id, purpose, status, change_motivation,
       validator_rejection_count,
       pending_constraint_overrides,
       jsonb_pretty(bundle_context) as bundle,
       jsonb_array_length(messages) as message_count,
       created_at, updated_at, committed_at, abandoned_at
from embedded_agent_threads
where id = '<thread_id>';
```

### Step 3 — Read the signals

| Signal | Likely diagnosis | Next move |
|---|---|---|
| `validator_rejection_count > 0` + `change_motivation IS NULL` + `status='open'` | Model is bluffing motivation; rejection is silently retrying. | Check transcript for repeated `motivation` claims. Consider tuning the prompt's vocabulary disclosure. |
| `pending_constraint_overrides IS NOT NULL` + `status='open'` | User accepted a signal with overrides but never clicked Generate. | If `updated_at` is hours old, this is dead state — safe to ignore. If recent, ping the user. |
| `bundle_context IS NULL` + `purpose='additional_program'` + `status != 'open'` | Bundle was never built. Either a legacy back-compat row OR `/open` failed post-thread-create. | Search Edge logs for `bundle_missing` 409 OR `ProfileMissing` 409 around the thread's `created_at`. |
| `status='preview_ready'` for hours/days | User abandoned the preview mid-soak. | No action — the 90-day retention sweep cleans these up. |
| `validator_rejection_count > 5` | Model is *consistently* bluffing across multiple turns. | Read the transcript. If the rejections cluster on one reason (e.g. all `invalid_override.daysPerWeek`), the prompt's bounds disclosure isn't sticking. |

### Step 4 — Read the transcript

The full chat lives in the `messages` JSONB column on the same row.
Within the 90-day retention window:

```sql
select jsonb_array_elements(messages) as msg
from embedded_agent_threads
where id = '<thread_id>'
order by 1->>'ts';
```

Each entry has `{role, content, ts}`. Useful for confirming what the
model actually said vs what was persisted (server strips the
`READY_FOR_PROGRAM_DRAFT: {...}` line before storage — the raw signal
never lands in `messages`).

---

## D. Validator-rejection investigation

### Find threads where the model bluffed

```sql
select user_id, id, validator_rejection_count, change_motivation,
       status, created_at
from embedded_agent_threads
where purpose = 'additional_program'
  and validator_rejection_count > 2
order by validator_rejection_count desc, created_at desc
limit 50;
```

### Cross-reference with the dedicated analytics event

```sql
select payload->>'rejection_reason' as reason,
       payload->>'field' as field,
       count(*) as occurrences
from analytics_events
where event_type = 'embedded_agent_motivation_classification_failed'
  and created_at >= now() - interval '7 days'
group by 1, 2
order by 3 desc;
```

### Interpreting the rejection reasons

| `reason` | What the model did | Likely fix |
|---|---|---|
| `missing` | Emitted a ready signal with no `motivation` field. | Prompt copy refinement — motivation section needs to be more prominent. |
| `invalid_value` | Picked a motivation outside the controlled vocabulary. | Cross-check the values the model is hallucinating — may need to extend the vocab or sharpen disclosure. |
| `malformed_json` | Corrupted the JSON payload structure. | Usually a one-off; if recurring, the JSON-fenced example in the system prompt needs work. |
| `invalid_override` + `field=daysPerWeek` / `duration` / `equipmentCategory` | Emitted an override outside the 2-7 / 15-90 / enum bounds. | The bounds disclosure in the prompt isn't sticking — copy refinement candidate. |

### Eval signal

If `other` motivation is correlated with `validator_rejection_count > 0`,
the model may be giving up rather than classifying. This is a
candidate for the eval suite (Brief Story 31; deferred post-launch).

---

## E. Per-purpose quota cost analysis

`ai_generation_log` does NOT have a `purpose` column (intentional —
Tech Plan §"Per-purpose quota visibility" deferred the schema
addition). Join through `embedded_agent_threads` instead:

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

### Caveat — read before quoting this query

The join is on `user_id` only because `ai_generation_log` has no
`thread_id` column. A user with concurrent onboarding +
additional-program threads will have their calls counted against
BOTH `purpose` rows (cartesian-style). For a more honest count,
filter by a time window that excludes one of the threads, or wait
until a future ticket adds `thread_id` to `ai_generation_log`.

This limitation is worth documenting in every funnel report that
quotes the query.

---

## F. Common failure modes + UI response codes

| User-visible symptom | HTTP / wire | Log `error_kind` | Likely cause |
|---|---|---|---|
| "Session expired, please restart" on chat | 409 `bundle_missing` | `internal` (warn) | `/send` reached an additional-program thread with `bundle_context: null`. Bug in `/open` flow OR legacy back-compat row promoted to additional-program. |
| "Couldn't load your conversation" on chat mount | 409 `profile_missing` | `profile_missing` (warn) | `/open` couldn't load the user's profile to build the bundle. Either RLS failure or row deleted between auth and bundle build. |
| "Couldn't generate with those settings" on draft | 502 `draft_failed` (`no_catalog` / `empty_program`) | `provider_failure` | Aggressive `constraint_overrides.equipmentCategory` shrunk the catalog past viability. Often retried successfully without overrides. |
| "Monthly limit reached" on draft | 429 `program_quota_exceeded` | `program_quota_exceeded` | User hit the cross-source 5/30d cap. |
| "Daily generation limit reached" on draft | 429 `draft_quota_exceeded` | `draft_quota_exceeded` | User hit the 10/24h `embedded_draft` cap (bumped from 3 in T131 to share with onboarding). |
| "Slow down a moment" on chat | 429 `turn_quota_exceeded` | `turn_quota_exceeded` | User hit the 40/24h `embedded_chat` cap. Onboarding and additional-program share this cap. |
| Chat continues unprompted after ready signal | 200 with `validator_rejection` in body | `internal` (warn) | Validator rejected the signal; expected behavior — conversation retries through normal turns. |
| Commit "Try again" button | 502 `commit_failed` (`transport_error` / `rpc_error` / `mcp_tool_error`) | `mcp_*` | MCP transport / RPC / contract break. Status stays `preview_ready` so the user can retry without re-drafting. |

---

## Sentry — current observability state

### What's tagged today

Server-side structured logs (`log.ts`) include `purpose` on every
action log per T131 — query Edge logs with the JSON `purpose` filter
to slice by flow.

Client-side `captureEmbeddedAgentError` (in `src/lib/sentry.ts`)
tags `feature: 'embedded-agent'`, `route`, and `error_kind` — it does
**NOT** currently tag `purpose`. Dashboards that need to split
client-side captures by flow will have to join on `thread_id` via the
event payload, or accept that the slice is blended.

### Recommended manual verification post-deploy

1. Pick a staging user with an active program.
2. Trigger a deliberate validator rejection on the additional-program
   flow (e.g. via DevTools, send a message whose mocked /send response
   has `validator_rejection.reason='invalid_value'`).
3. Confirm Sentry shows a corresponding capture with
   `feature=embedded-agent` + `route=/message` tags. The
   `purpose=additional_program` tag will NOT be present (see gap above).

If a future ticket adds `purpose` to `captureEmbeddedAgentError`, the
existing dashboard filters keep working — the tag is purely additive.
File a follow-up issue if the dashboard friction outweighs the 3-line
fix.

---

## References

- Epic Brief: [`Epic_Brief_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md`](./Epic_Brief_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md)
- Tech Plan: [`Tech_Plan_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md`](./Tech_Plan_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md)
- ADR 0003 — additional program creation shape: [`adr/0003-additional-program-creation-shape.md`](./adr/0003-additional-program-creation-shape.md)
- ADR 0004 — embedded agent thread purpose column: [`adr/0004-embedded-agent-thread-purpose-column.md`](./adr/0004-embedded-agent-thread-purpose-column.md)
- Companion runbook (style reference): [`Runbook_—_MCP_Phase_A_Proof_Endpoint.md`](./Runbook_—_MCP_Phase_A_Proof_Endpoint.md)
