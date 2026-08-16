# ADR 0018 — Circuit Catalog encyclopedia lives under Library

- **Status:** Accepted
- **Date:** 2026-08-16
- **Decided in:** orchestrator lock for [#483](https://github.com/PierreTsia/workout-app/issues/483) (research packet + skip-grill to AFK)

## Context

[#398](https://github.com/PierreTsia/workout-app/issues/398) deferred **Circuit Catalog** UI: **Library** (`/library`) was *your* programs plus the exercise catalog, not a social WOD shelf. [#393](https://github.com/PierreTsia/workout-app/issues/393) / ADR 0016 made **Meet Cindy** a Builder seed drop and forbade a home / SideDrawer / `/library` CTA.

After Pantheon (#480 / #481) nine GymLogic **Benchmark Circuits** exist. The catalog *object* is real. The only browse UI still requires a **workout day** under edit. Story and PB already load by catalog id; they only mount after a logged run.

`CONTEXT.md` still said Library ≠ WOD shelf. Stretching Library is how ranked / share / publish fuse with “my programs.” A fourth top-level nav kingdom for nine editorial cards is the other extreme.

## Decision

We will:

1. Ship the first **Circuit Catalog** UI as a **browse-only encyclopedia**: SideDrawer → Bibliothèque → **Circuits** → `/library/circuits` and `/library/circuits/:slug`.
2. List GymLogic seeds only (`owner_id IS NULL`). Tap **navigates**; it does not `instantiateBenchmark`. **Meet Cindy** remains the only drop verb.
3. Treat this page as the exercise-catalog analogue (`/library/exercises`), not as the north-star social WOD shelf. Ranked leaderboards, publish, `visibility`, and share **never** land under Bibliothèque — they need their own surface (and a later ADR) if they ship.
4. Leave `/library` index → programs. Leave home / Quick Workout without a **Do Cindy** CTA (ADR 0016 on-ramp stays later).

ADR 0016’s “keep `/library` unchanged” is superseded **only** for this third child. The picker, Create circuit, and home stay as 0016 decided.

## Consequences

- **Positive:** Nine stories become reachable without a day under edit. One consumption verb (Meet Cindy) plus one read verb (shelf). Slug URLs cannot address **Circuit Forks**.
- **Negative:** Library now hosts three catalogs (programs, exercises, circuits). Someone will try to hang leaderboards here; this ADR exists to say no.
- **Follow-ups:** #482 badges stay on `/achievements`. Add-to-day from the shelf is a follow-up epic, not a v1 tap. Home **Do Cindy** remains blocked until explicitly re-grilled.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| Top-level `/circuits` drawer item | Honest vs the old glossary; clutters a drawer that already has History, Achievements, Library, Quick Workout |
| Keep Circuit Catalog out of `/library` entirely | Costs a new mental model for nine cards; Exercise Library already stretched Library past “yours” |
| Shelf tap = instantiate / add-to-day | Collides with Meet Cindy; `CircuitSeedCard` `onSelect` is already that write |
| Include Circuit Forks on the list | Curated roster becomes “Cindy (fork)”; Meet Cindy story 5 forbade mes WODs on Circuits |
| Home Do Cindy now that the shelf exists | Resurrects T144’s ad-hoc day with no `DayEditor` for `program_id: null` |
