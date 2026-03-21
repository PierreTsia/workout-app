# Epic Brief — Exercise History Quick-View

## Summary

This epic delivers a **high-fidelity exercise history quick-view** reachable from the **active workout** screen: a clear History call-to-action on the exercise detail, opening a **sheet** that shows recent performance (sets, weight, reps, RIR with color-coded intensity), **relative dates**, and a **weight/reps trend** so users can pick loads without leaving the session. It incorporates the **GitHub #76** acceptance criteria and safety constraints (lazy loading, bounded queries, offline messaging, confirmed delete) and uses the **competitor reference** (labeled History control, summary header, chart, horizontally browsable past session cards) as the visual and information-architecture north star—implemented in **phases** so the first release can ship the checklist while reserving heavier analytics for follow-up within the same epic where practical.

---

## Context & Problem

**Who is affected:** Anyone logging an **active workout** who wants immediate context on how they last performed an exercise (intensity, progression, mistakes) without opening the global History area and losing flow.

**Current state:**

- During a session, [`file:src/components/workout/ExerciseDetail.tsx`](src/components/workout/ExerciseDetail.tsx) only surfaces a compact **“last time”** line from [`file:src/hooks/useLastSession.ts`](src/hooks/useLastSession.ts)—useful, but not enough for trend scanning or multi-session comparison.
- Deep history lives under [`file:src/pages/HistoryPage.tsx`](src/pages/HistoryPage.tsx) (sessions + by-exercise tabs). Leaving the workout to get there breaks concentration and navigation context.
- Per-exercise analytics hooks exist (`file:src/hooks/useExerciseTrend.ts`, `file:src/hooks/useBest1RM.ts`) but are not wired to an in-workout sheet, are not **lazy-on-open**, and do not match the **“last 5 finished sessions”** product constraint without new querying.
- `set_logs` already stores **RIR** and **estimated_1rm**; corrections today are not exposed as first-class **edit/delete** flows from a history UI in the workout.

**Pain points:**

| Pain | Impact |
|---|---|
| History is “elsewhere” | Users break flow, forget what set they were on, or skip checking history entirely |
| No at-a-glance intensity | Hard to judge whether today’s RIR/weight is appropriate vs recent sessions |
| No bounded, session-oriented recap | Raw logs without grouping by **finished session** obscure “what did I do last Monday?” |
| Fear of bad data | Without edit/delete from history, users tolerate polluted logs or avoid logging detail |

---

## Goals

| Goal | Measure |
|---|---|
| In-session access | From active workout exercise view, user opens history in **one tap** without route change (sheet overlay) |
| Correct data story | Sheet shows **last 5 completed sessions** for this exercise, ordered by **`sessions.finished_at` DESC**, each with sets (reps, weight, RIR) and **relative** session dates |
| Visual quality | RIR (and RPE if ever captured) shown as **color-coded** badges; a **trend** (sparkline or line chart) for weight and/or reps over those sessions |
| Performance & safety | History fetched **only when** the user opens the sheet; Supabase query is **bounded** (join + order + limit); **delete** requires explicit confirmation |
| Offline honesty | When the client is offline (or history cannot load), user sees an explicit **“history unavailable”** state—not a silent empty screen |
| Data hygiene | Each historical session block supports **Edit / Delete** (per set log or per row as defined in Tech Plan) so accidental entries can be fixed |

---

## Scope

**In scope:**

