# Epic Brief — Circuit Catalog: Cindy identity (#398)

## Summary

Cindy devient un **Benchmark Circuit** : une ligne catalogue (`slug: cindy`), Rx figée, identité stable, **storytelling shippé** (tagline + story FR/EN + hook Holland — pas un placeholder). Dropper Cindy sur un jour photocopie la recette dans un **Exercise Block** et stamp `benchmark_circuit_id`. Deux mardis = le même WOD ; le PR perso (`27+3`) s’accumule sous Cindy, pas sous un `block_id` jetable. MCP / Quick Workout **résolvent** le seed (Holland → cindy) au lieu d’inventer 5-10-15. Éditer la Rx d’un seed = **Circuit Fork** (nouvelle ligne privée). **Do Cindy** depuis la home est #393. L’étagère publique / ranked / share / badges est le north star, pas v1 — mais la forme d’identité doit survivre sans rewrite.

---

## Context & Problem

**Who is affected:** Pratiquants qui courent (ou veulent courir) Cindy / des WOD nommés ; users dont le QW AI « Cindy » ne construit aucun historique ; agents MCP ; plus tard, quiconque publie ou compare — ils héritent de cet id.

**Current state:**
- AMRAP a shippé (#475, ADR 0014). Cindy est *exprimable* : `AMRAP 20 min`, 5/10/15, 3-2-1-GO, leftover, score `27+3`.
- Un **Exercise Block** est une instance jour : `workout_day_id NOT NULL`, RLS via le jour (`file:supabase/migrations/20260613130000_create_exercise_blocks.sql`).
- Historique AMRAP / Tours ancré sur `block_id` + empreinte (`file:src/lib/blockTemplate.ts` `templateFingerprint`, `file:src/lib/amrapScore.ts`). Deux Cindys sur deux jours sont étrangères.
- QW / MCP connaissent les mots Cindy / Holland et **mintent un Circuit jetable** avec un label (`file:supabase/functions/generate-quick-workout/`).
- T144 « Create circuit » blank est le mauvais verbe — superseded par **Do Cindy** (#393).
- Achievements (#129 / #218) : un `metric_type` = une branche RPC. Pas de hook catalogue.

**Pain points:**
| Pain | Impact |
|---|---|
| Cindy = snowflake `block_id` | Le PR ne s’accumule pas ; « tes 24 vs Holland 27 » n’existe pas |
| QW/MCP reconstruisent 5-10-15 | Chaque intent = nouvelle identité ; le label ment |
| Pas d’entité catalogue | Public / ranked / badges plus tard n’ont rien à accrocher |
| Edit Rx sans contrat | Cap 20 et cap 10 se mélangent ; poison leaderboard |
| `/library` ≠ étagère WOD | Tordre l’IA maintenant fusionne deux jobs |

---

## User Stories

**Catalogue & seed**
1. As a user, I want Cindy to exist as a named **Benchmark Circuit** (`slug: cindy`) with a frozen Rx (`AMRAP 20 min`, 5 pull-ups / 10 push-ups / 15 squats), so that two sessions are the same WOD.
2. As a user, I want that Rx **not hardcoded in the client**, so that the catalog id is the source even when there is only one seed.
3. As a user, I want Cindy to ship with the **real** localized tagline + short story + Holland `reference` (canonical copy in **Cindy seed copy** below — not lorem, not a follow-up ticket), so that the WOD is attractive without faking a leaderboard.
4. As a user browsing history, I want Holland’s 27 as **editorial copy**, never a row in my sparkline / PB list, so that I don’t think we shipped rankings.
5. As GymLogic, I want seed Rx **immutable** (metadata/story patchable); a different Rx is a different catalog row, so that the name *is* the contract.

**Instantiation**
6. As a user (via MCP, QW, or a later **Do Cindy**), I want dropping Cindy onto a **workout day** to mint a day-scoped **Exercise Block**: snapshot copy of the Rx + `benchmark_circuit_id`, so that the **Round Screen** and **Unified Day Sequence** keep working.
7. As a user building a generic Circuit (no WOD name), I want it to stay a jetable **Exercise Block** with null catalog id, so that the Builder is not forced through the catalog.
8. As #393, I want an instantiate-by-catalog-id primitive, so that **Do Cindy** does not invent a second write path.

**Score & historique**
9. As a returning user, I want my Cindy PR and deltas keyed by **catalog id + `templateFingerprint`**, so that Tuesday and next month compare, and cap 10 does not steal the 20 min PB.
10. As a first-time Cindy runner, I want history to show the story + « pas encore de PR » (no fake delta), so that the empty state is honest.
11. As a user who **Circuit Forks** a program slot after a scored Monday, I want Monday’s run to stay Cindy, so that retargeting the day’s block cannot rewrite the past.
12. As a user reviewing Cindy, I want the existing **Block history sheet** energy (list / sparkline / PB) but grouped by catalog id, score mode-aware (`27+3` glossed), so that I don’t learn a second history UI.
13. As a user offline in session, I want the GO **Block Run** to queue `benchmark_circuit_id` with the fingerprint (same offline path as today), so that a dead basement doesn’t drop identity.

**Contrat, fork, mutabilité**
14. As a user who edits a **seed** Rx in the Builder (cap, movement, prescribed amounts), I want a confirm *« Ça ne sera plus Cindy. »* then a **Circuit Fork**: new private **Benchmark Circuit** (`owner_id` = me, `forked_from` = cindy), day block retargeted, so that I cannot silently break the contract.
15. As a user who logs leftover or fewer reps than prescribed, I want that to stay Cindy (performance, not a fork), so that `27+3` remains a Cindy score.
16. As a user editing **my** private fork, I want in-place mutation (same id, PRs stay), so that I don’t explode rows every Wednesday.
17. As a user, I want GymLogic Cindy never edited in place, so that everyone shares the same contract.

**MCP & IA**
18. As an agent or QW user saying « Cindy » / « Holland », I want resolve-by-`slug`/`aliases`, catalog Rx copied, id stamped — LLM 5-10-15 discarded — so that named intent cannot mint a snowflake.
19. As an agent author, I want the MCP Circuit Item to accept `benchmark_slug` (or catalog id). When present, catalog wins. Unknown slug → **error**, not a labeled jetable, so that « Cindy » never lies.
20. As an agent asking for a generic AMRAP (no seed name), I want today’s jetable Circuit path unchanged, so that we don’t break non-WOD generation.
21. As an agent, I want dry_run / details / history to echo the catalog name + glossed score, so that I can propose and read back *Cindy*, not a random block label.
22. As a QW user whose closed-intent list currently emits Cindy-shaped snowflakes, I want that path **switched to resolve**, so that in-app AI and MCP don’t diverge.

**Accès / erreurs / edges**
23. As any authenticated user, I want to **read** GymLogic seeds; I must not read or write someone else’s private fork, so that `owner_id` is a real door for publish later.
24. As a user whose seed exercises are missing from catalog, I want instantiate to fail clearly, so that we don’t persist a half-Cindy.
25. As a user, I do **not** want a Circuit Catalog tab, a home **Do Cindy** button, or `/library` turned into a WOD shelf in this epic — those are north star / #393.

### Success measures

| Story # | Measure |
|---|---|
| 1, 6, 9 | Two ad-hoc days instantiated from `cindy` share one catalog id; second complete AMRAP updates the **same** PB |
| 2 | `rg "5.*10.*15" src/` has **no** Cindy Rx constant used to persist a block |
| 11 | Fork the slot after run A → run A’s `block_runs.benchmark_circuit_id` still = cindy ; run B = fork id |
| 14 | Builder save that changes seed fingerprint never writes the seed row; a new `owner_id = user` row exists |
| 18–19, 22 | HITL / fixture « Cindy » / « Holland » → persisted `benchmark_circuit_id` = seed, Rx bytes = seed JSONB, not the model’s numbers |
| 19 | `benchmark_slug: "not-a-wod"` → error, no insert |
| 3 | Seed row has the canonical FR/EN tagline + story + `reference` below; **0** lorem / TODO / empty story fields |
| 4 | History fixtures: Holland reference rendered as copy; **0** fake run rows |
| 7, 20 | Generic AMRAP without a seed name still inserts `benchmark_circuit_id IS NULL` |

---

## Scope

**In scope:**
- Table `benchmark_circuits`: uuid PK, immutable `slug` (seeds only; forks NULL), `owner_id` nullable, `forked_from`, `aliases`, localized tagline/story, optional `reference`, Rx **JSONB** (mode, cap, `[{ exercise_id, amount, weight }]`).
- Seed Cindy (GymLogic, `owner_id` NULL) **including the canonical copy below**. No Zeus seed in v1. No placeholder storytelling.
- `exercise_blocks.benchmark_circuit_id` nullable FK.
- `block_runs.benchmark_circuit_id` snapshotted at GO.
- Instantiate-by-id (copy JSONB → `block_exercises` + stamp FK).
- History / PR surface keyed by catalog id + fingerprint (reuse sheet; Cindy story + editorial reference).
- **Circuit Fork** + Builder confirm when a non-owned contract would break.
- MCP Circuit Item `benchmark_slug` / id ; QW + Embedded Agent resolve ; catalog wins.
- RLS: seeds readable by all auth users; forks owner-only; seed writes = migration.

**Out of scope:**
- **Do Cindy** home CTA, ad-hoc lifecycle, pre-session Start — #393
- Circuit Catalog UI / browse / search / merge into `/library`
- Publish, `visibility`, share links, live leaderboard
- Blank named create (T144)
- User-authored-from-scratch (« Lunch 12 »)
- Zeus (or any second seed), Tours-benchmark GO stamp
- Achievement tracks / new `metric_type`
- Full-day catalog (« All you need is a cell »)
- Versioning in-place of seed Rx
- Child table `benchmark_circuit_exercises`
- Builder picker « insérer Cindy »
- Placeholder / lorem / « story TBD » on the Cindy seed
- High-res Stitch / new-screen mockups — v1 reuses `BlockHistorySheet` + a Builder confirm dialog

### Cindy seed copy

Canonical marketing for the GymLogic seed. Punchy, not an encyclopedia. Holland is a *beat*, not a ranking. Ships in this epic — Tech Plan / seed migration use these strings.

| Field | FR | EN |
|---|---|---|
| `tagline` | Le WOD de Tom Holland. 20 min. | Tom Holland’s WOD. 20 min. |
| `story` | Cinq tractions, dix pompes, quinze squats. Autant de tours que possible. Le score s’écrit 27+3, pas en kilos. Holland a posé 27 tours — à toi de voir. | Five pull-ups, ten push-ups, fifteen squats. As many rounds as possible. The score is 27+3, not kilos. Holland did 27 rounds — your move. |
| `reference` | `{ "name": "Tom Holland", "score": "27" }` | same |
| `aliases` | `holland`, `tom holland` | same |

---

## Success Criteria

- **Numeric:** 0 Cindy persist path without `benchmark_circuit_id` on the closed-intent list (QW + MCP slug/alias). 0 client-hardcoded Cindy Rx. Fork after a scored run leaves the prior `block_runs.benchmark_circuit_id` unchanged.
- **Qualitative:** A user (or agent) can obtain Cindy by catalog identity, run the shipped AMRAP **Round Screen**, and see history / PR **under Cindy** with the real tagline/story/Holland beat. Éditer la recette officielle fork clairement. Un Circuit générique n’est pas forcé dans le catalogue. Rien dans `/library` ni la home n’a changé de job.
