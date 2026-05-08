# T122 — Embedded Agent Observability + Retention/Cascade Tests

## Goal

Harden the four `embedded-agent` Edge routes with **structured server-side logs** in the same shape as the Phase A proof endpoint (`request_id`, `feature`, `error_kind`, optional `user_id`, `thread_id`), capture unexpected exceptions with **Sentry** (web pattern; Edge equivalent is structured `console.error`), and add **integration tests** for the two retention/erasure paths the brief calls out: **90-day lazy body purge** on thread touch and **immediate hard-delete on account deletion** via FK CASCADE.

Addresses Epic Brief stories: **#17**, **#18**, **#19**.

## Mode

**AFK** — log shapes and retention rules are locked.

## Slice

`embedded-agent route logs → Sentry / structured logs → Deno integration tests for purge + cascade`

## Dependencies

`T120` (all four routes exist).

## Scope

### Structured logs across `file:supabase/functions/embedded-agent/index.ts`

- Reuse the `LogEvent` shape from `file:supabase/functions/mcp-phase-a-proof/handler.ts`:
  ```ts
  type LogEvent = {
    level: "error" | "warn" | "info"
    feature: "embedded-agent"
    route: "/thread" | "/message" | "/draft" | "/commit" | "/reject"
    error_kind: string
    request_id: string
    user_id?: string
    thread_id?: string
    message?: string
  }
  ```
- Pull a single `emitLog` helper into `file:supabase/functions/embedded-agent/log.ts`. Every error path in every route emits one structured line via `console.error(JSON.stringify(...))`. Never `throw` for expected failures.
- Add `info` logs at meaningful boundaries: thread created, thread resumed, thread committed, thread abandoned. Keep volume low (no per-message info-log).

### Error kinds inventory (canonicalize)

| Route | `error_kind` values |
|---|---|
| `/thread` | `auth_missing`, `invalid_session`, `invalid_locale`, `internal` |
| `/message` | `auth_missing`, `invalid_session`, `no_active_thread`, `turn_quota_exceeded`, `provider_failure`, `internal` |
| `/draft` | `auth_missing`, `invalid_session`, `wrong_status`, `draft_quota_exceeded`, `program_quota_exceeded`, `provider_failure`, `mcp_rpc_error`, `mcp_tool_error`, `mcp_transport_error`, `internal` |
| `/commit` | `auth_missing`, `invalid_session`, `confirm_required`, `wrong_status`, `mcp_rpc_error`, `mcp_tool_error`, `mcp_transport_error`, `internal` |
| `/reject` | `auth_missing`, `invalid_session`, `wrong_status`, `internal` |

### Sentry-class capture

- Web: existing `file:src/lib/sentry.ts` already wraps `Sentry.captureException`. In `EmbeddedAgentChatStep` / `EmbeddedAgentPreviewStep`, on unexpected mutation errors (i.e. error shape we did not enumerate as friendly UX), call `Sentry.captureException` with extra `{ feature: 'embedded-agent', route, error_kind }`. Don't double-capture friendly 4xx flows (quota / wrong status etc.).
- Edge: structured `console.error` is sufficient — no Sentry SDK in Deno today. The `error_kind` taxonomy lets the maintainer build a Supabase log alert.

### Retention purge integration test — `embedded-agent/threadStore_retention_test.ts`

- Setup a `committed` thread with `committed_at = now − 91d` and non-null `messages`.
- Call any thread-loading helper (`getOrCreateActiveThread` simulating a touch — or a synthetic `purgeRetentionIfDue` direct call).
- Assert: `messages` is now `null`; `summary`, `program_id`, `committed_at` unchanged.
- Inverse: thread `committed_at = now − 89d` → `messages` unchanged.

### Account-deletion cascade integration test — `embedded-agent/cascade_test.ts`

- Create a user via service client; create a thread row owned by them.
- Call `supabase.auth.admin.deleteUser(userId)` (mirroring `file:supabase/functions/delete-account/index.ts`).
- Assert: zero rows remain in `embedded_agent_threads` for that user — proves the `ON DELETE CASCADE` from T116 actually fires.

## Out of Scope

- No new error UX in the components (T118 + T120 already shipped friendly copy paths).
- No analytics events (T123 owns naming pass).
- No alerting/dashboards setup — that's a maintainer ops task tracked separately.
- No flag flip (T123).

## Acceptance Criteria

- [ ] All four error-emitting routes use the shared `emitLog` helper; every error path emits one structured line with `request_id`, `feature`, `route`, `error_kind` (Story 19).
- [ ] At least one explicit test asserts a structured log line is emitted on a known error path (e.g. quota exceeded on `/message`).
- [ ] Web component unexpected errors call `Sentry.captureException` with feature/route/error_kind tags; friendly 4xx flows (quota / wrong status) do not.
- [ ] Retention purge integration test: 91d committed thread → `messages` null; 89d thread → unchanged (Story 17).
- [ ] Account deletion cascade test: deleting the auth user removes the thread row immediately (Story 18).
- [ ] All canonical `error_kind` values from the table above appear in code; no ad-hoc strings.

## References

- Phase A pattern (logs): `file:supabase/functions/mcp-phase-a-proof/handler.ts`, `file:supabase/functions/mcp-phase-a-proof/index.ts`
- Sentry helper: `file:src/lib/sentry.ts`
- Account deletion flow: `file:supabase/functions/delete-account/index.ts`
- Glossary: `file:docs/CONTEXT.md` — `Embedded Agent thread retention`
