# Epic Brief — Circuit Catalog shelf (#483)

## Summary

Athletes can browse the GymLogic **Benchmark Circuit** roster (Cindy + Pantheon) from SideDrawer → Bibliothèque → **Circuits**, without opening a program day. The page is an encyclopedia: list + slug detail (story, Rx, personal history / PB). **Meet Cindy** stays the only drop verb. No instantiate, no ad-hoc day, no blank create, no badge chrome.

---

## Context & Problem

**Who is affected:** Anyone who wants to read Zeus / Cindy / Hades without already being in the Builder. Returning users with a program; curious athletes who have never run a seed.

**Current state:**
- Nine GymLogic seeds live in `benchmark_circuits` (`owner_id` NULL, ASCII `slug`).
- The only browse UI is Builder **Add Exercise → Circuits**, which **instantiates** on the current **workout day** and closes (**Meet Cindy**, #393).
- Story + PB already load by catalog id (`useBenchmarkCompletionHistory`) but only mount on `BlockHistorySheet` after a logged run.
- **Library** drawer children are Programmes and Exercices. `/library` index redirects to programs.

**Pain points:**
| Pain | Impact |
|---|---|
| Roster is behind a day-under-edit trapdoor | Pantheon is invisible unless you already know to open the Builder |
| Story lives only on the history sheet | First visit cannot read Holland / Zeus copy |
| `CircuitSeedCard` tap is instantiate | Reusing the picker card on a shelf would write a block with no `dayId` |

---

## User Stories

1. As an athlete, I want a **Circuits** link under Bibliothèque in the SideDrawer, so that I can open the roster without a day under edit.
2. As an athlete on `/library/circuits`, I want every GymLogic seed as a card (`label`, AMRAP cap, tagline), so that Cindy is no longer the only named WOD I can find.
3. As an athlete, I want tapping a card to **navigate** to `/library/circuits/:slug`, so that I read the encyclopedia instead of dropping the seed on a day.
4. As an athlete on a seed detail, I want the canonical `label`, tagline, story, and Holland-style `reference` when present, so that the WOD has a voice before I ever GO.
5. As an athlete on a seed detail, I want the frozen Rx stations with localized exercise names and amounts, so that I know what Zeus actually is.
6. As an athlete who has never run this seed, I want an empty history state (`noPrYet`), so that the page still works as an encyclopedia.
7. As an athlete who has finished runs, I want the same AMRAP score list / PB treatment as the history sheet, keyed by catalog id, so that the shelf and history do not disagree.
8. As an athlete, I never want my **Circuit Forks** or private named circuits on this list, so that Circuits stays curated GymLogic.
9. As an athlete, I never want a tap on this shelf to call `instantiateBenchmark`, so that **Meet Cindy** remains the only drop.
10. As an athlete on an unknown or fork slug, I want a not-found state with a back link to the list, so that `/library/circuits/lunch-12` does not look like Zeus.
11. As an athlete offline, I want a clear empty/offline treatment on history, so that a failed fetch is not a blank Zeus.
12. As an athlete on `/library`, I still land on Programmes, so that legacy bookmarks do not become a WOD aisle.
13. As an athlete in the Builder picker, I still instantiate on tap, so that this epic does not break **Meet Cindy**.

### Success measures

| Story # | Measure |
|---|---|
| 3, 9 | 0 calls to `useInstantiateBenchmarkOnDay` / `instantiateBenchmark` from `/library/circuits*` |
| 8 | List query is `owner_id IS NULL` (forks never appear) |

---

## Scope

**In scope:**
- Drawer child `library:drawerCircuits` → `/library/circuits`
- List of GymLogic seeds via `useBenchmarkSeeds`
- Detail `/library/circuits/:slug` (slug URL enforces curated roster — forks have `slug` NULL)
- Story header reuse (`BenchmarkStoryHeader`)
- Rx stations resolved via `fetchExercisesByIds` + `useCatalogLabels`
- Personal AMRAP history / PB via `useBenchmarkCompletionHistory` (do **not** mount `BlockHistorySheet`)
- ADR: encyclopedia under Bibliothèque; ranked / share / publish never land here
- Glossary: **Circuit Catalog** v1 is this shelf; **Meet Cindy** stays the picker

**Out of scope:**
- Instantiate / add-to-day from the shelf (`AddExerciseToDaySheet`)
- Home / Quick Workout **Do Cindy** CTA (ADR 0016 on-ramp — still later)
- Blank **Create circuit** (T144)
- Ad-hoc `program_id: null` day lifecycle
- Circuit Forks / user-owned rows on the list
- Achievement chips (#482)
- Live leaderboards, publish, `visibility`, share
- Olympien / Héros matrix grouping (editorial, not columns — ADR 0017)
- Picker Info dialog (picker stays dumb; shelf is the Info)
- Search on nine rows
- Changing `/library` index away from programs

---

## Success Criteria

- **Numeric:** 0 instantiate calls from the shelf routes. 0 forks (`owner_id` set) on the list. 9 GymLogic cards when seeds are loaded.
- **Qualitative:** An athlete can open Bibliothèque → Circuits, read Zeus’s story and Rx without a program day, see `noPrYet` or their PB, and still drop Zeus only from **Meet Cindy**. Programmes and Exercices jobs are unchanged.
