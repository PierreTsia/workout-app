# T4 — Offline Queue & SyncService

## Goal
Implement the `SyncService` module and offline queue so that workout logging works fully offline and auto-syncs to Supabase on reconnect.

## Scope

### SyncService Module (`src/lib/syncService.ts`)
A plain TypeScript module (not a React component) responsible for:

**Enqueue**
- `enqueueSetLog(payload)` — appends a `set_log` mutation to the active user's queue in localStorage
- `enqueueSessionFinish(payload)` — appends a `session_finish` mutation
- Each item includes: `type`, `payload`, `queuedAt`, `dedupeComposite` (sessionId + exerciseId + setNumber + loggedAt), and a deterministic `fingerprint` (hash of composite fields)
- Queue is stored under a user-scoped key: `offlineQueue:{userId}`

**Drain**
- `drainQueue(userId)` — processes the active user's queue sequentially:
  1. For each item, perform composite + fingerprint check against Supabase before insert (best-effort dedupe)
  2. On success: remove item from queue
  3. On failure: leave item in queue for next retry
- Updates `syncStatusAtom` throughout: `syncing` → `synced` or `failed`
- Updates `queueSyncMetaAtom.pendingCount`

**Triggers**
- `window.addEventListener('online', ...)` → drain on reconnect
- App startup → drain on load (handles items queued during a previous offline session)

**Optimistic cache patch + targeted invalidation**
After successful drain:
- Patch TanStack Query cache for currently visible screens
- Invalidate key groups: `['sessions']`, `['exercise-trend', exerciseId]`, `['last-session', exerciseId]`, `['pr-aggregates']`

### Offline Status Chip
- `syncStatusAtom` drives the top-bar chip in `AppShell` (wired in T3 but fully functional here)
- States: `idle` (hidden or "Synced"), `syncing` ("Syncing…"), `failed` ("Sync failed"), `synced` ("Synced")

### Sign-out with Pending Queue
- If user signs out while `queueSyncMetaAtom.pendingCount > 0`, show confirmation: "Workout in progress will be saved locally and synced later. Sign out anyway?"
- On confirm: sign out; queue remains in localStorage under the user's scoped key
- On next sign-in with the same account: `drainQueue` runs automatically

### Account-switch Safety
- Queue and session state are stored per `user_id`
- On sign-in, only the matching user's queue is drained

## Out of Scope
- Builder mutations are never queued (Builder requires online — T7)
- PR detection (T5 reads from the same set log path but is implemented separately)

## Acceptance Criteria
- Checking a set while offline queues the log locally; top-bar chip shows "Offline"
- On reconnect, queue drains automatically; chip transitions "Syncing…" → "Synced"
- Duplicate protection: replaying the same item twice does not create duplicate rows in `set_logs`
- Sign-out with pending queue shows confirmation; data is preserved and synced on next login
- Queue from user A is never replayed when user B signs in

## References
- `spec:09100d04-cac9-490e-9368-d90a5492e210/d02152ce-9bf5-42f9-b739-4d073216262f` — Tech Plan: Offline queue, SyncService, Failure Mode Analysis
- `spec:09100d04-cac9-490e-9368-d90a5492e210/ad32c727-9c73-4e3e-b56c-fa6bd3a02392` — Core Flows: Flow 8 (Offline Logging & Recovery), Flow 4 (Sign-out guard)