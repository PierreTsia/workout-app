# T201 — Catalog `label` + Cindy heading

## Goal

Le nom d’un **Benchmark Circuit** n’est plus le Title Case du slug. Colonne `label`, Cindy backfill `'Cindy'`, instantiate / picker / history / fork / QW hydrate lisent ce champ. Stories 5, 6, 7, 14.

## Mode

**AFK** — `label` vs slug, Cindy sans emoji, fork copie, Layers inchangé : tout est dans le Tech Plan.

## Slice

`rebase onto origin/main (#479)` → `ADD COLUMN label` + Cindy backfill → types → instantiate twins → CircuitSeedCard / history / fork / QW select → vitest + Deno

## Dependencies

None. Prerequisite git : rebase `feat/480/pantheon-benchmark-seeds` onto `origin/main` (`51016b4` Meet Cindy #479) **before** writing code. Unblocks T202.

## Scope

### Rebase

- Rebase onto `origin/main` so `CircuitSeedCard`, `useBenchmarkSeeds`, `seedSearch` exist. Do not reimplement the picker.

### Schema

- `ALTER TABLE benchmark_circuits ADD COLUMN label text;` — **nullable** this ticket (T202 sets NOT NULL after the 8 INSERT).
- `UPDATE benchmark_circuits SET label = 'Cindy' WHERE slug = 'cindy';`
- Cindy tagline / story / reference / Rx **untouched**.

### Types & parse

- `file:src/types/database.ts` `BenchmarkCircuit.label: string | null` (narrow to `string` in T202).
- `BenchmarkCircuitLookup` (PWA + Edge) gagne `label`.
- `CatalogPreviewRow` + `parseCatalogPreviewRow` : `label` string ; drop the row if missing/blank (same honesty as corrupt Rx).
- `useBenchmarkSeeds` + QW `fetchCatalogPreviewRows` SELECT `label`. `ORDER BY slug` can land here (stable even with 1 seed) or T202 — prefer **here** so T202 tests don’t flap.

### Display / instantiate / fork

- `catalogDisplayName` : non-empty `label` wins ; else Title Case slug.
- `instantiateBenchmark` PWA + Edge : `block.label = catalog.label` (no `seedLabel(slug)`).
- `circuitFromCatalog` / `seedLabelFromSlug` (`file:supabase/functions/mcp/lib/createProgramValidation.ts`) : same.
- `generatedCircuitFromCatalog` : `label` from catalog.
- `CircuitSeedCard` : titre / `aria-label` = `seed.label`. Lucide `Layers` stays.
- `sessionBlockHeading` / `BlockHistorySheet` / `useBenchmarkCompletionHistory` SELECT `label`.
- `buildForkInsertRow` copies `label`.

### Tests

- Cindy fixtures : heading / instantiate / card / fork still `'Cindy'`.
- New : lookup with `label: 'Zeus ⚡'` instantiates that string (can use a fake row ; no Zeus seed yet).
- Edge twin instantiate asserts the same.

## Out of Scope

- 8 pantheon INSERT, ensure-stubs, `SET NOT NULL` → **T202**.
- Skill / ADR / glossary → **T203**.
- `replaceCatalogCircuits` / `CINDY_SEED_KEYS` (select hydrate only).
- `label_fr` / `label_en`. Tours catalog.

## Acceptance Criteria

- [ ] Branch rebased onto `origin/main` ; `CircuitSeedCard.tsx` exists.
- [ ] Seed Cindy has `label = 'Cindy'` ; slug/Rx/tagline/story/reference byte-identical otherwise.
- [ ] Picker Circuits card accessible name is `Cindy` from `label`, not a hardcoded Title Case in the card.
- [ ] `instantiateBenchmark` (PWA **and** Edge) writes `exercise_blocks.label` from catalog `label`.
- [ ] Circuit Fork insert copies `label`.
- [ ] QW catalog preview SELECT includes `label` ; `generatedCircuitFromCatalog` uses it.
- [ ] `rg` : `replaceCatalogCircuits` / `CINDY_SEED_KEYS` unmodified.
- [ ] Vitest + Deno twins green.

## References

- Epic Brief `file:docs/Epic_Brief_—_Pantheon_#480.md` (stories 5–7, 14)
- Tech Plan `file:docs/Tech_Plan_—_Pantheon_#480.md` (label column, twins, fork copy, QW select)
