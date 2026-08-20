# Epic Brief — Bodyweight Trinity achievement tracks (#509)

## Summary

Calisthenics work finally feeds Succès. Five new groups — **Pompes**, **Tractions**, **Squat poids du corps**, **Expert du poids du corps**, **100 jours ferme** — grant Bronze→Diamant from lifetime **Bodyweight Trinity** family reps and a 100-pompes daily streak, via the existing `check_and_grant_achievements` / `get_badge_status` RPCs, `/achievements` accordion, and session-finish overlay. HITL for ceremony and badge icons reuses the hidden playground **`/_unlock-overlay`** (`file:src/pages/UnlockOverlayPlaygroundPage.tsx`); no new HITL route. Companion issue [#510](https://github.com/PierreTsia/workout-app/issues/510) is the fifth group, not a second epic.

---

## Context & Problem

**Who is affected:** Athletes who grind Pompes / Tractions / Squat au poids du corps (and harder variants), including Cindy / Pantheon station work; anyone opening Succès.

**Current state:**
- Achievements (#129 / #218 / #482): 16 groups, data-driven accordion (`file:src/components/achievements/AchievementAccordion.tsx`), grant on session finish, overlay via **Grant Batch**.
- Metrics are session counts, kg, streaks of *weeks*, circuit run ledgers. None is cumulative reps on a named movement family.
- Catalog rows are distinct UUIDs. There is no `movement_family` column. Cindy Rx is Pompes + Tractions + Squat au poids du corps; diamond / decline / pistol / sumo are other rows.
- Circuit `set_logs` already feed Volume King and Leg Day (no block filter).
- Hidden HITL playground: **`/_unlock-overlay`** under `AppShell` (`file:src/router/index.tsx`, `file:src/pages/UnlockOverlayPlaygroundPage.tsx`). Fixtures push **Grant Batch**es onto `achievementUnlockQueueAtom`. Not in the drawer. Overlay ceremony (#491) was signed off here (T217 / T218).

**Pain points:**

| Pain | Impact |
|---|---|
| Variety / Leg Day / Volume never say “I have done a thousand pull-ups” | Calisthenics / home / Cindy athletes look empty on Succès |
| #218 Bodyweight Beast (“any BW set”) was deferred — and would have counted planks | A participation trophy, not three verbs + a master |
| A 100-day 100-pompes chain has nowhere to live | Streak King is weeks-with-any-session, not a daily quota |
| Farming sessions to see new badge art | Overlay HITL already solved this on `/_unlock-overlay`; do not invent a second playground |

**Decision record:** grill 20 Aug 2026 (this chat). Glossary: **Bodyweight Trinity**. No new ADR unless Tech Plan excludes circuit `set_logs` (it does not — they count 1:1).

---

## User Stories

1. As an athlete on `/achievements`, I want five new accordion rows at `sort_order` 17–21 with the locked FR/EN titles, so that bodyweight grind has a home after the circuit tracks.
2. As an athlete, I want **Pompes** progress = Σ numeric `set_logs.reps_logged` on the **Pompes family**, thresholds 100 / 500 / 2 500 / 10 000 / 25 000, so that lifetime reps are the metric.
3. As an athlete, I want **Tractions** progress = the same Σ on the **Tractions family**, same thresholds, so that the master bottleneck is honest (pull-ups are harder).
4. As an athlete, I want **Squat poids du corps** progress = the same Σ on the **Squat family**, same thresholds, so that air-squat volume is not confused with **Squat barre**.
5. As an athlete, I want **Expert du poids du corps** progress = `MIN` of the three family totals (same thresholds), so that rank N of the master is exactly “all three tracks at rank N” (**Cast Clearing** of reps).
6. As an athlete who logs diamond / déficit / pike / one-arm / clap / decline / HSPU pompes, I want those reps in the Pompes family, so that harder variants are not punished.
7. As an athlete who logs chin-up / prise neutre / archer / commando / front-lever tractions, I want those reps in the Tractions family, so that grip and harder variants count.
8. As an athlete who logs pistol / box pistol / dragon / cosaque / sumo (bodyweight) squats, I want those reps in the Squat family, so that “sumo etc.” counts without opening the barbell door.
9. As an athlete who logs **Pompes sur les genoux**, inclinées, négatives, **Tractions assistées**, australiennes, négatives, or **Squat barre**, I want those reps to count for **zero** on these five groups, so that regressions and loaded squats cannot buy a bodyweight badge.
10. As an athlete who logs **Squats sautés** (duration, not reps), I want those sets ignored by the Squat family, so that a hold/timer cannot inflate a rep sum.
11. As an athlete who finishes Cindy or a Pantheon seed, I want station `set_logs` on family rows counted 1:1, so that the log is the truth (same as Volume King / Leg Day). A Cindy 20 bronzes Tractions and the master — that is the on-ramp.
12. As an athlete, I want **100 jours ferme** progress = current consecutive **local calendar days** with ≥100 Pompes-family reps, thresholds 1 / 10 / 30 / 60 / 100, so that the named challenge is diamond.
13. As an athlete whose day rolls at midnight in `user_profiles.timezone`, I want the day bucketed from `set_logs.logged_at` (not session `finished_at`), so that a 23:30 Paris set cannot break a streak I did not break.
14. As an athlete who splits 50+50 pompes across two sessions the same local day, I want that day to qualify, so that the quota is daily SUM, not one-set.
15. As an athlete who misses a day (<100 family pompes), I want the displayed `current_value` to reset to 0 while already-granted tiers stay, so that the chain is honest and `user_achievements` stays insert-only.
16. As an athlete who finishes a session after ship, I want both RPCs to evaluate full history and unlock every earned tier, so that existing logs are not punished.
17. As an athlete unlocking several of these tiers in one finish, I want the existing overlay / **Grant Batch** to surface them, so that retroactive grants still feel earned.
18. As an athlete with Display Locale FR or EN, I want group names, descriptions, hints, and equippable titles localized to the locked copy below.
19. As an athlete offline or when the grant RPC fails, I want session finish to still succeed and achievements to reconcile later.
20. As an athlete opening Succès with no family history, I want the five groups visible but locked at bronze with 0 progress.
21. As an athlete, I want `icon_asset_url` nullable at seed time, so that SQL can ship before art lands.
22. As a reviewer, I want HITL of ceremony + badge icons on **`/_unlock-overlay`** only (extended fixtures for the five new slugs, Bronze→Diamant and at least one mixed batch), so that we do not farm a 100-day streak to see a medal.
23. As a reviewer, I never want a new HITL route (`/_achievements`, mock accordion, design-system gallery). Accordion copy with real `current_value` is eyeballed on existing `/achievements` after grant — that page already exists.

### Success measures

| Story # | Measure |
|---|---|
| 5 | Pull-ups 25 000, push-ups 25 000, squats 10 000 → `bw_expert.current_value = 10 000` (platine, not diamant) |
| 9 | Knee push-ups × 10 000 change no family `current_value` |
| 11 | Fixture Cindy 20 (5/10/15 × 20) → Tractions 100, Pompes 200, Squats 300, master 100 |
| 13 | Set at 23:30 Europe/Paris still counts on that local date |
| 15 | After a miss, `get_badge_status` for `hundred_a_day` reports current chain 0; gold row remains in `user_achievements` |
| 22 | `/_unlock-overlay` fires a `push_ups` diamond **Grant Batch** without a real session |

---

## Scope

**In scope:**

1. Seed 5 `achievement_groups` + 25 `achievement_tiers` (`sort_order` 17–21) in one migration. `icon_asset_url` NULL until art upload.
2. Extend **both** RPCs with five `metric_type` branches (identical SQL in grant + status). Family membership = hardcoded catalog UUID lists (FR `exercises.name` below). Numeric `reps_logged` only (`~ '^\d+$'`), same safe-cast as volume.
3. **Expert** = `MIN` of the three family sums. **100 jours ferme** = gap-detection on local dates with daily SUM ≥ 100 on the Pompes family; `current_value` = **current** chain (not `MAX`).
4. i18n: `groups.*`, `groupDescriptions.*`, `thresholdHint.*`, tier titles in `fr` / `en` `achievements.json`.
5. Badge art: generate 25 icons from `file:docs/badge-icon-prompts-bodyweight-tracks-509.md` (same recipe as `file:docs/done/badge-icon-prompts.md`), optimize, upload `badge-icons` bucket, backfill `icon_asset_url`.
6. HITL: extend `file:src/pages/UnlockOverlayPlaygroundPage.tsx` fixtures with the five new `group_slug`s (do not add a route). Recette on **`/_unlock-overlay`**. Accordion recette on existing `/achievements`.

**Bodyweight Trinity families** (canonical FR `name` → live catalog, 20 Aug 2026). Tech Plan freezes UUIDs.

| Family | Count | Include |
|---|---|---|
| Pompes | 8 | Pompes; Pompes pike; Pompes claquées; Pompes un bras; Pompes déclinées; Pompes en poirier; Pompes en déficit; Pompes prise serrée (Diamant) |
| Tractions | 6 | Tractions; Tractions supination; Tractions prise neutre; Tractions archer; Tractions commando; Traction front lever |
| Squat | 6 | Squat au poids du corps; Squat pistol; Squat pistol box; Squat dragon; Squat cosaque; Squats sumo |

**Explicitly out of the families:** Pompes sur les genoux; Pompes inclinées; Pompes négatives; Poirier (hold); Tractions assistées machine; Rowing inversé (australiennes); Traction négative; Squats sautés (`measurement_type` duration); Squat barre and every loaded squat.

### Catalog UUIDs (live 20 Aug 2026)

Hardcoded lists for the Tech Plan / both RPCs. Numeric `reps_logged` only. Poirier (hold) resolved via GymLogic `resolve_exercises` the same day — duration, not HSPU.

**Pompes — 8 in / 4 out**

| FR | EN | id |
|---|---|---|
| Pompes | Push-Up | `e63fe427-e910-4e0d-9f73-c51d85b36a3f` |
| Pompes pike | Pike Push-Up | `5c7e172f-6c33-46cc-9886-4c31287623a8` |
| Pompes claquées | Clap Push-Up | `de827afb-d91b-400a-bd5f-415beca277df` |
| Pompes un bras | One-Arm Push-Up | `4a1a7219-bd91-4d59-9d73-2c30c5d9f0ce` |
| Pompes déclinées | Decline Push-Up | `92d8460a-b5c6-449a-9659-004a7ee9565c` |
| Pompes en poirier | Handstand Push Up | `01babef5-3139-4f37-b23f-88ef8d40279d` |
| Pompes en déficit | Deficit Push-Up | `426a5c8a-60bd-456c-b5c9-9bf92913f089` |
| Pompes prise serrée (Diamant) | Diamond Push-Ups | `6b46d77b-1291-44b9-9d40-f4da8930ae17` |

| FR (écarté) | EN | id | Motif |
|---|---|---|---|
| Pompes inclinées | Incline Push-Up | `af2cc5d5-b63d-44dc-aedc-366b6733873a` | régression + equipment bench |
| Pompes sur les genoux | Knee Push-Up | `9dd1bc26-5d88-4744-9543-18477885d0f4` | régression |
| Pompes négatives | Negative Push-ups | `13a23234-1be6-4849-9a95-353ec25dc8fc` | régression |
| Poirier (hold) | Handstand | `1eb9e156-c832-4372-945b-b1902d3822d6` | duration hold — distinct from HSPU |

**Tractions — 6 in / 3 out**

| FR | EN | id |
|---|---|---|
| Tractions | Pull-Up | `261dca1e-9bae-4098-8676-6169597f9964` |
| Tractions supination | Chin-ups | `00731099-9e50-4c90-a92e-0b4433881125` |
| Tractions archer | Archer Pull-Up | `5c0d0e9c-2118-4be4-a90b-31239029b7a3` |
| Traction front lever | Front Lever Pull-Up | `3ce11aeb-966e-4168-b744-902b7d357cfe` |
| Tractions commando | Commando Pull-Up | `366e1372-4fa0-40c4-816c-6fa83aa2c53d` |
| Tractions prise neutre | Neutral Grip Pull-Ups | `a3de462c-9cb9-4a59-ae31-11fbb842895b` |

| FR (écarté) | EN | id | Motif |
|---|---|---|---|
| Rowing inversé (tractions australiennes) | Inverted Row | `01807007-7465-4a5f-8155-e0eff0dc10da` | plus facile |
| Traction négative | Negative Pull-Up | `6f2c8b23-2ac7-4e10-be50-82fc633c68a3` | régression |
| Tractions assistées machine | Machine Assisted Pull-ups | `96a9ad05-192e-4e20-878f-90a153efa4d8` | machine + plus facile |

**Squat — 6 in / 2 out**

| FR | EN | id |
|---|---|---|
| Squat au poids du corps | Bodyweight Squat | `41de0558-c044-4f90-b112-2b09c16e985c` |
| Squat pistol | Pistol Squat | `f1c88f28-8742-4862-985d-0752deca3675` |
| Squat pistol box | Box Pistol Squat | `24e5654d-8414-4df6-b928-d2a4f6974d22` |
| Squat dragon | Dragon Squat | `473523ed-8ef9-493e-8e33-660de7979a7a` |
| Squat cosaque | Cossack Squat | `113d352b-5f40-46ad-9d43-a1f5c9f33934` |
| Squats sumo | Sumo Squat | `4abd9a5f-78ed-4772-bf3d-153cccc7cb65` |

| FR (écarté) | EN | id | Motif |
|---|---|---|---|
| Squats sautés | Squat Jump | `ffa0994b-a4a2-492f-b718-23d8bb795549` | duration, pas reps |
| Squat barre | Barbell squat | `873f87b6-2eea-47e7-882e-7665b2f20a26` | barre — classe : tout squat chargé |

**Group titles / order:**

| `sort_order` | Slug | FR | EN | Description FR |
|---|---|---|---|---|
| 17 | `push_ups` | Pompes | Push-ups | Reps cumulées de la famille Pompes |
| 18 | `pull_ups` | Tractions | Pull-ups | Reps cumulées de la famille Tractions |
| 19 | `bw_squats` | Squat poids du corps | Bodyweight Squat | Reps cumulées de la famille Squat PDC |
| 20 | `bw_expert` | Expert du poids du corps | Bodyweight Expert | Min. des trois familles |
| 21 | `hundred_a_day` | 100 jours ferme | Hard Time | Jours d’affilée en cours avec ≥100 pompes (famille) |

**Locked tier titles** (Bronze / Argent / Or / Platine / Diamant):

| Slug | Thresholds | Bronze | Argent | Or | Platine | Diamant |
|---|---|---|---|---|---|---|
| `push_ups` | 100 / 500 / 2 500 / 10 000 / 25 000 | Nez au sol · Nose to Floor | Piston · Piston | Mur de pompes · Push-up Wall | Le Vérin · The Jack | La Pompe éternelle · The Eternal Pump |
| `pull_ups` | same | Menton à la barre · Chin Over | Dos en V · V-Taper | Grand dorsal · The Lats | Tractionnaire · Bar Addict | Le Roi de la barre · King of the Bar |
| `bw_squats` | same | Cul vers l’herbe · Ass to Grass | Genoux souples · Soft Knees | Le Puits · The Well | Sans barre · No Bar | Le Puits éternel · The Eternal Well |
| `bw_expert` | same | Le Trio · The Trio | Équilibriste · Tightrope | Sans machine · No Machine | Calisthéniste · Calisthenist | Expert du poids du corps · Bodyweight Expert |
| `hundred_a_day` | 1 / 10 / 30 / 60 / 100 | Garde à vue · In Custody | Préventive · On Remand | Un mois ferme · A Month Inside | Mitard · The Hole | 100 jours ferme · Hard Time |

**Threshold hints:**

| Slug | FR |
|---|---|
| `push_ups` | Cumuler {{target}} pompes |
| `pull_ups` | Cumuler {{target}} tractions |
| `bw_squats` | Cumuler {{target}} squats au poids du corps |
| `bw_expert` | Atteindre {{target}} sur les trois |
| `hundred_a_day` | {{target}} jours d’affilée à 100+ pompes |

**HITL recette (locked surface):**

| What | Where |
|---|---|
| Ceremony + icons (Bronze→Diamant, mixed batch) | **`/_unlock-overlay`** — `file:src/pages/UnlockOverlayPlaygroundPage.tsx` (router `file:src/router/index.tsx`). Extend existing `FIXTURES`; no new path. |
| Accordion rows, copy, live `current_value`, locked empty state | Existing **`/achievements`** — `file:src/pages/AchievementsPage.tsx` after migrate + one finish or retroactive grant |
| Not | A new `/_achievements` (or any second underscore route) |

**Out of scope:**

- A `movement_family` catalog column (hardcoded UUID lists in the RPC).
- 100 tractions/jour or 100 squats/jour sequels.
- Knee / incline / assisted / inverted-row / barbell-squat counting.
- Revoking badges when a streak breaks.
- Home widget, notifications, Challenge object.
- Bottleneck UI for the master (“Tractions 4 000”).
- Leaderboards / share.
- New achievement tables if CTE branches + seed suffice.
- Changing Volume King / Leg Day filters.

---

## Success Criteria

- **Numeric:** 5 groups × 5 tiers seeded; both RPCs return coherent `current_value` and unlocks for fixtures covering family include/exclude, Cindy 20 on-ramp, master `MIN`, timezone day-bucket, current-chain reset, duration squat ignored.
- **Qualitative:** An athlete with mixed family + Cindy history sees correct locked/unlocked state on `/achievements` after one finish; `/_unlock-overlay` can fire the new slugs’ ceremony with icons (or placeholder if art not yet uploaded).
- **Contract:** Master rank N ⇔ all three families ≥ that threshold; **100 jours ferme** diamond ⇔ 100 consecutive local days at ≥100 Pompes-family reps; knee / barre / jump-squat-duration never increment these metrics.
- **HITL:** Recette signed on `/_unlock-overlay` + `/achievements` only. Zero new HITL routes.

---

## References

- Issues: [#509](https://github.com/PierreTsia/workout-app/issues/509) (primary), [#510](https://github.com/PierreTsia/workout-app/issues/510) (streak group)
- Grill canvas: `509-510-bodyweight-tracks-grill.canvas.tsx`
- Family UUID review: `509-510-trinity-families.canvas.tsx`
- Icon prompts: `file:docs/badge-icon-prompts-bodyweight-tracks-509.md`
- Glossary: `file:docs/CONTEXT.md` (**Bodyweight Trinity**, **Grant Batch**, **Cast Clearing**)
- Sibling playbook: #218, #482; overlay playground: #491 / T217
- RPCs: last shape `file:supabase/migrations/20260817120000_circuit_achievement_tracks.sql` (+ later grant patches)
- Grant path: `file:src/lib/syncService.ts`, `file:src/components/achievements/AchievementUnlockOverlay.tsx`
- HITL playground: `file:src/pages/UnlockOverlayPlaygroundPage.tsx` → `/_unlock-overlay`
- Accordion: `file:src/pages/AchievementsPage.tsx` → `/achievements`
