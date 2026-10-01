# Epic Brief — Prevent Orphan Sessions (#571)

## Summary

#568 recovers orphan sessions (a session whose `finished_at` never landed) and #569 re-derives their PRs and achievements. This epic stops new orphans from being created. It adds a **database-backed guard** before a session starts (finish or resume the open one), turns the silent boot-time auto-close into an **offer to resume or finish** when the orphan is recent, promotes a **persistent finish control** so a partial session is never stranded behind navigation, and **instruments** every auto-close so recurrence is measurable. The user keeps agency over a recent session; an abandoned one is still closed by #568.

---

## Context & Problem

**Who is affected:** every lifter who closes the PWA before tapping « Terminer », or who starts a second session while one is still open.

**Current state:**
- A **Session** is written in two beats: a partial `sessions` row when mid-session `set_logs` sync, then a close when the user taps « Terminer ». The close is the only writer of `finished_at`, `total_sets_done` and `active_duration_ms`.
- #568 closes orphans at app open when the last set is older than a **3 h idle gap**, writing the last set as `finished_at` (never `now()`). It is silent: the user is never offered to resume.
- The day-lock that should prevent a second session is **client-only**: `startSession` (`file:src/pages/WorkoutPage.tsx:915`) never reads the database for open sessions — the lock rides on the local `sessionAtom` (`isViewingLockedDay`). Lose the atom (reload, storage clear, another tab/device, a version migration) and a new session starts while the old one stays open forever.
- There is no close-on-leave: navigating away enqueues nothing.
- The primary button is « Finish » only on the last item; otherwise it is « Next » with a low-contrast ghost « Finish workout early » below (`file:src/components/workout/SessionNav.tsx:124-136`). Inside a circuit, `WorkoutPage` returns early with only `BlockRunner` — the bottom nav (and its finish affordance) is not rendered at all.
- No client-side witness exists for a lost finish: `useOrphanSessionClose` closes silently, with no event.

**Pain points:**

| Pain | Impact |
|---|---|
| Start a new session while one is open | Two open rows accumulate; the first is invisible in History until #568 closes it. Prod: one user started a second session 5 min after the first. |
| Silent auto-close of a recent orphan | The user loses the chance to resume a session they were still doing; the close is a surprise. |
| Finish affordance hidden behind navigation | A partial session is stranded; the user closes the app instead of finishing. |
| No instrumentation | Recurrence is unmeasurable; no way to know if the fix worked. |

---

## User Stories

1. As a `lifter who closed the app mid-session`, I want `to be offered to resume or finish my recent session when I reopen`, so that `I don't lose my progress or leave a ghost session`.
2. As a `lifter starting a new session while an old one is still open`, I want `to be told and choose to finish or resume it`, so that `I never silently accumulate two open sessions`.
3. As a `lifter who wants to end a partial session`, I want `a finish control always reachable — even inside a circuit`, so that `I'm never stranded behind navigation`.
4. As a `lifter who chose to finish an orphan`, I want `its sets preserved and counted`, so that `my history is accurate`.
5. As a `lifter who chose to resume an orphan`, I want `my already-logged sets shown as done`, so that `I continue instead of redoing them`.
6. As a `product engineer`, I want `every auto-close and guard decision instrumented`, so that `I can measure recurrence`.
7. As a `lifter offline`, I want `the guard to not block me when the database is unreachable`, so that `I can still train`.
8. As a `lifter with an abandoned (>3 h) orphan`, I want `it auto-closed silently (existing #568 behavior)`, so that `I'm not nagged about an old session`.

### Success measures

| Story # | Measure |
|---|---|
| 2 | 0 new second-open-session rows in a manual pass over the two prod-observed triggers |
| 6 | 100 % of auto-closes emit `session_orphan_closed` with a `cause` |
| 1 | A recent orphan (< 3 h) always surfaces the resume/finish prompt on open |

Stories without a numeric measure are validated qualitatively via the user story itself.

---

## Scope

**In scope:**

1. **B — Block a new session while one is open (core).** Before `startSession` commits, read the user's open sessions (excluding the active local session, the offline queue, and the cancellation deny-list). If one exists, prompt **Finish it / Resume it** and act before starting. The guard lives in the DB-backed path, not only in the local atom.
2. **A — Offer resume / finish at app open.** When an orphan's last set is **recent** (inside the 3 h idle threshold), offer **Resume / Finish** instead of a silent close. Only auto-close when it is genuinely abandoned (> 3 h). Needs a resume path (the local atom may be gone → reopen locally on the last workout day, with already-logged sets shown as done).
3. **D — Promote the finish affordance.** Surface a persistent finish control in the session header so a partial session is never stranded behind navigation — including inside a circuit, where the bottom nav is not rendered.
4. **E — Instrument the auto-close.** Emit an event whenever `useOrphanSessionClose` closes a session, and on every guard/prompt decision, with `cause` so recurrence is measurable.

**Out of scope:**

- **Auto-finish on `pagehide`** — fires on app-switch/bfcache and would kill a legitimate resume.
- **Server-side safety net** (cron / Edge Function closing orphans regardless of a client open) — separate decision; noted so it is not lost.
- Changing the recovery itself (#568) or the derived-data backfill (#569).
- **Sentry coverage** — deferred until the dashboard token is restored; tracked as a follow-up in the HITL ticket.
- Re-crediting PRs / achievements for a resumed or finished orphan — #569 owns that.

---

## Success Criteria

- **Numeric:** starting a session while an open one exists always surfaces the choice (finish / resume) — a manual pass over the two prod-observed triggers creates no second open row.
- **Numeric:** every auto-close emits `session_orphan_closed` with a `cause` (`auto` | `start_guard` | `open_prompt`).
- **Qualitative:** a recent orphan prompts **Resume / Finish** on app open instead of a silent close; an abandoned one is still auto-closed by #568.
- **Qualitative:** a persistent finish affordance is reachable without navigating to the last item, including inside a circuit.
- **Qualitative:** resuming an orphan reopens it on its workout day with its already-logged sets shown as done.
