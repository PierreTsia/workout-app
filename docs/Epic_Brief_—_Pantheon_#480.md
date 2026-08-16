# Epic Brief — Pantheon (#480)

## Summary

Cindy n’est plus seule. Le catalog GymLogic gagne **8 Benchmark Circuits** Cindy-shaped (4 Olympiens AMRAP 20, 4 Héros AMRAP 10), matrice de spécialités, `label` avec emoji (`Zeus ⚡`). Le picker Circuits de **Meet Cindy** (#393) les liste sans code de découverte : une migration + le plomb `label` sur la card. QW coerce reste Cindy-only. Zeus n’est **pas** un seed Tours.

---

## Context & Problem

**Who is affected:** Pratiquants qui ouvrent **Add Exercise → Circuits** après #393 ; agents MCP qui envoient un `benchmark_slug` ; quiconque cherche `force` / `jambes` / `arès` dans le picker.

**Current state:**
- #398 a shippé **une** row (`slug: cindy`). `useBenchmarkSeeds` lit déjà toutes les rows `owner_id IS NULL`.
- #393 (à merger avant cet epic) droppe un seed sur le jour via `instantiateBenchmark`. La card affiche `catalogDisplayName(slug)` = Title Case ASCII, icône Lucide `Layers` — pas d’emoji.
- `instantiateBenchmark` (`file:src/lib/instantiateBenchmark.ts`) force `rounds: 1` et un Rx plat. Les pyramides Tours perso (Zeus/Arès) **ne rentrent pas** sans code. L’historique catalog lit `block_runs` (AMRAP only).
- QW `replaceCatalogCircuits` hardcode `CINDY_SEED_KEYS`. « une zeus » mint un snowflake. **Hors scope.**
- Le glossaire dit encore « Zeus = jumeau Tours de Cindy » — faux dès cette vague.

**Pain points:**
| Pain | Impact |
|---|---|
| Un seul seed | Circuits est une vitrine Cindy, pas un catalog |
| Slug = nom | `ares` s’affiche « Ares », zéro 🗡️ |
| Zeus Tours dans les docs | On seedrait un mode que `block_runs` ne stamp pas |
| Recettes perso ≠ contrat | Pyramides et haltère 12 kg cassent comparabilité / PR |

**Canonical roster** (source de vérité du seed ; une Rx différente = une autre row) :

| Label | Slug | Cap | Tagline FR / EN | Rx |
|---|---|---|---|---|
| Zeus ⚡ | `zeus` | 20 | Full body | 5 burpees · 10 squats sautés · 15 pompes |
| Heracles 🦁 | `heracles` | 10 | Full body | 20 jumping jacks · 10 squats · 10 pompes genoux |
| Ares 🗡️ | `ares` | 20 | Force haut du corps / Upper-body strength | 5 tractions · 10 dips · 15 pompes diamant |
| Theseus 🐂 | `theseus` | 10 | Force haut du corps / Upper-body strength | 5 rowing inversé · 10 dips banc · 15 pompes |
| Athena 🦉 | `athena` | 20 | Core | 20 bear walk · 15 crunches bicyclette · 15 shoulder taps |
| Atlas 🌍 | `atlas` | 10 | Core | 10 bird dog · 15 crunches · 10 dead bug |
| Hades 🌑 | `hades` | 20 | Jambes / Legs | 5 squat pistol box · 10 fentes · 15 pont unipodal |
| Achilles 🛡️ | `achilles` | 10 | Jambes / Legs | 20 montées de genoux · 10 step-up · 15 pont fessier |

Aliases (search, pas display) : `arès`, `athéna`, `hadès`, `hercule` / `héraclès`, `thésée`, `achille`. Stories FR/EN : copy grillée (voix Cindy, chiffres puis pique). `reference` vide. Cindy inchangée (`label` `'Cindy'`, pas d’emoji).

**Stories (canonical copy):**

- **Zeus ⚡** — FR: *Cinq burpees, dix squats sautés, quinze pompes. Le roi ne pèse rien : il compte les tours. Vingt minutes sous l’orage.* EN: *Five burpees, ten jump squats, fifteen push-ups. The king doesn’t weigh anything. He counts rounds. Twenty minutes under the storm.*
- **Heracles 🦁** — FR: *Vingt jumping jacks, dix squats, dix pompes genoux. Les travaux, version mortel. Dix minutes, tu sors, tu recommences.* EN: *Twenty jumping jacks, ten squats, ten knee push-ups. The labors, mortal edition. Ten minutes, you walk out, you go again.*
- **Ares 🗡️** — FR: *Cinq tractions, dix dips, quinze diamants. Pas de traité. Les bras d’abord, la tête après.* EN: *Five pull-ups, ten dips, fifteen diamonds. No treaty. Arms first, head later.*
- **Theseus 🐂** — FR: *Cinq rowings inversés, dix dips banc, quinze pompes. Le fil est là. Dix minutes pour le taureau, sans te perdre.* EN: *Five inverted rows, ten bench dips, fifteen push-ups. The thread is in your hand. Ten minutes for the bull, don’t get lost.*
- **Athena 🦉** — FR: *Vingt pas de bear walk, quinze bicyclettes, quinze shoulder taps. La sagesse, c’est le milieu qui ne lâche pas.* EN: *Twenty bear-crawl steps, fifteen bicycles, fifteen shoulder taps. Wisdom is the middle that doesn’t leak.*
- **Atlas 🌍** — FR: *Dix bird dogs, quinze crunches, dix dead bugs. Tu ne portes pas le ciel. Tu apprends à ne pas le poser.* EN: *Ten bird dogs, fifteen crunches, ten dead bugs. You’re not holding the sky. You’re learning not to set it down.*
- **Hades 🌑** — FR: *Cinq pistols box, dix fentes, quinze ponts unipodaux. On ne sprint pas Hadès. On descend.* EN: *Five box pistols, ten lunges, fifteen single-leg glute bridges. You don’t sprint Hades. You go down.*
- **Achilles 🛡️** — FR: *Vingt montées de genoux, dix step-ups, quinze ponts. Pied léger, pas le grind d’en bas. Dix minutes — cours.* EN: *Twenty high knees, ten step-ups, fifteen glute bridges. Light foot, none of the grind below. Ten minutes — run.*

---

## User Stories

**Catalog**
1. As a user, I want the 8 seeds to exist as GymLogic **Benchmark Circuits** (`owner_id` NULL, slug ASCII unique, Rx JSONB frozen), so that two Tuesdays of Zeus share one identity.
2. As a user, I want each seed’s Rx to be **bodyweight** (`weight: 0`), 3 stations, **AMRAP**, reps only, so that PRs compare and instantiate stays Cindy-shaped.
3. As GymLogic, I want the migration to `SELECT … INTO STRICT` catalog names (same as Cindy), so that a missing exercise fails the migrate instead of writing a half-Zeus.
4. As a user, I want Cindy’s slug, Rx, tagline, story, and Holland `reference` **byte-identical**, so that this epic does not rewrite the tracer.

**Label**
5. As a user, I want each seed to carry a `label` (`Zeus ⚡`), so that the picker and history heading show the emoji in the **name**, not a separate glyph column.
6. As a user, I want `instantiateBenchmark` to copy that `label` onto the day block (not Title Case of the slug), so that the `BlockCard` says Zeus ⚡.
7. As a user on Cindy, I want the label `'Cindy'` (no emoji), so that Holland stays the identity.

**Découverte (depends #393)**
8. As a user on **Circuits** with an empty query, I want all 8 GymLogic seeds as WOD cards (label, `AMRAP N min`, tagline), so that Cindy is no longer the only hit.
9. As a user typing a specialty (`force`, `jambes`, `core`, `full`), I want **both** the Olympian and the Hero of that matrix column, so that the tagline contract is searchable.
10. As a user typing an accented alias (`arès`, `thésée`, `hercule`), I want the matching card, so that FR search does not require ASCII.
11. As a user, I never want **Circuit Forks** or my Zeus perso draft in that tab, so that Circuits stays curated.

**Drop & run**
12. As a user, I want tapping a pantheon card to `instantiateBenchmark` on **this** day (catalog Rx wins, FK stamped), so that GO / Round Screen / leftover work like Cindy.
13. As a user, I want a missing `exercise_id` at instantiate to fail clearly (toast, no half-row), so that a renamed catalog exercise cannot ship a broken Hades.
14. As a user who **Circuit Forks** a Zeus slot after a scored Monday, I want Monday to stay Zeus, so that retargeting does not rewrite `block_runs`.

**Story**
15. As a user opening the history sheet of a pantheon seed, I want the grilled tagline + 2–3 sentence story in my **Display Locale**, so that the WOD has a voice without a fake leaderboard.
16. As a user, I want no `reference` row on these seeds, so that we do not invent a Greek Holland.

**MCP / skill**
17. As an agent, I want `benchmark_slug: "zeus"` (and the other 7) to resolve catalog Rx, so that I do not persist a reconstructed burpee triangle.
18. As an agent, I want the GymLogic skill + mcp-connect docs to list these slugs and say unknown slug → error, so that “Zeus” is not documented as 5-10-15.
19. As a user of **Quick Workout AI**, I accept that « une zeus » still does **not** coerce (Cindy-only keys), so that this epic stays off the QW prompt.

**Non-régression**
20. As a user of existing Tours Circuits (perso Zeus pyramid), I want them untouched, so that catalog seeds do not backfill drafts.
21. As a user offline tapping a card, I want the same #393 failure (toast, sheet open, no half-row), so that we do not invent a queue.

### Success measures

| Story # | Measure |
|---|---|
| 4 | Cindy row unchanged except nullable `label = 'Cindy'` |
| 8 | Circuits empty-query shows 9 cards (Cindy + 8) after migrate |
| 9 | Query `force` pins Ares **and** Theseus |
| 19 | `CINDY_SEED_KEYS` / `replaceCatalogCircuits` unmodified |

---

## Scope

**In scope:**
- `benchmark_circuits.label` + PWA display (picker card, instantiate label, history heading via `catalogDisplayName`)
- One migration: Cindy label backfill + 8 INSERTs (aliases, taglines, stories, Rx)
- Glossary patch: Zeus is no longer the Tours twin; **Olympien** / **Héros** / **Specialty** as editorial terms
- ADR: this wave is AMRAP Cindy-shaped; Tours-benchmark deferred
- Skill + mcp-connect: 8 slugs, catalog wins
- Tests: parse/display label, seed search on aliases + tagline specialties, instantiate copies label, Cindy fixtures still green
- One implementation ticket: colonne `label` + 8 INSERT + card (pas un split label-then-seeds)

**Out of scope:**
- QW `CINDY_SEED_KEYS` generalization
- Tours / pyramids / `per_round` in catalog Rx; GO stamp Tours
- `label_fr` / `label_en` (Ares stays unaccented on screen)
- 5th Olympian or Hero; Atalante, Poséidon, Aphrodite
- Circuit Catalog UI, achievements, leaderboards, home CTA
- Loaded Rx (haltère 12 kg)
- Duration stations (planche / hollow)
- Admin / YAML CMS for seeds

---

## Success Criteria

- **Numeric:** 8 new `owner_id` NULL rows + Cindy = 9 seeds selectable; 0 QW files touched.
- **Qualitative:** un user (ou un agent avec le slug) droppe Zeus ⚡ sur un jour, court l’AMRAP 20, lit la story ; Theseus apparaît à `force` à côté d’Ares ; le Zeus Tours perso dans les drafts n’a pas bougé.
