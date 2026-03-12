# T12 — Unit Tests: SyncService & useBest1RM

## Goal

Cover the two most complex and highest-risk modules with thorough unit/integration tests: the offline SyncService (queue, dedupe, drain, failure recovery) and the useBest1RM hook (Supabase query → 1RM computation). Both require heavy mocking of Supabase and careful isolation of module-level state.

## Dependencies

T10 — Vitest Setup & Test Utilities must be complete.

## Scope

### `src/lib/syncService.test.ts` — SyncService

Tests for `enqueueSetLog`, `enqueueSessionFinish`, and `drainQueue` in `file:src/lib/syncService.ts`.

**Critical constraint — module-level mutable state:** The `draining` boolean and `listenersInitialized` flag are module-level variables. Tests must use strict per-test isolation: each `beforeEach` executes `vi.resetModules()`, clears `localStorage`, and rebuilds all Supabase/Jotai/QueryClient mocks before dynamically re-importing the SyncService module. This prevents state bleed between tests.

**Critical constraint — supabase side effects:** `file:src/lib/supabase.ts` fires `getSession()` and `onAuthStateChange()` at import time. The `@/lib/supabase` module must be mocked via `vi.mock` (hoisted above imports) to prevent these side effects from executing during tests.

#### Mocking Setup

| Mock target | Strategy |
|---|---|
| `@/lib/supabase` | `vi.mock` — return a fake `supabase` object with chainable `.from().select().eq()...` methods and controllable return values |
| `@/lib/queryClient` | `vi.mock` — return a mock `queryClient` with `invalidateQueries` spy |
| `jotai` `getDefaultStore` | `vi.mock` or manual — return a mock store with `get`/`set` spies controlling `authAtom`, `sessionAtom`, `syncStatusAtom`, `queueSyncMetaAtom` |
| `localStorage` | Use real `localStorage` (jsdom provides it), cleared in `beforeEach` |
| `crypto.randomUUID` | `vi.fn()` returning deterministic UUIDs |

#### enqueueSetLog

| Case | Assertion |
|---|---|
| Enqueue a set log | Item appears in localStorage queue with correct `type`, `fingerprint`, `dedupeComposite` |
| Enqueue duplicate (same composite) | Queue length stays at 1 — fingerprint dedupe rejects the duplicate |
| Enqueue without auth | `console.warn` fires, queue unchanged |
| Enqueue two different sets | Queue length = 2, each with unique fingerprint |
| `queueSyncMetaAtom.pendingCount` updated | After enqueue, atom setter called with correct count |

#### enqueueSessionFinish

| Case | Assertion |
|---|---|
| Enqueue session finish | Item appears in queue with `type: 'session_finish'` |
| Duplicate session finish | Rejected by fingerprint check |
| Session meta enriched | `sessionMeta` in localStorage updated with finish-time data |

#### drainQueue

| Case | Assertion |
|---|---|
| Drain with 2 set_logs from same session | `ensureSession` called once, `set_logs.insert` called twice, queue empty after drain |
| Drain with set_log + session_finish | Session upserted with full finish data, set_log inserted, both removed from queue |
| Supabase insert failure on one item | Failed item survives in queue, successful items removed, `syncStatusAtom` set to `'failed'` |
| Supabase returns existing row (dedupe) | Item treated as success (removed from queue) |
| Empty queue | `drainQueue` returns immediately, no Supabase calls |
| Already draining (re-entrant call) | Second call is a no-op (guards via `draining` flag) |
| Cache invalidation after drain | `queryClient.invalidateQueries` called for `['sessions']`, `['pr-aggregates']`, and per-exercise keys `['last-session', exId]`, `['best-1rm', exId]`, `['exercise-trend', exId]` |
| Sync status lifecycle | Atom transitions: `'syncing'` → `'synced'` (all drained) or `'syncing'` → `'failed'` (partial failure) |

### `src/hooks/useBest1RM.test.tsx` — useBest1RM

Tests for the `useBest1RM` hook in `file:src/hooks/useBest1RM.ts`. Uses `renderHook` wrapped with `renderWithProviders`.

**Mocking:** `@/lib/supabase` is mocked at module level. The mock controls what `.from('set_logs').select().eq()` returns.

| Case | Mock data | Expected result |
|---|---|---|
| Normal — multiple rows | `[{reps_logged: '10', weight_logged: 100, estimated_1rm: null}, {reps_logged: '5', weight_logged: 120, estimated_1rm: null}]` | Best 1RM = max of `computeEpley1RM(100,10)` and `computeEpley1RM(120,5)` = `133.33` |
| Uses `estimated_1rm` when present | `[{reps_logged: '10', weight_logged: 100, estimated_1rm: 150}]` | `150` (precomputed value used directly) |
| Empty data | `[]` | `0` |
| No exerciseId | Hook called with `undefined` | Query disabled, returns `undefined` |
| No auth | `authAtom` is `null` | Query disabled, returns `undefined` |

## Out of Scope

- E2E tests (T13)
- CI pipeline (T14)
- Tests for `initSyncListeners` (event listener wiring — lower risk, future coverage epic)

## Acceptance Criteria

- [ ] `src/lib/syncService.test.ts` covers: enqueue dedupe, queue persistence, drain session grouping, partial failure survival, cache invalidation, sync status transitions
- [ ] `src/hooks/useBest1RM.test.tsx` covers: correct 1RM computation from mock rows, `estimated_1rm` field usage, empty data returns 0, disabled when no exerciseId or no auth
- [ ] Each test file uses `vi.resetModules()` and fresh mocks in `beforeEach` — no state bleed
- [ ] All tests pass via `npm run test`
- [ ] No lint or type-check regressions introduced

## References

- `Epic_Brief_—_Quality_Foundation_(Testing_+_CI_CD).md` — highest-risk modules: SyncService, useBest1RM
- `Tech_Plan_—_Quality_Foundation_(Testing_+_CI_CD).md` — Critical Constraints section, Unit Test Files table