1. **History CTA on exercise detail** — Prominent control (icon + label pattern per design reference) on [`file:src/components/workout/ExerciseDetail.tsx`](src/components/workout/ExerciseDetail.tsx) (or adjacent layout owned by the active workout page), above or beside the set table in a way that matches thumb reach and the reference layout.
2. **History sheet UI** — Reuse existing sheet/dialog primitives from the design system (same patterns as other workout sheets). Header with exercise identity (thumbnail, name, equipment/muscle cues). Dismiss without leaving the workout.
3. **Session-grouped history** — Aggregate `set_logs` by `session_id`, restrict to **finished** sessions (`sessions.finished_at IS NOT NULL`), **order by `finished_at` DESC**, **limit 5**. Display each session as a card (reference: horizontal scroll of session cards) with a mini table of sets: reps, weight, RIR; **relative** date for the session (e.g. “il y a 3 jours”).
4. **Intensity visualization** — Color mapping for RIR (and extensible to RPE) shared with [`file:src/components/workout/RirDrawer.tsx`](src/components/workout/RirDrawer.tsx) / logging UX so history badges match what users saw when they logged the set.
5. **Trend strip** — At minimum a **sparkline** or compact **line chart** derived from the same bounded dataset (or a single additional bounded query) for progression feedback; align styling with app tokens (teal / semantic colors).
6. **Empty & error states** — Friendly copy when the user has **no prior performance** for this exercise; explicit offline / load-failure messaging using [`file:src/hooks/useOnlineStatus.ts`](src/hooks/useOnlineStatus.ts) and failed query handling.
7. **Insufficient data (sparse history)** — When the user has **some** data but not enough for a meaningful trend or optional summary tiles, the UI must **not** pretend there is a trend (see **Insufficient data policy** below).
8. **Edit & delete** — Row or set-level overflow menu; **delete** flows through a confirmation dialog; **edit** opens inline editor or small form (Tech Plan specifies mutation path, including interaction with [`file:src/lib/syncService.ts`](src/lib/syncService.ts) / offline queue if applicable).
9. **i18n** — New strings in EN and FR under the appropriate namespace (likely `workout` and/or `history`).

### Insufficient data policy

| Situation | UX |
|---|---|
| **No completed sessions** with logs for this exercise | Primary **empty state**: encouraging copy (e.g. complete a workout to see history here). No chart, no session carousel, no Edit/Delete. |
| **Exactly one** past session | Show the **session card** (and set table) as usual. **Hide** the trend/sparkline region **or** replace it with a short **hint** (e.g. “Log this exercise again to see progression”) — do **not** draw a one-point “chart” that implies a trend. |
| **Two or more** sessions | Show trend as designed (derived from the same bounded payload). |
| **Fewer than five** sessions | Show **only** the sessions returned (1–4 cards). No placeholders, no fake sessions. |
| **Optional north-star blocks** (E1RM pair, records, range) when metrics cannot be computed | Show **“—”** or **omit** the tile with a muted explanation (e.g. “Not enough data yet”) — never invent numbers. |
| **All sets missing weight or reps** (edge case) | Session list can still show; trend block uses insufficient-data treatment; per-set cells show “—” where missing. |

