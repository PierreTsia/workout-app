# T202 — 8 Pantheon seeds

## Goal

Le catalog GymLogic passe de Cindy seule à **9 seeds**. Ensure-stubs + 8 INSERT Cindy-shaped (roster / stories / aliases du brief) + `label SET NOT NULL`. Le picker Circuits les liste sans code de découverte. Stories 1–4, 8–13, 15–16, 20.

## Mode

**AFK** — roster, amounts, copy, ensure-vs-prod rule are locked. `resolve_exercises` is mechanical (MCP), not a design review.

## Slice

`resolve_exercises` prod → ensure `ON CONFLICT` + 8 INSERT + NOT NULL → `useBenchmarkSeeds` 9 cards → `seedMatchesQuery` matrix tests → vitest

## Dependencies

T201 (`label` column + plumbing). Unblocks T203.

## Scope

### Name lock (before SQL)

- Batch `resolve_exercises` for every FR movement in the Epic Brief roster.
- `matched` → that exact `exercises.name` in `WHERE name =` and in the ensure list.
- `no_match` → **do not** stub a new prod exercise. Swap lookup (errata) or stop. TSV dumps are not source of truth.

### Migration (same file)

1. Ensure-stubs : `INSERT INTO exercises (name, muscle_group, emoji, is_system, equipment, name_en) … ON CONFLICT (name) DO NOTHING` for each locked FR name. Minimal rows (local `db reset` only).
2. 8× `INSERT INTO benchmark_circuits` from `file:docs/Epic_Brief_—_Pantheon_#480.md` (canonical roster + stories). `owner_id` NULL, `reference` NULL, `rx.mode = amrap`, `weight: 0`, 3 stations, `cap_seconds` 1200 or 600. `SELECT id INTO STRICT` per name.
3. `ALTER COLUMN label SET NOT NULL`.

Aliases : `arès`, `athéna`, `hadès`, `hercule`, `héraclès`, `thésée`, `achille` as grilled.

### Read path (already lists all seeds)

- Confirm `useBenchmarkSeeds` `ORDER BY slug` (T201 or here).
- `seedMatchesQuery` tests : `arès` → Ares ; `force` → Ares **and** Theseus ; `hercule` → Heracles ; `jambes` → Hades and Achilles ; empty Circuits query → 9 cards.

### Cindy

- Assert Cindy row unchanged except `label` (already `'Cindy'` from T201).

## Out of Scope

- Skill / ADR / glossary → **T203**.
- QW `CINDY_SEED_KEYS` / `replaceCatalogCircuits`.
- Tours / pyramids / `per_round` in catalog Rx.
- 5th Olympian or Hero. Loaded Rx. Duration stations.
- Catalog expansion with full instructions (ensure stubs only).

## Acceptance Criteria

- [ ] `resolve_exercises` log or ticket comment lists each FR name → `matched` (or documented errata). Zero ensure names that are `no_match` on prod.
- [ ] After migrate : 9 rows `owner_id IS NULL` (Cindy + 8). Each pantheon slug/label/cap/tagline/Rx matches the brief table.
- [ ] Cindy slug/Rx/tagline/story/Holland `reference` byte-identical vs pre-T202 (label already `'Cindy'`).
- [ ] `label` is NOT NULL.
- [ ] `supabase db reset` (local) succeeds (ensure stubs).
- [ ] Circuits empty query shows 9 cards including `Zeus ⚡` … `Achilles 🛡️`.
- [ ] Query `force` pins Ares **and** Theseus ; `arès` pins Ares ; `hercule` pins Heracles.
- [ ] Instantiate Zeus writes `exercise_blocks.label = 'Zeus ⚡'`, AMRAP 20, 5/10/15 burpee path from catalog Rx, FK stamped.
- [ ] Missing catalog `exercise_id` at instantiate still throws (no half-Hades).
- [ ] `rg` : `replaceCatalogCircuits` unmodified.

## References

- Epic Brief `file:docs/Epic_Brief_—_Pantheon_#480.md` (roster, stories copy, stories 1–4, 8–13, 15–16, 20)
- Tech Plan `file:docs/Tech_Plan_—_Pantheon_#480.md` (ensure rule, NOT NULL, ORDER BY slug, TSV stale)
