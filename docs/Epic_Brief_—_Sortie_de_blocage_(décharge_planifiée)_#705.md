# Epic Brief — Sortie de blocage : décharge planifiée (P2)

## Summary

Quand un Exercise Slot cesse d'avancer — la prescription n'augmente plus pendant quatre séances
consécutives alors que l'athlète est à RIR ≤ 1 — le moteur prescrit aujourd'hui un simple hold, et rien
ne casse jamais la boucle. Cet epic donne au moteur une **sortie de blocage** : au-delà du seuil, il
prescrit une **Décharge** (charge −1 cran, reps ×0,85 en reps-only), visible, puis reprend la progression
normale dès la séance suivante. Aucun état persisté : le déclencheur et la sortie sont dérivés de
l'historique. Le doc source visait `PLATEAU` ; les données montrent que le vrai blocage est la stagnation
de prescription (ADR `file:docs/adr/0033-plateau-exit-triggered-by-prescription-stall.md`).

---

## Context & Problem

**Who is affected:** tout athlète qui entraîne un même Exercise Slot à travers assez de séances pour que
la prescription se fige — le cas typique d'une progression linéaire arrivée à saturation. N'affecte pas
les exercices en durée (hors v1), ni les séances sans RIR déclaré.

**Current state:**
- `computeNextSessionTarget` (`file:src/lib/progression.ts`) sert un **hold** (`HOLD_INCOMPLETE` /
  `HOLD_NEAR_FAILURE`) quand la cible n'est pas dépassée, et un `PLATEAU` quand toutes les séries sont au
  plafond avec `maxWeightReached`. Aucun de ces états ne propose de **redescendre pour remonter**.
- `PLATEAU` est **terminal** par construction, mais **quasi jamais atteint** en pratique : il exige un flag
  manuel (`maxWeightReached`) **et** toutes les séries au plafond **et** le nombre de séries au max. Sur
  toute la prod, un seul slot y est jamais passé (13 séances, août 2026).
- Le vrai signal de blocage — `prescribed_reps` **et** `prescribed_weight` figés sur des séances
  consécutives — touche **22 slots** (18 sur ≥4 séances, dernier le 19/10). C'est « le moteur n'a plus rien
  à donner ».
- Le moteur est **stateless par séance** : il recalcule depuis l'historique. Une séance déchargée n'est
  jamais un PR, donc sans reconnaissance explicite, un déclencheur « sans progrès » se re-déclenche à
  l'infini.
