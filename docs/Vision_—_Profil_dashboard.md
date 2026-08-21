# Vision — Profil dashboard

Not an Epic Brief. Not a Tech Plan. **Target vision** for the first-class **Profil** surface. Delivery path (v1 slice, query budget, Mix partition) still needs grilling before a brief.

**Issue:** [#512](https://github.com/PierreTsia/workout-app/issues/512)
**Mocks:** `file:docs/visions/profile-mix-stacked.canvas.tsx` (layout) · `file:docs/visions/profile-copy-deck.canvas.tsx` (copies FR/EN). Live Cursor preview is the same files under the workspace `canvases/` folder.

Related: [#502](https://github.com/PierreTsia/workout-app/issues/502) (Hevy-class viz — this vision picks **period dashboard on Profil**, not an exercise identity page, not a History dump).

---

## Job

Someone already in GymLogic opens **Profil** between sessions and feels whether *this* 7 / 30 / 100-day block is moving — using objects Hevy cannot paste (Programme, Quick Workout, Circuits, RIR 0, Équilibre, Succès). History stays the carnet. Account becomes Settings.

---

## IA

| Decision | Choice |
| --- | --- |
| Nav | First-category **Profil** (same rank as History / Library) |
| Pulse route | `/profile` (dashboard). `/account` redirects. |
| Settings | Later `/settings` absorbs current Account (PAT, DELETE, questionnaire, drawer units / locale / theme) |
| History | **Untouched** in this epic. Activity tab is a later follow-up |
| Public profile | **Dropped** — it polluted the design |
| Fold | Mix + Rythme **above** Records. Inverse = Hevy twin |

---

## Three acts (not eleven widgets)

1. **Cette fenêtre** — Hero, Succès compact, 3 stats, Rythme, Mix
2. **Preuve** — Records (PR bars + RIR 0 % line, dual axis), Équilibre
3. **Pratique** — Récurrents, Circuits

**Cut:** monthly “Régularité / séances par mois” (cousin of History → Activity).

Window toggle **7j / 30j / 100j** is global for pulse, rythme, mix, records, équilibre, succès strip. Récurrents stay 100d ranking. Circuit sparklines stay last-8-runs of the fingerprint.

Grain follows the window: **day** on 7j, **ISO week** on 30j (~5 weeks) and 100j (12 weeks).

---

## Locks

### Hero

Avatar, display name, **equipped title**, active Programme. Hopper line `Aussi {other} cette semaine` only if ≥2 programs produced sessions in the window. No Cycle `11/16` hero.

### Succès

Three jobs, not Account’s “top 3 by `tier_level`”:

- **Plus récent** — max `granted_at` (career)
- **Plus haut** — max rank / `tier_level` (career; often the equipped title)
- **Derniers reçus** — window-scoped row of pills, not a table

CTA **Voir tout** → `/achievements`. Count `{n} / {total}`.

### Cette fenêtre (pulse)

Three stats, not four: **Séances** (delta vs prior equal window), **Temps sous barre** (`sessions.active_duration_ms`), **Durée moy.** vs prescribed minutes. Drop “séances / sem” — Rythme owns presence.

### Rythme

Presence strip. Skip-vs-plan rings **only** if a single Programme produced enough sessions in the window; otherwise presence, not fidelity.

### Mix

Stacked share, same grain as Rythme. Series: **Programme** · **Quick Workout** · **Circuits**.

**Still to lock at briefing:** exclusive slices vs origin ∪ overlay. A Programme day that contains a Circuit is both origin (`program_id`) and shape (Circuit). The mock treats the three as exclusive. Do not paper over that in the legend.

### Records

Hero unit = **session × exercise** (at least one `set_logs.was_pr`). Stats: PR count, distinct exercises, days since last. **One chart:** bars = PR counts (left axis), line = **% of sets at RIR 0** (right axis, `%`). Duration sets (`rir` null) out of the denominator. Default drawer RIR is 2, so 0 is always declared. No green/red tone on “more grinders”. Circuit PBs ≠ `was_pr`.

7j: one point per session. 30j / 100j: ISO week (RIR % = mean of session % in the week).

### Équilibre

Not “Strength Balance”. Same word as History: **Équilibre** / **Balance**. Pill `{score} · {band}` + delta vs the **same-length shifted** window. Radar of the 13 `MUSCLE_TAXONOMY` groups (current fill, previous dashed). Body map and agonist pairs stay in History.

### Récurrents / Regulars

Not “Staples”, not “top volume”. Ranking: **frequency × recency over 100d**, top ~8, all finished logs. Programme **annotates** (`Sur le programme` / `Hors plan`), does not filter. Type-aware metric + sparkline. Cindy may appear here (habit) **and** under Circuits (score).

### Circuits

Named catalog benchmarks only (slug / fingerprint). Score type-aware: AMRAP = `{rounds}+{leftover}`. Jetable Tours completion-time stays in History. Stats: runs in window, distinct circuits, PBs in window. Olympians `{n} / 4` is a pill, not a fourth stat.

---

## Copies (FR / EN)

See `file:docs/visions/profile-copy-deck.canvas.tsx` for slot-by-slot strings. Headings:

| Section | FR | EN |
| --- | --- | --- |
| — | Profil | Profile |
| Succès | Succès | Achievements |
| Pulse | *(no H2)* | *(no H2)* |
| Rythme | Rythme | Rhythm |
| Mix | Mix | Mix |
| Records | Records | Records |
| Équilibre | Équilibre | Balance |
| Récurrents | Récurrents | Regulars |
| Circuits | Circuits | Circuits |

Product names stay untranslated: Quick Workout, RIR, PR, PB, AMRAP.

---

## Out

- Public / social profile
- History rewrite, Activity heatmap, calendar, session list
- Monthly sessions chart
- Body map on Profil
- Account form, PAT, DELETE (Settings later)
- HOLD honor-rate as a % (suggestions are live, not historized)
- Set-level PR count as the hero
- Pin-your-staples
- Hevy metric chips on plank / AMRAP / Circuit

---

## Current code (starting point, not the target)

- `file:src/pages/AccountPage.tsx` — onboarding form + badge showcase + PAT + delete. Drawer identity card points here with a Settings icon (`file:src/components/SideDrawer.tsx`).
- `file:src/pages/HistoryPage.tsx` — all-time counts, Activity 100d, by-exercise, Balance 30d.
- Aggregates already in play: `get_training_activity_by_day`, `get_volume_by_muscle_group`, `was_pr`, `get_badge_status`, Circuit AMRAP history.
- Quick Workout: `workout_days.program_id` null.

---

## To grill before Epic Brief (delivery, not vision)

- v1 slice vs full inventory (target = full; cut is a briefing choice)
- Mix partition rule (exclusive vs origin + Circuit overlay)
- HOLD: live line / persist ledger / agent-only
- First-paint query budget (pulse minutes are cheap; staples sparklines, PR agg, radar, circuit PBs are not)
- Dual-axis Records in the app chart stack (canvas combo is custom SVG; production needs a real combo)
- Empty / sparse windows
- `/profile` vs `/profile/dashboard` nesting (Library-style)

Do **not** start implementation from the canvas as a pixel spec. It is the target shape and the copy deck.
