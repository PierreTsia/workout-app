# Epic Brief — Meet Cindy (#393)

## Summary

#398 a livré Cindy comme **Benchmark Circuit**. Cet epic la rend **découvrable et droppable** sur un **workout day** de programme : le picker **Add Exercise** du Builder gagne un kind **Exercices | Circuits**, la card Cindy (nom, `AMRAP 20 min`, tagline) instancie le seed via `instantiateBenchmark` sur le jour courant. Ce n’est pas un bouton home, pas un jour ad-hoc, pas l’étagère **Circuit Catalog**.

---

## Context & Problem

**Who is affected:** Pratiquants qui éditent un programme et veulent coller Cindy (ou plus tard Zeus) sur un jour ; quiconque cherche `cindy` / `holland` dans le picker.

**Current state:**
- Cindy existe en base (`slug: cindy`, Rx JSONB, tagline / story / Holland). MCP et **Quick Workout AI** instancient déjà par catalog id (`file:src/lib/instantiateBenchmark.ts`).
- Le Builder a deux verbes : **Add Exercise** (solos via `file:src/components/builder/ExerciseLibraryPicker.tsx`) et **Create circuit** (jetable via `useCreateBlock`). Aucun des deux ne résout un seed.
- `DayEditor` est couplé à un `programId`. Le picker exercices groupe par muscle, filtre matos / difficulté. Un **Benchmark Circuit** n’a aucun de ces axes.
- T194 montre la story **après** la séance. T196 garde le crayon + **Circuit Fork**.
- Home / SideDrawer / `/library` n’ont pas de CTA Cindy (négatif T198, conservé).

**Pain points:**
| Pain | Impact |
|---|---|
| Seed invisible dans le Builder | Meet Cindy n’existe que pour MCP / QW |
| Noyer Cindy dans les muscles | Le WOD devient un exercice #847 |
| Recréer un jour ad-hoc « Do Cindy » | Mauvais verbe : les gens ont déjà un programme |
| Hardcoder 5-10-15 dans le client | Le nom redevient un nickname (anti-ADR 0015) |

---

## User Stories

**Découverte**
1. As a user editing a program day, I want **Add Exercise** to offer a kind toggle **Exercises | Circuits**, so that Circuits are first-class, not a muscle pill or a third button.
2. As a user on **Circuits** with an empty query, I want GymLogic seeds only (v1: Cindy) as WOD cards (name, `AMRAP 20 min`, tagline), so that I meet Cindy without assembling 5-10-15.
3. As a user on **Exercises** with an empty query, I want the movement catalog unchanged (no Cindy promo), so that adding a squat is not a WOD ad.
4. As a user typing `cindy`, `holland`, or `tom holland` from **Exercises**, I want the Cindy card pinned above muscle groups, so that Meet Cindy does not depend on having already opened the tab.
5. As a user on **Circuits**, I never want **Circuit Forks** in that list, so that the tab stays the curated shelf, not « mes WODs ».
6. As a user whose seed fetch is empty or errors, I still want the **Circuits** kind visible with an empty/error state inside, so that a missing migration is debuggable and the tab never silently disappears.

**Drop**
7. As a user, I want tapping the Cindy card to snapshot catalog Rx onto **this** day (`instantiateBenchmark` + same insert shape as `useCreateBlock`) and close the sheet, so that a `BlockCard` labelled Cindy appears in the **Unified Day Sequence**.
8. As a user, I want that block stamped `benchmark_circuit_id` = the seed, so that history / PR group as Cindy, not as this copy’s `block_id`.
9. As a user, I want zero Cindy Rx constants used to persist a block, so that catalog JSONB is the only source.
10. As a user, I want to be able to add Cindy even if she is already on the day, so that we do not invent a one-per-day guard.
11. As a user who taps Cindy offline (or the insert fails), I want a toast, the sheet still open, and no half-row, so that a failed Meet does not corrupt the day.
12. As a user, I want a missing `exercise_id` in the seed to fail clearly (no half-Cindy), so that instantiate stays honest.

**Non-régression**
13. As a user, I want **Create circuit** unchanged (jetable from 2+ movements, no Circuits tab), so that authoring a nameless Circuit stays a different verb.
14. As a user, I want the `BlockCard` pencil to still open **BlockEditor**, and a seed Rx edit to still **Circuit Fork** (T196), so that this epic does not invent a read-only card.
15. As a user on home / SideDrawer / `/library`, I want **no** new Do Cindy CTA, so that those jobs stay program / QW / my library.
16. As a user on pre-session **Add exercise**, I want movements only (no Cindy), so that swapping a squat for a WOD remains a type error.
17. As a user who added Cindy to Tuesday, I want Start on that programmed day to run the shipped AMRAP **Round Screen**, so that consumption reuses #475 / #398 rather than a new session path.

**Copy**
18. As a user, I want the picker card tagline in my **Display Locale** (`tagline_fr` / `tagline_en`), so that Meet Cindy is not English-only. Story remains on the history sheet — no Info in the picker.

### Success measures

| Story # | Measure |
|---|---|
| 9 | `rg` in `src/` has no Cindy Rx literal used to persist a block |
| 15 | 0 new home / SideDrawer / `/library` CTA |

---

## Scope

**In scope:**
- Kind toggle on Builder **Add Exercise** only (`ExerciseLibraryPicker` without `onCreateBlock`)
- Circuits list = GymLogic seeds (`owner_id` IS NULL, `slug` IS NOT NULL)
- WOD card + search punch-through + pin-above-muscles
- PWA mutation: `instantiateBenchmark` on current `dayId`
- Empty / error Circuits state (tab always shown)
- Toast on failed / offline tap; sheet stays open
- i18n of the kind labels + localized tagline
- Tests: picker kind + search, mutation stamps FK / copies Rx, Create circuit path untouched

**Out of scope:**
- Home / SideDrawer **Do Cindy**, ad-hoc `program_id: null` day, auto-GO, new route
- **Circuit Catalog** UI, `/library` as WOD shelf, user-publish, leaderboards, achievements
- **Circuit Forks** in the Circuits tab; Zeus seed
- Picker Info / story reader (T194 owns story)
- MCP `update_program` as the PWA write path
- Pre-session `SwapExerciseSheet` / **Create circuit** picker
- Queued offline writes
- Remembering last kind tab (always open on **Exercises**)

---

## Success Criteria

- **Numeric:** 0 persist path hardcodes Cindy’s 5-10-15; 0 new home/library CTAs.
- **Qualitative:** From a program day, a user can find Cindy (tab or search) and drop her onto that day; the block is catalog-linked; Start + history still speak Cindy. **Create circuit** still mints jetables. The empty-home / no-program user is unchanged.
