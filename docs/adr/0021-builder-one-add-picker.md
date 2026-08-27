# ADR 0021 — Builder has one Add picker

- **Status:** Accepted
- **Date:** 2026-08-27
- **Decided in:** grill-with-docs for [#503](https://github.com/PierreTsia/workout-app/issues/503)
- **Amends:** ADR `file:docs/adr/0016-meet-cindy-builder-seed-drop.md` §Decision.3 (*Keep Create circuit*)

## Context

ADR 0016 put **Meet Cindy** on the **Add Exercise** picker (`Exercises | Circuits`) and **kept** page-level **Create circuit** for jetable **Exercise Block** authoring. That left two equal outline buttons on the **Builder** day editor — the CMS look #503 is replacing.

The #503 canvas (and the grilling that locked it) has a single **Add** verb. Seeds, catalog solos, and jetable Circuits share one sheet. A second page-level button would re-open the door ADR 0016 already closed for a *third* button.

## Decision

We will:

1. Give the **Builder** day editor **one** primary **Add** control. No page-level **Create circuit**.
2. Keep the picker kind toggle **Exercises | Circuits**. **Circuits** lists GymLogic **Benchmark Circuit** seeds (**Meet Cindy**) *and* the jetable **Exercise Block** authoring path (multi-select → `useCreateBlock`).
3. Leave **Meet Cindy** write semantics unchanged: tap a seed → `instantiateBenchmark` on the current programmed **workout day** → `BlockCard` in the **Unified Day Sequence**. Catalog JSONB still wins.

ADR 0016 §Decision.1–2 and §Decision.4 stay. Only the “keep **Create circuit** as a second DayEditor verb” clause is superseded.

## Consequences

- **Positive:** One add verb matches the #503 canvas and ADR 0016’s “no third button” instinct. **Meet Cindy** stays where people already search.
- **Negative:** Jetable Circuit create must be designed *inside* **Circuits** so it does not collide with seed tap-to-drop (seeds instantiate immediately; jetable needs a multi-select confirm).
- **Follow-ups:** Epic Brief / Tech Plan for #503. Picker IA for “blank Circuit” vs seed cards. Do not rewrite ADR 0016 in place.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| Keep page-level **Create circuit** | Two equal CTAs; the canvas is a lie |
| Third DayEditor button | Already rejected in ADR 0016 |
| Circuits tab only seeds; jetable dead | Loses custom supersets / finishers |
| Put jetable create back on **Exercises** confirm | Type error: multi-select solos ≠ one **Exercise Block** |
