# T207 — ADR 0018 + glossary + paper trail

## Goal

Lock the encyclopedia-under-Library decision in git: ADR 0018, **Circuit Catalog** / **Meet Cindy** glossary, epic brief + tech plan + tickets already in `docs/`. Stories 12 conceptually (index stays programs). Unblocks T204.

## Mode

**AFK** — files are written; this ticket is the commit that makes them the source of truth.

## Slice

`docs/adr/0018-…` → `docs/CONTEXT.md` → brief / plan / T204–T206 already on disk → one commit

## Dependencies

None.

## Scope

### Must be in the commit

- `file:docs/adr/0018-circuit-catalog-encyclopedia-under-library.md`
- `file:docs/Epic_Brief_—_Circuit_Catalog_shelf_#483.md`
- `file:docs/Tech_Plan_—_Circuit_Catalog_shelf_#483.md`
- `file:docs/T204_—_Drawer_+_Circuits_list.md`
- `file:docs/T205_—_Seed_detail_story_+_Rx.md`
- `file:docs/T206_—_Shelf_history_PB.md`
- `file:docs/T207_—_ADR_0018_+_glossary_+_paper_trail.md` (this file)
- Glossary patches in `file:docs/CONTEXT.md`:
  - **Circuit Catalog**: v1 is the `/library/circuits` encyclopedia (GymLogic seeds, browse-only). North-star ranked / share / publish still later and **not** under Bibliothèque (ADR 0018). Remove “No Circuit Catalog UI in #398 v1” as if the shelf did not exist.
  - **Meet Cindy**: still Builder picker drop; still no home CTA; **strike** “no `/library` shelf” — the shelf is a different job. Picker still has no Info (story is on the shelf + history).

## Out of Scope

- Production TS/TSX.
- Removing `needs-grilling` on GitHub (human).

## Acceptance Criteria

- [ ] ADR 0018 exists and says: third Library child, seeds only, tap = navigate, ranked/social never under Bibliothèque.
- [ ] `CONTEXT.md` **Circuit Catalog** describes the shelf route and still forbids social WOD-shelf fusion.
- [ ] `CONTEXT.md` **Meet Cindy** no longer claims there is no `/library` shelf.
- [ ] Brief, tech plan, T204–T206 are in the same commit.
- [ ] No `src/` changes in this commit.

## References

- Epic Brief `file:docs/Epic_Brief_—_Circuit_Catalog_shelf_#483.md`
- Tech Plan `file:docs/Tech_Plan_—_Circuit_Catalog_shelf_#483.md`
- Issue [#483](https://github.com/PierreTsia/workout-app/issues/483)