- Le préalable de mesure (P1 / #706, T706) est **mergé mais pas déployé** : l'event
  `progression_rule_served` n'a aucune ligne en prod, l'observatoire est muet.

**Pain points:**

| Pain | Impact |
|---|---|
| Un hold qui dure ne casse jamais la boucle | L'athlète se bat contre la même prescription pendant des semaines ; rien n'offre de redescendre |
| `PLATEAU` comme cible désignée du chantier | Construire dessus c'est corriger un bug inexistant (1 slot) ; mauvais investissement |
| « N séances sans PR » comme déclencheur naïf | Une progression linéaire ne rebat jamais son record absolu → sur-déclenche (90 slots) |
| Une décharge re-prescrite en boucle | Sans sortie dérivable, l'athlète reste déchargé indéfiniment |

---

## User Stories

1. As an athlete whose target hasn't moved for four sessions while I'm grinding to near-failure, I want the
   engine to prescribe a lighter deload session, so that I can recover and climb again.
2. As an athlete, I want to see *why* my target dropped (a "Décharge" label), so that a reduction doesn't
   look like a bug.
3. As an athlete who is holding a target comfortably (RIR high), I want **no** deload, so that the engine
   doesn't punish me for training at a sustainable load.
4. As an athlete who doesn't log RIR, I want no deload triggered on a missing signal, so that silence is
   never read as a zero.
5. As an athlete who edited my template (Manual Override Window open), I want my deliberate edit to beat
   any deload, so that my intent stays sovereign.
6. As an athlete on reps-only equipment (bodyweight, cable, band), I want the deload to lower **reps**
   (×0.85) rather than a weight I don't have, so that the rule means the same thing on my exercises.
7. As an athlete on a duration exercise (plank, hollow hold), I want my prescription untouched in v1, so
   that the change is scoped and predictable.
8. As an athlete who followed the deload, I want the next session to resume normal progression from the
   deloaded step, so that I climb back without the engine re-prescribing a deload forever.
9. As an athlete who ignored the deload and went heavier anyway, I want the engine to stop insisting once
   the streak is broken, so that I'm not nagged.
10. As an athlete with too little history on a slot (< N sessions), I want the engine to bootstrap normally,
    so that nothing regresses on a new or rarely-trained slot.
11. As a maintainer, I want the Blocage detection to read the same target the next prescription uses
    (`anchor_reps ?? prescribed_reps`), so that the P1 anchor and P2 agree.
12. As a maintainer, I want the trigger and the exit derived from history with no persisted state, so that
    no client state drifts (and P6's "replay history" is not reintroduced).
13. As a maintainer, I want `prescribed_*` to stay pristine, so that the deviations observatory keeps its
    baseline.
14. As a maintainer, I want the deload to be a first-class `DELOAD` Progression Rule (auto-applied,
    tested), so that it composes with the existing rule order and the telemetry enum.

### Success measures

| Story # | Measure |
|---|---|
| 13 | The deviations observatory's query 3 classifies deloaded sets as before (no `flat` inflation) |
| 12 | No new column, no persisted rule: the diff adds zero migration state |

Les autres stories se valident qualitativement (comportement du moteur, couvert par les tests de T707/T708).

---

## Scope

**In scope:**

1. A `DELOAD` Progression Rule in `file:src/lib/progression.ts`, auto-applied like `WEIGHT_UP`.
2. The **Blocage** trigger: `STALL_SESSIONS = 4` consecutive sessions where `prescribed_reps` **and**
   `prescribed_weight` do not advance, **and** the last session's average RIR ≤ 1. No time bound on the
   streak (`N` sessions, whatever their calendar spacing).
3. Deload effect: load −1 increment (slot's `weightIncrement`); reps-only equipment reps ×0.85
   (`PROPORTIONAL_DELOAD_FACTOR`). Sets, range, duration axis untouched — **the source doc proposed
   "volume reduced" over a week; we ship one session with sets untouched (ADR 0033 supersedes that
   grain)**.
4. Derived exit: one deloaded session; the next session resumes normal progression once the served
   prescription reads lower than the previous one.
5. Manual Override Window still wins.
6. A visible "Décharge" label + reason (i18n copy pass).
7. The **N-session history read** per slot (the real cost — see Tech Plan).
8. An ADR (ADR 0033, already written) + glossary terms (**Blocage**, **Décharge**).

**Out of scope:**

- **Sortie de `PLATEAU` proprement dite** — le doc source visait `PLATEAU` ; le déclencheur retenu le
  **subsume** sans en faire un cas à part (ADR 0033).
- The **duration/isometric** deload axis (follow-up if the hole shows there).
- Any **persisted deload state** (column, per-slot flag, `prescribed_rule` column).
- **P3** (bounded e1RM) and **P4** (available plate levels).
- P5 (rep-range ladder), P6 (derived state / history replay), per-muscle volume periodization (#149).
- Surfacing deload history in a dedicated readout (only the in-session label ships).

---

## Success Criteria

- **Numeric:** a `DELOAD` fires after exactly 4 stagnant sessions at RIR ≤ 1 and never on an undeclared
  RIR; the session after a served deload resumes the normal rule; 0 regression in the deviations
  observatory's direction classification; no new persisted state (0 migration).
- **Qualitative:** a deliberately stalled, near-failure slot demonstrably gets a lighter prescription once,
  then climbs again; a comfortably-held target never gets one; `prescribed_*` still means "what the engine
  prescribed at session start".
- **Process:** ADR 0033 records the reframed trigger; the epic's prerequisite (deployed observatory) is used
  to tune `N` and the RIR gate **after P1 ships** — the thresholds ship as a documented starting point, not
  a validated value. **Follow-up (HITL):** the body of #705 still carries the old wording ("une semaine de
  décharge … volume réduit") and its AC "`PLATEAU` a une sortie" — reconcile it with ADR 0033.