# ADR 0020 — Program identity URL and published score rubric

- **Status:** Accepted
- **Date:** 2026-08-22
- **Decided in:** `grill-with-docs` for [#504](https://github.com/PierreTsia/workout-app/issues/504) — `file:docs/Epic_Brief_—_Program_Identity_+_Scoring_#504.md` + `file:docs/Tech_Plan_—_Program_Identity_+_Scoring_#504.md`

## Context

A **Program** is identity-thin: name, active / archived, a week of days. Today that identity is a bottom sheet (`ProgramDetailSheet`) opened from « Détails ». **Builder** is `/builder/:id` — a CMS with no week-level readout. **Équilibre** grades *executed* volume. `profile.goal` and template `primary_goal` pick a recipe; they do not grade the live week.

Without a URL, a **Program** is a filename. Without a published **Program Score Rubric**, four numbers on a card are a vibe we cannot sell. Folding **Circuits** into the set integer makes Cindy fifteen séries de pecs. Scoring `set_logs` would make the character sheet last month’s diary.

**Program Identity v1** is [#504](https://github.com/PierreTsia/workout-app/issues/504). The live-while-editing Builder banner is [#519](https://github.com/PierreTsia/workout-app/issues/519) — same scorer, not this epic.

## Decision

We will:

1. Give every **Program** a **Program Page** at `/programs/:id` under `AppShell`, sibling of `/builder/:id`. Not `/library/programs/:id`. Not a sheet. Card tap navigates; `ProgramDetailSheet` dies.
2. Score **intent** only — the week as written (days + **Template Prescription** + catalog embed). Never `set_logs`. **Équilibre** stays on Profil.
3. Compute in the client: `scoreProgram` over a `ProgramIntent`. No score columns on `programs`. No RPC. Derived, cacheable, golden-testable without Postgres.
4. Publish three **Goal Tracks** (hypertrophy / strength / endurance) as bands, plus **Program Balance** as the only 0–100. The character sheet is *equal* — no pin, gold, or filter on `profile.goal`. Weight loss and `general_fitness` are not tracks.
5. Treat **Circuit in Program Scores** as first-class: a **Circuit** is a unit; **AMRAP** and **Tours** share math; stations are muscle identities (presence once per station per block), never `rounds ×` sets. Hypertrophy volume and strength do not explode stations.
6. Keep thresholds in `file:src/lib/programScore/bands.ts` — the published **Program Score Rubric**, labeled draft-to-defend. The **Program Page** is the defense surface; this ADR backs it. We do not ship mute gauges.
7. Treat empty ≠ `short`: 0 days / 0 items → no scores (CTA to edit), not a fail. A thin week may honestly band `short`. Circuit-only: endurance and **Program Balance** may show; hypertrophy volume and strength stay empty.
8. Leave the live Builder banner to [#519](https://github.com/PierreTsia/workout-app/issues/519). **Edit** in v1 is an exit to today’s Builder.
9. Keep **Program Score Copy** in coach voice. UI must not leak glossary (**Goal Track**, **Exercise Slot**, `CV`, `log1p`, …). The HITL pass is T241.

Glossary for the terms above: `file:docs/CONTEXT.md`.

## Consequences

- **Positive:** A **Program** has a URL you can open twice. Two weeks are comparable on the **Library Programs** card. A beginner can disagree with a sentence instead of swallowing a vibe. [#519](https://github.com/PierreTsia/workout-app/issues/519) reuses the same scorer.
- **Negative:** `/programs` sits next to `/library/programs` — someone will try to nest it. Client-side scores lie if Builder writes skip intent-cache invalidation (Tech Plan constraint). Draft bands will be argued in public; that is the point.
- **Follow-ups:** [#519](https://github.com/PierreTsia/workout-app/issues/519) live banner. T241 copy pass. [#503](https://github.com/PierreTsia/workout-app/issues/503) Builder floor. Clone / share stay later.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| `/library/programs/:id` | Library already hosts three catalogs (ADR 0018). Identity is a sibling of **Builder**, not a fourth encyclopedia child |
| Keep `ProgramDetailSheet` | No URL, no rubric surface, three objects (sheet / Builder / Home) |
| Score `set_logs` / reuse **Équilibre** | Wrong grain — executed **Sessions**, not the week as written |
| Persist scores on `programs` or an RPC | Derived document; stale the moment you edit a day |
| Pin or gold `profile.goal` | Lies the first time the week diverges from onboarding |
| Fold **Circuits** into the set integer | Cindy becomes fake hypertrophy volume |
| 0–100 on a **Goal Track** | Undefendable vibe; **Program Balance** is the only percentage |
| Treat empty as `short` | Punishes a blank program; empty is “add a day”, not a fail |
| Ship mute gauges, hide `bands.ts` | We will have to sell this; thresholds are a product claim |
| Live Builder banner in #504 | That's [#519](https://github.com/PierreTsia/workout-app/issues/519); v1 **Edit** is an exit |