**North-star additions (competitor reference — prioritize after core #76 checklist is green):**

- **Summary metrics row** — e.g. all-time vs “current” estimated 1RM (reuse/complement [`file:src/hooks/useBest1RM.ts`](src/hooks/useBest1RM.ts); define “current” in Tech Plan—e.g. best in last N sessions or rolling window).
- **Records strip** — small tiles for best weight-for-reps, volume session, best reps (computed from client or SQL—Tech Plan decides).
- **Range control** — e.g. “3 months” vs “daily” aggregation (only if query + UX cost stays bounded; may be a second query lazy-loaded inside the sheet).

**Out of scope:**

- Replacing or redesigning [`file:src/pages/HistoryPage.tsx`](src/pages/HistoryPage.tsx) in full (quick-view **complements** global history).
- Social sharing, export, or coach view.
- New server-side ML or third-party charting SaaS.
- RPE as a new logged field unless already planned elsewhere (RIR remains primary; brief stays extensible).
- **Offline edit/delete** of historical set logs (see Tech Plan: online-only corrections unless the sync queue gains update/delete later).
- Guaranteeing **numerical parity** between quick-view aggregates and every chart on [`file:src/pages/HistoryPage.tsx`](src/pages/HistoryPage.tsx) without an explicit reconciliation pass (document any known differences).

---

## Risks, gaps, and open questions

| Topic | Gap / risk | Mitigation |
|---|---|---|
| **MVP vs north star** | [#76](https://github.com/PierreTsia/workout-app/issues/76) mandates last **5** sessions and a trend; competitor UI adds E1RM pair, records, and **3-month** range. | Ship #76 first; treat competitor extras as phased scope in the same epic or follow-up tickets. |
| **Weight semantics** | `set_logs` store **kg**; the UI shows user **unit** preference via [`file:src/hooks/useWeightUnit.ts`](src/hooks/useWeightUnit.ts). | Every displayed weight in the sheet must convert consistently with `SetsTable` / history elsewhere. |
| **Sessions with zero sets for this exercise** | RPC returns sessions that have `set_logs` for the exercise; “empty session” for this exercise should not appear. | Covered by join filter; verify in tests. |
| **RIR null / legacy rows** | Older logs may predate RIR or have null. | Badge shows “—” or neutral styling; no crash. |
| **Read-only workout** | `ExerciseDetail` supports `isReadOnly` (e.g. past session replay). | Either **hide** History CTA when edits are impossible, or show history **read-only** (no Edit/Delete) — product pick documented in implementation ticket. |
| **Accessibility** | Sheet + horizontal scroll + menus must be keyboard and screen-reader usable. | Follow Radix patterns; label History CTA; test with VoiceOver / axe (see Testing Strategy in Tech Plan). |
| **Analytics / PR flags** | Editing or deleting `set_logs` may desync **derived** stats (dashboards, PR badges) until queries refetch. | Tech Plan lists **query keys to invalidate** after mutations. |

---

## Success Criteria

- **Numeric:** Opening the history sheet triggers **at most one primary history query** on first open (per exercise instance); query returns **≤ 5** sessions and only **finished** sessions, ordered by **`sessions.finished_at` DESC** (or equivalent documented join).
- **Numeric:** 100% of delete actions from the sheet require a **confirmation** step before persistence.
- **Qualitative:** User remains on the **active workout** route/view; closing the sheet restores the exact prior scroll/exercise focus.
- **Qualitative:** Empty, offline, error, and **insufficient-data-for-trend** states are **explicit** and copy-reviewed in EN/FR — users never see a misleading chart.
- **Qualitative:** Visual density and hierarchy are **competitive** with the provided reference: labeled History CTA, summary header, trend visible without scrolling on typical phone heights, session cards skimmable in **< 5 seconds**.

---

## Dependencies

- **Shipped data model:** `sessions`, `set_logs`, RLS on both; offline queue behavior in [`file:src/lib/syncService.ts`](src/lib/syncService.ts) for any mutation from the sheet.
- **Shipped UI:** [`file:src/components/workout/ExerciseDetail.tsx`](src/components/workout/ExerciseDetail.tsx), [`file:src/components/workout/SetsTable.tsx`](src/components/workout/SetsTable.tsx), existing sheet components used elsewhere in workout flows.
- **Issue tracker:** [GitHub #76](https://github.com/PierreTsia/workout-app/issues/76) — acceptance criteria and “Shadow Agent” constraints are **binding** for MVP within this epic.

---

## Relationship to Existing Epics / Surfaces

- **Global History** ([`file:src/pages/HistoryPage.tsx`](src/pages/HistoryPage.tsx)): This epic adds **session-local** convenience; deep analysis and browsing stay on History. Cross-linking (“Voir tout l’historique”) is optional and not required by #76.
- **Naming clarity:** [`file:src/hooks/useExerciseHistory.ts`](src/hooks/useExerciseHistory.ts) today lists exercises the user has ever logged—it is **not** per-exercise session history. New hooks should use names that avoid colliding with this (e.g. `useExerciseSessionHistoryForSheet`).

---

## Testing strategy (epic level)

Quality bar for this epic is defined in detail in **Testing Strategy** inside [`file:docs/Tech_Plan_—_Exercise_History_Quick-View.md`](docs/Tech_Plan_—_Exercise_History_Quick-View.md). At epic level we expect:

- **Automated:** unit tests for pure helpers (relative time, RIR styling, trend point derivation), hook tests with mocked Supabase/RPC, and component tests for empty / offline / error / confirm-delete flows.
- **Data layer:** SQL or integration tests proving the RPC returns **at most five** sessions, **descending** `finished_at`, only **finished** sessions, and correct set ordering — **no** cross-user leakage under RLS.
- **Manual / exploratory:** quick workout vs program session, FR+EN copy, weight unit toggle, and edit-after-delete refresh behavior.

---

## References

- [GitHub issue #76 — Exercise history quick-view](https://github.com/PierreTsia/workout-app/issues/76)
- Tech Plan: [`file:docs/Tech_Plan_—_Exercise_History_Quick-View.md`](docs/Tech_Plan_—_Exercise_History_Quick-View.md)
