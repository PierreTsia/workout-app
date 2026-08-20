# Epic Brief — Benchmark Circuit achievement tracks (#482)

## Summary

Finishing GymLogic **Benchmark Circuits** finally feeds `/achievements`. Five new groups — **Circuit runner**, **L’Araignée** (*Spidey*), **Au sommet de l’Olympe**, **Le tour des Héros**, **Le Pantheoniste** — grant Bronze→Diamant from **Circuit Achievement Run**s and Cindy’s round PB, via the existing `check_and_grant_achievements` / `get_badge_status` RPCs and the session-finish overlay. The **Circuit Catalog** stays browse-only (ADR 0018 / 0019); no new React surface beyond the data-driven accordion.

---

## Context & Problem

**Who is affected:** Athletes who run Cindy or Pantheon seeds and open Succès; returning athletes whose history already sits on `block_runs`.

**Current state:**
- Nine GymLogic seeds on `main` (#398, #480 / #481). History / PB key on `block_runs.benchmark_circuit_id` and `templateFingerprint`.
- Achievements (#129 / #218): tables `achievement_groups` (slug + `metric_type`), `achievement_tiers` (Bronze→Diamant, `threshold_value`), `user_achievements`. 11 groups; each `metric_type` is one `UNION ALL` branch in **both** RPCs (`file:supabase/migrations/20260802170000_secure_definer_rpcs.sql`).
- Grant path: session finish → `syncService` RPC → overlay queue + `lastSessionBadgesAtom`. Accordion (`file:src/components/achievements/AchievementAccordion.tsx`) is data-driven — N groups, no new component for a generic track.
- No existing metric joins `block_runs` / `benchmark_circuits`. Completing Zeus is invisible to `/achievements`.

**Pain points:**
| Pain | Impact |
|---|---|
| Catalog identity without achievement identity | Pantheon / Cindy work never shows on Succès |
| Naive "1 god = next rank" ladder | Third seed would "cost" gold; diamond nowhere honest |
| Score leftover vs badge SQL | Risk of Spidey disagreeing with the history PB |
| Badge chrome on the Library shelf | Would turn the encyclopedia into a leaderboard (ADR 0018) |

**Decision record:** all forks are resolved in ADR `file:docs/adr/0019-circuit-achievement-cast-clearing-and-spidey.md`. Glossary terms **Circuit Achievement Run**, **Cast Clearing**, **Circuit runner**, **Spidey**, **Olympians**, **Heroes**, **Pantheoniste** live in `file:docs/CONTEXT.md`.

---

## User Stories

1. As an athlete on `/achievements`, I want five new accordion rows at `sort_order` 12–16 with the locked FR/EN titles, so that circuit work has a home next to the existing 11 tracks.
2. As an athlete, I want **Circuit runner** progress = count of **Circuit Achievement Run**s across all GymLogic seeds (Cindy included), thresholds 1 / 5 / 15 / 40 / 100, so that any finished seed feeds a volume track.
3. As an athlete, I want **L’Araignée** progress = my Cindy PB in **full rounds only** (1 / 10 / 18 / 23 / 27), so that diamond means equaling Holland (27), not beating him (28+), and leftover reps never cross a tier.
4. As an athlete, I want **Au sommet de l’Olympe** / **Le tour des Héros** / **Le Pantheoniste** progress = **Cast Clearing** (`MIN` of per-seed run ledgers) with thresholds 1 / 5 / 10 / 50 / 100, so that spam on one seed cannot buy the next tier.
5. As an athlete with surplus Zeus runs, I want those runs kept on Zeus’s ledger as advance, so that when other cast seeds catch up the clearing count rises without re-running Zeus.
6. As an athlete, I want Pantheoniste’s cast to be the eight Greek seeds only (Cindy excluded), so that Spidey stays Cindy’s track and the capstone stays Greek.
7. As an athlete who GO + TIME with `fullRounds = 0` (empty `0+0`), I want that close to count for **zero** across all five metrics, so that an empty finish cannot bronze anything.
8. As an athlete on a **Circuit Fork** or jetable Create-circuit block, I want those runs ignored by all five groups (`owner_id` NULL seeds only), so that only GymLogic catalog work grants.
9. As an athlete who finishes a session after ship, I want `check_and_grant_achievements` to evaluate my **full history** and unlock every tier already earned, so that early Cindy / Pantheon athletes are not punished.
10. As an athlete unlocking several tiers at once on the first post-ship finish, I want the existing overlay / `SessionBadges` queue to surface them, so that retroactive grants still feel earned.
11. As an athlete under Bibliothèque → Circuits, I never want achievement chips or progress on the catalog list or seed detail, so that the **Circuit Catalog** stays browse-only (ADR 0018).
12. As an athlete viewing collection progress, I want the same numeric `current / threshold` treatment as other groups (the `MIN` value), so that v1 needs no bottleneck UI.
13. As an athlete with Display Locale FR or EN, I want group names, descriptions, ranks, and tier titles localized, so that Succès stays bilingual like #218.
14. As an athlete offline or when the grant RPC fails, I want session finish to still succeed and achievements to reconcile on a later sync, so that badges never block training.
15. As an athlete opening Succès with no circuit history, I want the five groups visible but locked at bronze with 0 progress, so that empty state matches the other tracks.
16. As an athlete, I want tier `icon_asset_url` nullable like other groups, so that missing art is not a blocker for #482.
17. As a Cindy run that also touches the runner track, I want a single finished run counted for **Circuit runner** and **Spidey** (and, for a Pantheon seed, its quatuor plus **Le Pantheoniste**), so that one session correctly advances every track it belongs to.

### Success measures

| Story # | Measure |
|---|---|
| 9 | After one finished session post-migrate, every historically earned tier for the five groups appears in `user_achievements` / `get_badge_status` |
| 3 | Spidey diamond unlocks at PB `fullRounds ≥ 27`; a `26+N` leftover never unlocks diamond |
| 4 | Zeus×100 with the other three Olympiens at 4 reports `olympians.current_value = 4` |
| 7 | A run with `fullRounds = 0` changes no `current_value` across the five groups |

---

## Scope

**In scope:**
- Seed 5 `achievement_groups` + 25 `achievement_tiers` (slugs, titles, thresholds, `sort_order` 12–16) in one migration.
- Extend **both** RPCs with metric branches for the five new `metric_type`s (identical SQL in grant + status), reading `block_runs` joined to `benchmark_circuits` on the GO-snapshot FK, filtered to `owner_id IS NULL` and `fullRounds ≥ 1`.
- **Cast Clearing** = `MIN` over per-seed run counts for a hardcoded slug cast; **Circuit runner** = total run count; **Spidey** = Cindy PB full-rounds.
- i18n: `groups.*`, `groupDescriptions.*`, tier titles in `fr` / `en` `achievements.json`.
- Test hygiene: local `Local seed circuit%` history must not inflate production-shaped assertions (script vs prod boundary).

**Locked tier titles** (thresholds Bronze / Argent / Or / Platine / Diamant):

| Slug | Thresholds | Bronze | Argent | Or | Platine | Diamant |
|---|---|---|---|---|---|---|
| `circuit_runner` | 1 / 5 / 15 / 40 / 100 | Premier tour · First Lap | En rythme · In Cadence | Sans relâche · No Break | Workout machine · Workout Machine | Star des circuits · Circuit Star |
| `spidey` | 1 / 10 / 18 / 23 / 27 | Baby Spidey · Baby Spidey | Side-kick · Sidekick | Araignée du quotidien · Everyday Spidey | Au bord du 27 · Edge of 27 | À la table de Holland · Holland’s Table |
| `olympians` | 1 / 5 / 10 / 50 / 100 | Selfie avec Zeus · Zeus Selfie | Nectar gratis · Free Nectar | Banquet divin · Divine Banquet | VIP Olympe · Olympus VIP | PDG de l’Olympe · Olympus CEO |
| `heroes` | 1 / 5 / 10 / 50 / 100 | Stage chez Héraclès · Intern for Heracles | GPS de Thésée · Theseus GPS | Atlas porte tes courses · Atlas Holds Your Bags | Achille sans talon · Achilles, No Heel | DRH des héros · Heroes’ HR |
| `pantheoniste` | 1 / 5 / 10 / 50 / 100 | Badge d’entrée · Pantheon Guest Pass | Collectionneur de statues · Statue Collector | Guide du musée grec · Greek Museum Guide | Conservateur du temple · Temple Curator | Le 9e du Panthéon · Ninth of the Pantheon |

**Group titles / order:**

| `sort_order` | Slug | FR | EN |
|---|---|---|---|
| 12 | `circuit_runner` | Circuit runner | Circuit Runner |
| 13 | `spidey` | L’Araignée | Spidey |
| 14 | `olympians` | Au sommet de l’Olympe | Olympus Summit |
| 15 | `heroes` | Le tour des Héros | Heroes’ Tour |
| 16 | `pantheoniste` | Le Pantheoniste | Pantheoniste |

**Casts (hardcoded slug lists in the RPC CTE):**
- Olympiens: `zeus`, `ares`, `athena`, `hades`
- Héros: `heracles`, `theseus`, `atlas`, `achilles`
- Pantheoniste: the eight above (Cindy excluded)
- Circuit runner: all `owner_id IS NULL` seeds (Cindy + eight)
- Spidey: `cindy` only

**Out of scope:**
- `groupDescriptions.*` final copy (drafted in tickets, per C2).
- Equip / showcase behavior for circuit tiers beyond default (per C3).
- Badge UI on the **Circuit Catalog** / history-sheet chrome beyond the existing overlay.
- Bottleneck-seed progress ("Athena 4") — follow-up.
- Per-seed accordion rows (one row per WOD).
- Live leaderboards, share, `visibility`.
- Tours / pyramidal benchmark achievements.
- Badge art / icon assets.
- The product line "3+ diamonds ⇒ transformé" as a coded cross-group rule (marketing copy only).
- New achievement **tables** if a CTE branch + seed rows suffice.

---

## Success Criteria

- **Numeric:** 5 groups × 5 tiers seeded; both RPCs return coherent `current_value` and unlocks for fixtures covering Circuit runner count, Spidey 27, Cast Clearing `MIN`, fork exclusion, and `fullRounds = 0` exclusion.
- **Qualitative:** An athlete with mixed Pantheon + Cindy history sees correct locked/unlocked state on Succès after one finish; Library circuit pages render unchanged (no badge chrome).
- **Contract:** Spidey diamond ↔ Holland 27 (full rounds); collection diamond ↔ 100 **Cast Clearing**s; no grant from forks, jetable circuits, or empty-TIME closes.

---

## References

- Decision record: ADR `file:docs/adr/0019-circuit-achievement-cast-clearing-and-spidey.md`
- Encyclopedia boundary: ADR `file:docs/adr/0018-circuit-catalog-encyclopedia-under-library.md`
- Glossary: `file:docs/CONTEXT.md` (**Circuit Achievement Run**, **Cast Clearing**, **Circuit runner**, **Spidey**, **Olympians**, **Heroes**, **Pantheoniste**)
- RPCs: `file:supabase/migrations/20260802170000_secure_definer_rpcs.sql`
- Score: `file:src/lib/amrapScore.ts`
- Grant path: `file:src/lib/syncService.ts`, `file:src/components/achievements/AchievementUnlockOverlay.tsx`
- Roster / identity: #398, #480 / #481; achievement foundation: #129, tracks: #218, UI: #174
- Issue: [#482](https://github.com/PierreTsia/workout-app/issues/482)
