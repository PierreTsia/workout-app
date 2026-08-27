# Epic Brief — Program Identity + Scoring (#504)

## Summary

A **Program** becomes a first-class object: a **Program Page** at `/programs/:id` and **Library Programs** cards that show *why the week exists* — three **Goal Tracks** (hypertrophy, strength, endurance), **Program Balance**, and **Program Facts** — scored from the week as written, not from `set_logs`. Rules are in-app and pedagogical (**Program Score Rubric**, **Program Score Copy**). **Program Identity v1** stops there: **Edit** exits to today's **Builder**; no live banner, no Hevy-floor chrome, no clone/share.

**Decision record:** `grill-with-docs` 22 Aug 2026. Issue [#504](https://github.com/PierreTsia/workout-app/issues/504). Live Builder banner: [#519](https://github.com/PierreTsia/workout-app/issues/519). Hevy-floor DayEditor / body map / insight: [#503](https://github.com/PierreTsia/workout-app/issues/503). Quarter stack: `file:docs/Milestone_Brief_—_Voir_Éditer_Envoyer.md`. Glossary: `file:docs/CONTEXT.md`. Hevy identity refs: `file:docs/Reference_—_Hevy_Program_Builder.md`.

---

## Context & Problem

**Who is affected:** Athletes who already own a **Program** (beginner and returning). All users — no `isAdmin` gate. Maintainers who must defend the **Program Score Rubric** in public.

**Current state:**
- No `/programs/:id`. Identity is `file:src/components/library/ProgramDetailSheet.tsx` (name, date, **DayCard** list).
- `file:src/components/library/ProgramCard.tsx` is name + date + actif/archivé. « Détails » opens the sheet.
- **Builder** is `/builder/:programId` (`file:src/pages/BuilderPage.tsx`) — CMS, no week-level readout.
- A **Program** row has no goal, level, or location (`file:src/types/onboarding.ts`). `UserGoal` / template `primary_goal` pick a recipe; they do not grade the live week.
- `computeBalanceScore` + `MUSCLE_TAXONOMY` (`file:src/lib/trainingBalance.ts`) power **Équilibre** on *executed* volume. Wrong grain for “what is this week.”
- **Exercise Blocks** are first-class in the day, excluded from the **Progression Engine** (ADR 0007). Scoring must not explode an **AMRAP** into fake sets.

**Pain points:**

| Pain | Impact |
|---|---|
| A **Program** is a filename | You cannot tell a 5×5 from a PPL pump without opening the CMS |
| Sheet + Builder + Home are three objects | No URL, no place to *read* the week, no place to teach a beginner |
| `profile.goal` is not the program | Stamping hypertrophie on the card would lie the first time you edit |
| A 0–100 without a rule | Looks scientific, is a vibe — we will have to sell this |
| Circuits vs séries | Cindy is not 15 séries de pecs; folding it in is a lie |

---

## User Stories

1. As an **athlete**, I want `/programs/:id` (the **Program Page**) so that a **Program** has a real identity URL — not a bottom sheet.
2. As an **athlete**, I want tapping a **Library Programs** card to open that page (and I never see `ProgramDetailSheet` again), so that there is one identity surface.
3. As an **athlete**, I want each card to show the four scores compact (3 **Goal Track** bands + **Program Balance** 0–100) and one fact line `N j · N séries · N circuits`, so that I can compare programs in the list without opening each.
4. As an **athlete**, I want the character sheet *equal* — no gold, pin, or filter on `profile.goal` — so that I see what the week *is*, not what I ticked at onboarding.
5. As a **beginner**, I want one coach sentence under each **Goal Track** on the **Program Page**, and a tap that shows the worked example *for this week* (e.g. pecs 14 séries · 2 j → ok), so that I can argue with the rule instead of swallowing a vibe.
6. As a **returning athlete**, I want the **Library** card *not* to be an essay — bands + one fact only — so that I scan, I don't study.
7. As an **athlete**, I want **Hypertrophy (Goal Track)** as a published band (`short` / `ok` / `high`) plus facts: only muscles I programmed (solo set or **Circuit** station hit); volume 8–20 weekly sets (1 / 0.5); frequency 2–3 days; rollup = share in *both* bands (`short` < ⅓, `ok` ⅓–⅔, `high` ≥ ⅔). Zeros on the 13 muscles are **Program Balance**, not an hypertrophy fail.
8. As an **athlete**, I want **Strength (Goal Track)** as the share of solo sets that are strength-shaped (reps ≤ 6 and rest ≥ 150 s), bands `short` < 20 % / `ok` 20–40 % / `high` ≥ 40 %, so that a 5×5 reads differently from a 4×10. No compound gate. **Circuits** add no strength volume. No such sets → `short` if there are solos; **empty** if there are none.
9. As an **athlete**, I want **Endurance (Goal Track)** to treat each **Circuit** as +1 (AMRAP and Tours weigh the same) plus dense solos (reps ≥ 12 or duration, rest ≤ 60 s), with the published draft bands, so that a Cindy week is endurance and a PPL 4×10 is not.
10. As an **athlete**, I want **Program Balance** as the only 0–100: `computeBalanceScore` on the intended 13-axis vector (zeros kept); solo sets 1 / 0.5; each **Circuit** station a *presence* credit once per block — never `rounds ×`. A Cindy-only week scores **low**, not empty, not “excellent.” Distinct from **Équilibre**.
11. As an **athlete**, I want **Program Facts** on the page: day count, solo set count, **Circuit** count with mode labels, equipment mix in four buckets (free weights / machines / bodyweight / other). Same grain as Balance (solos + one presence per station). No estimated minutes. Not a « salle » tag.
12. As an **athlete**, I want **Circuits** first-class everywhere: never folded into the set integer; same math for **AMRAP** and **Tours**; hypertrophy *frequency* may hit from a station, hypertrophy *volume* and strength never explode stations into sets — so Cindy is not a fake full-body hypertrophy week.
13. As an **athlete**, I want empty ≠ `short`: 0 days / 0 items → no scores (CTA to add / edit). A 1-day solo week may honestly band hypertrophy `short` on frequency. Circuit-only: endurance + Balance may show; strength and hypertrophy *volume* stay empty.
14. As an **athlete**, I want the day list on the **Program Page** read-only (name, sequence preview, circuits as units), so that I *see* the week as written.
15. As an **athlete**, I want a single **Éditer** that opens today's **Builder** at `/builder/:programId`, so that v1 does not restyle or live-score the editor. Scores refresh when I come back, not on each keystroke.
16. As an **athlete**, I want no « Commencer » on the **Program Page**, so that launching a **Session** stays on Home and we do not fork the cycle.
17. As an **athlete**, I want Activate and Archive on the card *and* on the page (same rules as today, including session-active lock on activate), so that I do not lose verbs when the sheet dies.
18. As an **athlete**, I want archived programs to still score (the week as written does not change), with the archived badge, so that a diary stays readable.
19. As an **athlete**, I want a missing or unauthorized `id` to 404 / bounce to **Library Programs**, not a blank sheet of fake `ok`s.
20. As an **athlete** offline, I want scores computed from a cached week if React Query already has it; if not, an honest empty/offline state — never a fabricated band.
21. As a **beginner**, I want all **Program Score Copy** in FR/EN coach voice (muscles, séries, jours, repos) with a dedicated HITL copy pass, so that I never see **Exercise Slot**, **Template Prescription**, `CV`, or `log1p` in the UI.
22. As a **maintainer**, I want the scorer as a pure function over the week's days + prescriptions + catalog muscles/equipment, covered by unit tests (PPL, 5×5, Cindy-only, empty, 1-day), so that we can defend the **Program Score Rubric** when someone argues a band.

### Success measures

| Story # | Measure |
|---|---|
| 7–12, 22 | Scorer is deterministic: same week fixture → same bands / Balance / facts in unit tests |
| 5, 21 | 0 glossary leaks in shipped UI strings (`src/locales/`) after the HITL copy pass |
| 2 | `ProgramDetailSheet` has no remaining call sites |
| 3, 4 | Card shows 4 scores + one fact line; no `profile.goal` chrome |

---

## Scope

**In scope:**
- Scorer module (intent only): **Goal Tracks**, **Program Balance**, **Program Facts**, empty-state contract, **Circuit in Program Scores**.
- **Program Page** `/programs/:id` — character sheet, rubric (sentence + tap), facts, read-only days, Éditer / Activer / Archiver.
- **Library Programs** cards — 4 compact scores + fact line; tap → page. Sheet removed.
- **Program Score Copy** HITL pass (FR/EN).
- Issue [#504](https://github.com/PierreTsia/workout-app/issues/504) rewritten to this slice.
- ADR for `/programs/:id` + published rubric (thresholds are a product claim).

**Out of scope:**
- Live score banner on the **Builder** ([#519](https://github.com/PierreTsia/workout-app/issues/519)).
- **Builder** Hevy floor, DayEditor restyle, body map, AI insight ([#503](https://github.com/PierreTsia/workout-app/issues/503)).
- Clone / import / export / compare (#230 and later).
- Weight loss as a track; `general_fitness` as a score; pinning `profile.goal`.
- Estimated session duration.
- **Équilibre** / History / Profil — executed volume stays there.
- #149 landmarks as hypertrophy backend.
- Start-session CTA on the **Program Page**.
- Per-day deep-link into the **Builder** (row is read-only; one Éditer).

---

## Success Criteria

- **Numeric:** Scorer fixtures (empty, 1-day, PPL-shaped, 5×5-shaped, Cindy-only) have golden outputs in CI. 0 remaining `ProgramDetailSheet` imports.
- **Qualitative:** An athlete opens **Library Programs**, sees why two programs differ, opens `/programs/:id`, reads a coach sentence they can disagree with, taps for *their* week’s numbers, hits Éditer and lands on today's Builder. No 0–100 on a **Goal Track**. No « salle ». No Start. A beginner is not spoken to in schema.
- **Product:** We can say the hypertrophy / strength / endurance / Balance rules out loud. Thresholds stay labeled draft-to-defend until the ADR + copy pass land — we do not ship mute gauges.
