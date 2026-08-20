# Epic Brief — Completed-day Home Last Session Recap #498

## Summary

Home d’un **workout day** déjà fait dans le **Cycle** courant mélange aujourd’hui le template (carte, map, « 12 exercices ») et une liste aplatie de `set_logs` (`5 × 0–10`). Ce brief sépare les deux sources : la carte reste l’identité du **jour actuel** ; sous la carte, un **Last Session Recap** en deux tabs — **Dernière séance** (défaut) vs **Programme**. Un Circuit reste un Circuit. Le jour pas encore fait garde Start / édition ; seul le compte d’items de carte s’aligne sur la **Unified Day Sequence**.

---

## Context & Problem

**Who is affected:** Anyone who lands on Home after finishing a day in the current **Cycle** — especially after a mid-cycle program edit (MCP `update_program` or Builder) on a Circuit-heavy day.

**Current state:**
- `isDayDoneInCycle` swaps `PreSessionExerciseList` for `ExerciseListPreview` fed by `summarizeSessionLogs` (`file:src/pages/WorkoutPage.tsx`, `file:src/lib/sessionSummary.ts`)
- `summarizeSessionLogs` groups by `exercise_id` only — **Exercise Block** rounds become linear `sets × min–max reps`; `baseExercises` is solos, so fallback template preview omits Circuits
- `WorkoutDayCard` mixes template (map, flattened exercise count) with last-session sets/duration (`file:src/components/workout/WorkoutDayCard.tsx`)
- History already groups correctly via `groupSessionHistory` (`file:src/lib/sessionHistoryGrouping.ts`)
- Canonical language: **Last Session Recap**, **Cycle**, **Unified Day Sequence** in `file:docs/CONTEXT.md`

**Pain points:**

| Pain | Impact |
|---|---|
| Flattened Theseus as `5 × 0–10` / `4 × 10` | Home looks like a different (linear) workout than the 4-AMRAP day |
| Card says 12 exercices + 11 min | Template count + last-session duration on one object |
| One list, two jobs | After an edit, you cannot tell programme vs what you actually logged |
| `12 exercices` flattens 4 Circuits | Card disagrees with how the day is trained (**Round** / **Circuit**) |

---

## User Stories

1. As a lifter on a day done in the current **Cycle**, I want two tabs under the day card — **Dernière séance** and **Programme** — so that programme and last session are not one list.
2. As a lifter on that done day, I want **Dernière séance** selected by default, so that I see what I actually logged without hunting.
3. As a lifter on a day not yet done in the **Cycle**, I want no recap tabs — the current editable `PreSessionExerciseList` and Start CTA — so that starting a session does not grow extra chrome.
4. As a lifter, I want the hero card to show today’s identity only (label, checkmark if done, body map from the live **Unified Day Sequence**, sequence-item badge such as `4 Circuits` or `6 exercices` or mixed), so that 11 min / 12 séries never describe a 4-AMRAP day.
5. As a lifter on any carousel day (done or not), I want that sequence-item badge — not flattened station count — so that Home and the Builder agree on what a **Circuit** is.
6. As a lifter on **Programme** (done day), I want the live **Unified Day Sequence** read-only (Circuit cards with **AMRAP**/ **Tours** + gloss + station names; solo rows without kg), so that I see today’s menu without load and without swap/delete/add.
7. As a lifter on **Dernière séance**, I want logged items grouped like `/history` (`groupSessionHistory`: **Circuit** cards with **AMRAP** `4+0` / **Tours** time; solos as solos), so that Theseus never becomes `5 × 0–10`.
8. As a lifter whose last session identities (**Benchmark Circuit** id/slug, solo `exercise_id`) differ from the live sequence, I want a fact line (`1 Circuit loggé · 4 au programme` — not « le jour a changé »), so that mismatch is visible without a false cause.
9. As a lifter whose identities match, I want no fact line — date and duration on the recap are enough.
10. As a lifter whose last session includes a jetable **Circuit** (no **Benchmark Circuit**) so identities cannot be compared, I want no fact line, only date + recap, so that we do not invent coverage.
11. As a lifter whose finished session has no `set_logs`, I want no recap panel (and no empty tab chrome), so that a hollow **Last Session Recap** never ships.
12. As a lifter, I want the existing footer on a done day (`Tu as déjà fait cette séance…` + recommencer un cycle) unchanged, so that this epic does not change cycle restart.
13. As a lifter who swipes the carousel to another done day, I want both tabs to follow that day’s template and that day’s last session, so that recap is not stuck on the previous card.
14. As a lifter in English, I want tab labels **Last session** / **Program**, so that FR/EN stay paired like the rest of Home.
15. As a lifter offline with a cached last session, I want the recap from cache (same as today’s preview), so that Home does not blank solely because recap is a new surface.
16. As a lifter whose last session is mixed solos + Circuits, I want both kinds in **Dernière séance** in log order, so that recap is not Circuit-only.

### Success measures

| Story # | Measure |
|---|---|
| 7 | Done-day Home never renders `summarizeSessionLogs` linear rows for a **Circuit** |
| 4–5 | Hero badge counts **Unified Day Sequence** items; the #498 repro card reads `4 Circuits`, not `12 exercices` |
| 2 | First paint on a done day has **Dernière séance** selected (no flash of Programme as selected) |
| 11 | Empty `set_logs` → zero recap tabs |

---

## Scope

**In scope:**
- Done-in-**Cycle** Home: **Last Session Recap** tabs, recap grouping via history, fact line on identity mismatch, hide when no logs
- Hero card: drop last-session sets/duration from the card; sequence-item count on **all** days
- Programme tab: read-only sequence, no kg, no pre-session mutations
- i18n FR/EN for new copy
- Tests for grouping, default tab, fact-line rules, empty logs, undone path unchanged (Start + edit)

**Out of scope:**
- Making `update_program` wipe-and-reinsert preserve `block_runs` (`ON DELETE CASCADE`) / `block_exercise_id` (known landmine, separate ticket)
- Day-level snapshot at GO to claim « le jour a changé »
- Recap tabs on days not done in the **Cycle**
- Flipping card / stacked list chrome
- Changing restart-cycle / Start / in-session flow
- Pixel-perfect Stitch as a merge gate (eyeball reference only)

---

## Success Criteria

- **Qualitative:** On the #498 repro (Home 2 done, 4 AMRAP today, last session Theseus `4+0` / 11 min), a lifter can name today’s four Circuits on **Programme** and see Theseus as an **AMRAP** score on **Dernière séance** — not rowing/dips linear rows.
- **Qualitative:** Hero never shows last-session 11 min next to a 4-Circuit map.
- **Numeric:** Zero uses of `ExerciseListPreview` / `summarizeSessionLogs` on Home completed-day (callers elsewhere, if any, stay until a later cleanup).
- **Qualitative:** Undone days still start in two taps (select day + Start); recap chrome is absent.
