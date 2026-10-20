# Epic Brief — Fermeture de la boucle de progression intra→inter-séance

## Summary

Quand le moteur intra-séance (`file:src/lib/rirSuggestion.ts`) suggère à l'athlète de décharger une
série, et que l'athlète l'applique, cette décision ne survit pas à la séance : la prescription
suivante repart sur la cible du **début** de séance. Cet epic ferme la boucle — la suggestion
appliquée devient l'ancre de la prochaine prescription — **sans** toucher au Prescription Snapshot,
qui reste la cible pristine et la baseline de mesure de l'observatoire de déviations. Un préalable de
mesure (trois métriques moteur) est livré d'abord, pour qu'on sache si le chantier suivant (P2) résout
un problème réel.

---

## Context & Problem

**Who is affected:** tout athlète qui entraîne un même Exercise Slot à travers plusieurs séances et qui
décharge **en séance** sur la suggestion du moteur — cas le plus fréquent en fin de séance, sous
fatigue. N'affecte pas les exercices en durée (axe hors périmètre) ni les séances sans ajustement
intra-séance.

**Current state:**
- Deux moteurs coexistent et ne se parlent pas : `progression.ts` (inter-séance, décision de fin de
  séance) et `rirSuggestion.ts` (intra-séance, cascade RIR plafonnée à 2 étapes).
  `computeCascadeSuggestions` n'est appelé que depuis
  `file:src/components/workout/SetsTable.tsx:553`.
- Le snapshot persisté (`prescribed_reps` / `prescribed_weight` / `prescribed_sets`) est la cible **au
  début de séance** — le commentaire du code dit « the engine's pristine target for this set at
  session-start ».
- `buildPrescription` (`file:src/lib/progression.ts`) relit `prescribed_reps` pour `volume.current`.
  Une décharge apprise n'y arrive jamais.
- Le snapshot est écrit **par série, au premier log** (`file:src/lib/syncService.ts:1210-1215`) ;
  `processSessionFinish` refuse d'écrire la prescription (`:1257`, retrait du writeback par ADR 0006).
- `prescribed_*` est aussi la **baseline de mesure** de l'observatoire de déviations
  (`file:docs/Observatory_—_Deviations.md`, requête 3, jointure `set_logs`), et sa sémantique est
  publiée dans `file:docs/CONTEXT.md` (**Prescription Snapshot**, règle unique).
- L'axe *poids* a déjà tranché la moitié de ce problème dans l'autre sens : il lit le **réel**
  (`weight_logged`), pas `prescribed_weight` (#381, `progression.ts:173-189`).

**Pain points:**

| Pain | Impact |
|---|---|
| Une décharge appliquée en séance est oubliée à la séance suivante | Trois séances à décharger → la quatrième repart sur la cible de la première ; l'athlète se bat contre la même prescription |
| Le moteur intra-séance existe mais sa valeur est partiellement annulée | Un moteur qui a la bonne réponse et ne peut pas la transmettre : boucle ouverte |
| Écrire la cible servie dans `prescribed_*` casserait la mesure | L'observatoire de déviations (requête direction × raison) et l'`anchor rule` de son refacto futur perdent leur baseline |

---

## User Stories

1. As an athlete, I want a deload I applied mid-session on the engine's suggestion to be remembered
   next session, so that I'm not fighting the same target every week.
2. As an athlete, I want a session where I merely *missed* my reps (I didn't choose to deload) to hold
   the target rather than ratchet it down, so that one bad day doesn't cost me my earned progression.
3. As an athlete, I want my program edit (template) made after my last session to beat any
   in-session suggestion, so that my deliberate intent stays authoritative.
4. As an athlete, I want a session with no in-session adjustment to behave exactly as today, so that
   the fix is invisible when it isn't needed.
5. As an athlete whose last performance predates this change (legacy rows, no anchor), I want the
   engine to fall back to the pristine snapshot, so that nothing regresses on my history.
6. As an athlete, I want my recorded prescription history to stay intact (the weight/reps I was
   *prescribed* vs what I did), so that any future coaching readout built on it remains truthful.
7. As a maintainer, I want the anchor read to be independent of the array order it arrives in, so that
   the two Last Performance readers (which order sets oppositely) agree.
8. As a maintainer, I want an ADR recording why the anchor lives in its own field rather than in
   `prescribed_*`, so that a future contributor does not "simplify" it back into the bug.
9. As a maintainer, I want the pristine `prescribed_*` kept untouched, so that the deviations
   observatory keeps its baseline and its planned anchor rule stays valid.
10. As a maintainer, I want three engine metrics instrumented — served-rule distribution, consecutive
    `HOLD_INCOMPLETE` run length, count of never-resolved `PLATEAU` — so that we can decide whether
    the plateau-exit work (P2) addresses a real problem.

### Success measures

| Story # | Measure |
|---|---|
| 1 | A test proves the next prescription's `volume.current` equals the last applied in-session target |
| 2 | A test proves a rep miss with no in-session move leaves `volume.current` at the pristine snapshot |
| 7 | A test passes the same sets in both orders and gets the same `volume.current` |
| 9 | The observatory's query 3 classifies deloaded sets as before (no `flat` inflation) |
| 10 | The three metrics are queryable with a documented read path |

---

## Scope

**In scope:**

1. A new nullable anchor column on `set_logs` (`anchor_reps`), carrying the rep target in force at log
   time — the pristine target, or the intra-session engine's **applied** suggestion once it moves. The
   **column is set-grain** (not a `(session, slot)` table), read by `setNumber`, never array position:
   the two Last Performance readers order sets oppositely.
2. **Only the intra-session engine moves the anchor.** A manual deviation does not move it in v1 —
   that is the deviations observatory's future refactor (reason × direction). A rep *miss* with no
   engine move leaves the anchor equal to the pristine snapshot.
3. The write path: the applied suggestion rides the existing set-log payload (no finish-time write, no
   new write path).
4. The read path: `buildPrescription` uses `anchor_reps ?? prescribed_reps` for `volume.current`,
   carried through `get_last_performance_for_slots` and both readers.
5. The **weight axis is untouched** (it reads the actual, for the documented #381 reason).
6. An ADR for the decision (why an additive anchor, not an overwrite of `prescribed_*`). No existing
   ADR is amended: the anchor *adds*, it does not redefine the Prescription Snapshot rule nor the
   Manual Override Window.
7. The measurement prerequisite: instrument served-rule distribution, consecutive `HOLD_INCOMPLETE`
   runs, unresolved `PLATEAU`. **Where they live is decided at the Tech Plan** (analytic event vs
   dedicated table) — this brief fixes only the three measures, not their storage.

**Out of scope:**

- P2 (deload planifié / sortie de `PLATEAU`), P3 (e1RM borné), P4 (paliers de poids disponibles) —
  epics séparés.
- P5 (ladder de plages de reps), P6 (état dérivé, périodisation par blocs).
- The duration/isometric axis anchor (follow-up if the hole is confirmed there).
- Prescribing load from an e1RM (two masters on one decision).
- The volume/frequency-per-muscle prerequisite (#149).
- Surfacing the anchor or the deviation reasons in the after-session UI.

---

## Success Criteria

- **Numeric:** 0 regression in the deviations observatory's direction classification; every new test
  green; the anchor propagation proven by test (in-session deload → next `volume.current`).
- **Qualitative:** a deliberate in-session deload demonstrably persists into the next session's
  prescription, while a mere rep miss does not, and `prescribed_*` still means "what the engine
  prescribed at session start".
- **Process:** an ADR records the anchor decision; the three engine metrics are live before the P2 work
  is scheduled.
