# ADR 0019 — Circuit achievement Cast Clearing and Spidey rounds

- **Status:** Accepted
- **Date:** 2026-08-17
- **Decided in:** grill for [#482](https://github.com/PierreTsia/workout-app/issues/482)

## Context

GymLogic ships nine **Benchmark Circuit** seeds (Cindy + eight Pantheon). Achievement groups already use one numeric `metric_type` per accordion row, granted by `check_and_grant_achievements` / `get_badge_status`. Collection-style tracks (touch every god) do not fit a naive “distinct count 1→4 maps to bronze→platinum” ladder: the third god is not harder than the first, and diamond must stay rare.

Cindy already has a scored identity (`amrapScore` / history PB) and an editorial Holland `reference` of 27 rounds. Leftover reps live in ragged `set_logs`, not on `block_runs`. Badges must not appear on the **Circuit Catalog** encyclopedia (ADR 0018).

## Decision

We will:

1. Define a **Circuit Achievement Run** as a finished **Block Run** on a GymLogic seed (`owner_id` NULL) with AMRAP `fullRounds ≥ 1`. TIME-empty closes, **Circuit Fork**s, and jetable Circuits do not count.
2. Add five achievement groups (sort_order 12–16):
   - `circuit_runner` — count of those runs (thresholds 1 / 5 / 15 / 40 / 100)
   - `spidey` — Cindy PB in **full rounds only** (1 / 10 / 18 / 23 / 27); diamond equals Holland 27, not 28+; leftover does not cross tiers
   - `olympians` / `heroes` / `pantheoniste` — **Cast Clearing** = `MIN` of per-seed run ledgers over hardcoded casts (4 Olympiens, 4 Héros, 8 Greeks). Thresholds 1 / 5 / 10 / 50 / 100. Surplus on one seed is advance, not waste.
3. Keep accordion progress as the numeric metric only in v1 (no bottleneck-seed chrome).
4. Grant retroactively on the next session finish via the existing RPC overlay path. No ship-date cutoff.
5. Keep badge surfaces on `/achievements` + session unlock UI only — not under **Library** / **Circuit Catalog**.

User-facing group titles (slug unchanged): *Circuit runner*, *L’Araignée* / *Spidey*, *Au sommet de l’Olympe* / *Olympus Summit*, *Le tour des Héros* / *Heroes’ Tour*, *Le Pantheoniste* / *Pantheoniste*. Tier titles and `groupDescriptions` copy land in the Epic Brief, not here.

## Consequences

- **Positive:** Collection grind is honest (no spam-Zeus diamond). Spidey and Cindy history share round identity without encoding leftover in SQL for tiers. Five ranks stay on every new group. Catalog stays encyclopedia.
- **Negative:** Cast membership is a hardcoded slug list (same class of debt as editorial **Olympien** / **Héros**). Pantheoniste diamond is a very long grind (~800 runs). Accordion will not explain which seed is the bottleneck in v1.
- **Follow-ups:** Epic Brief + Tech Plan for #482 (RPC CTE branches, seeds, i18n, titles). Optional later: bottleneck hint under collection progress. Product copy such as “3+ diamonds ⇒ transformed” is marketing, not a DB rule.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| Distinct 1/2/3/4 as bronze→platinum, no diamond | Makes the 3rd god “worth” gold; diamond nowhere to go |
| Diamond = finish the cast once | Too easy for the top rank |
| Collection metric = total runs / cast size | Allows diamond by repeating one seed |
| Spidey diamond = 28+ or leftover-aware decimal score | Fights Holland `reference` 27; leftover complexity for no tier crossing |
| Badge chips on `/library/circuits/:slug` | Violates ADR 0018 encyclopedia boundary |
| Ship-date cutoff or silent backfill migration | Breaks the #218 retroactive grant contract |
