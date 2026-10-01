# T254 — Open-session guard helper + auto-close instrumentation (E)

**Mode:** AFK · **Slice:** `lib/openSessions → lib/sessionEvents → useOrphanSessionClose → vitest`

## Goal

Extract the open-session read and its three exclusions into one shared module, and make the #568 auto-close measurable. This is the foundation both the start guard (T256) and the app-open prompt (T257) build on, and it delivers scope item **E** (instrument the auto-close). Addresses Epic Brief story 6.

## Dependencies

- None. Builds on #568 (`file:src/hooks/useOrphanSessionClose.ts`, `file:src/lib/orphanSessionClose.ts`).

## Scope

### `src/lib/openSessions.ts` (new)

| Export | Detail |
|---|---|
| `fetchOpenSessions(userId)` | `supabase.from("sessions").select("id, workout_day_id, workout_label_snapshot, started_at, cycle_id, set_logs(logged_at)").is("finished_at", null)`. Returns `OpenSessionRow[]`. |
| `excludedSessionIds(userId, session)` | `queuedRealSessionIds()` ∪ `pruneCancelledSessions(userId)` ∪ `{peekSessionRealId(userId, local-${startedAt})}` when `session.isActive && startedAt != null`. |
| `findBlockingOpenSession(userId, session)` | First open row not in the exclusion set, or `null`. |
| `classifyOpenSession(logs, now)` | `{ kind: "stale", close }` when `computeOrphanClose` returns a payload; `{ kind: "recent", lastSetAt }` when ≥ 1 set and the last set is inside `ORPHAN_SESSION_THRESHOLD_MS`; `null` otherwise. |

### `src/lib/sessionEvents.ts` (new)

- `trackSessionEvent(eventType, payload)` — fire-and-forget insert into `analytics_events` (mirrors `file:src/hooks/useTrackEvent.ts`, but callable outside React). No-op without a user.
- Typed event names: `session_orphan_closed` (`cause: "auto" | "start_guard" | "open_prompt"`), `session_orphan_prompted` (`surface: "app_open" | "start_guard"`), `session_orphan_resumed` (`surface`), `session_start_blocked`.

### `src/hooks/useOrphanSessionClose.ts` (edit)

- Replace the inline query + exclusion logic with `fetchOpenSessions` / `excludedSessionIds` / `classifyOpenSession`.
- Stale rows: keep the idempotent UPDATE; emit `session_orphan_closed { cause: "auto", session_id, idle_ms, total_sets_done }`.
- Expose `{ recentOrphan, dismiss, resume, finish }` for T257 (the prompt UI lands there; this ticket only exposes the state and the `finish`/`dismiss` actions).
- `finish()` closes the recent orphan with the last-set rule + `session_orphan_closed { cause: "open_prompt" }`.

### Tests

- `src/lib/openSessions.test.ts` — exclusion set (active local, queued, cancelled) and `classifyOpenSession` (stale / recent / no sets / unparseable).
- `src/hooks/useOrphanSessionClose.test.ts` — extend: a recent orphan is exposed, not closed; a stale orphan is closed and emits `session_orphan_closed` with `cause: "auto"`.

## Out of Scope

- The start guard dialog (T256) and the app-open prompt UI (T257).
- The resume path (T255).
- Sentry (T259).

## Acceptance Criteria

- [ ] `openSessions.ts` is the single source for the open-session query and its three exclusions; `useOrphanSessionClose` no longer inlines them
- [ ] A stale orphan is closed and emits `session_orphan_closed` with `cause: "auto"`
- [ ] A recent orphan (< 3 h) is exposed as `recentOrphan` and is **not** closed
- [ ] A session owned by the active local session, the queue, or the deny-list is never classified as an orphan
- [ ] `npm test` green; no new user-facing strings

## References

- Epic Brief `file:docs/done/Epic_Brief_—_Prevent_Orphan_Sessions_#571.md` (story 6, scope E)
- Tech Plan `file:docs/done/Tech_Plan_—_Prevent_Orphan_Sessions_#571.md` (Key Decisions, Component Architecture)
- ADR `file:docs/adr/0024-session-orphan-self-heal.md`
