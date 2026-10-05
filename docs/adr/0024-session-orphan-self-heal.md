# ADR 0024 — Session orphan self-heal: close at boot, never `now()`

- **Status:** Accepted
- **Date:** 2026-09-30
- **Decided in:** [#568](https://github.com/PierreTsia/workout-app/issues/568)

## Context

A **Session** is written in two beats: a partial `sessions` row when mid-session `set_logs` sync, then a close when the user taps « Terminer ». The close is the only writer of `finished_at`, `total_sets_done` and `active_duration_ms`. When it never lands, the row keeps `finished_at = null` and `total_sets_done = 0` while every set is in the database — and it disappears from History (`src/components/history/ActivityTab.tsx` filtered `!finished_at`, and `useSessionsForDateRange` filtered it in SQL before that). Production carried 5 such orphans out of 247, some five months old; one user had two open at once.

Nothing closed an orphan: no delay, no resume, no offer. « Annuler la séance » deletes the row and discards the queue — data loss, not a close. An orphan earned no achievement and no PR, because `check_and_grant_achievements` only runs in `processSessionFinish` (until #660, see decision 4). The repo already self-heals the same shape one level up (a stuck **Cycle**, `useAutoCloseStuckCycle`), but nothing at the **Session** level.

## Decision

We will:

1. **Close orphan sessions at app open**, from `AppShell` via a dedicated `useOrphanSessionClose`. For each open session whose last `set_logs.logged_at` is older than a **3 h idle gap**, write `finished_at = last logged_at` (**never `now()`**), `total_sets_done = count(set_logs)`, `active_duration_ms = last − first`, `has_skipped_sets = false`.
2. **Use a 3 h idle gap, not a planned-duration estimate.** The `sessions` row carries no planned duration, and prod closes 0–1 min after the last set. The threshold is an **idle gap since the last set** (not a session-length ceiling), so a long-but-active session never trips it; 3 h is already far beyond any live session and closes same-day orphans on the next open rather than waiting half a day.
3. **Guard the UPDATE twice.** Skip the active local session (resolved through `peekSessionRealId`, since the queue keys sessions by `local-<startedAt>` → UUID) and any `realSessionId` still in the offline queue — a queued `session_finish` would drain later and overwrite our value with `now()`. The `UPDATE` carries `.is("finished_at", null)`, so it is idempotent and can never touch an already-closed session.
4. **Never fight the offline queue.** The self-heal writes directly; it does not enqueue a `session_finish`. It **does** call `check_and_grant_achievements` after a successful close ([#660](https://github.com/PierreTsia/workout-app/issues/660), amending this ADR) — one call per boot when at least one orphan was closed, idempotent, and derived from real `set_logs`, so nothing is invented. `was_pr` stays out: PR detection is client-side (`prDetection.ts`) and not reconstructible here.
5. **Never hide an unfinished session.** `useSessionsForDateRange` and `ActivityTab` stop filtering on `finished_at`; an orphan is bucketed on `finished_at ?? started_at` and shown with a « non terminée » badge. The heatmap/calendar RPC `get_training_activity_by_day` uses the **same** key for any session with at least one set, so a dotted day always has a matching day-list row.
6. **Backfill the 5 known rows** with a one-shot SQL migration, values recomputed from `set_logs`, `WHERE finished_at IS NULL`.

## Consequences

- **Positive:** an orphan is closed on the next app open and never silent again; one hook + one guard helper + two SQL objects, no schema change, no new column, one new i18n key.
- **Negative / accepted:**
  - `has_skipped_sets` is not reconstructible for an orphan (the local state is gone) → always `false`, possibly wrong.
  - `was_pr` was never computed for those sets, so April records stay absent — not invented.
  - **Achievements are re-credited** by the close ([#660](https://github.com/PierreTsia/workout-app/issues/660)): the self-heal runs `check_and_grant_achievements` once after a successful close (auto-close or prompt Finish), idempotent. `was_pr` (client-side detection) and `has_skipped_sets` stay unreconstructed — the former still needs `scripts/backfill-was-pr.ts --regrant`.
  - An in-progress session now has a set and so can appear in the heatmap/calendar before it is closed; the RPC cannot distinguish "live" from "abandoned". Accepted — the auto-close turns it into a finished row within 3 h.
  - No client-side evidence was found that a `session_finish` was ever *lost* (the reading retained is "the user never tapped Terminer"); the queue guard is prevention as much as repair.
- **Follow-ups:** a mail to the affected users is deferred; its channel and copy are frozen once the fix ships. PRs (`was_pr`) and achievements are re-derived by a separate one-time manual script run after the prod backfill — tracked in [#569](https://github.com/PierreTsia/workout-app/issues/569).

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| Close with `finished_at = now()` | Invents a timestamp hours after the fact; the last set is the real end. |
| Planned-duration + margin threshold | `sessions` carries no planned duration; the data does not exist. |
| A cron / scheduled Edge Function | The client is already the only writer of closes; a boot-time self-heal needs no new infrastructure. |
| Make « Annuler la séance » the recovery path | It deletes data; the sets are real and must be kept. |
| Recompute PRs / re-grant achievements in the backfill | Invents records for April and breaks the "no re-grant" invariant; out of scope. |
| Only fix `ActivityTab`'s filter | The row never reaches the component — `useSessionsForDateRange` filtered it in SQL first. |
