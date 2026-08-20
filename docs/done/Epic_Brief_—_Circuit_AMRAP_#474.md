# Epic Brief — Circuit AMRAP (#474)

## Summary

Ajouter **AMRAP** comme mode de terminaison d’un **Exercise Block** : le Circuit s’arrête sur un cap de temps, le score est le nombre de **Rounds** (`27+3`), inverse du mode **Tours** actuel (N tours, score = **Circuit Completion Time**). Le mot **AMRAP** est user-facing FR et EN, **jamais nu** (`AMRAP 20 min` + *« Autant de tours que possible. »*). Même epic : refine du **Round Screen** / Builder (3-2-1-GO, clock chrome, liste uniforme) pour que Zeus et Cindy aient la gueule d’un WOD, pas d’un tableur. MCP + générateurs IA dans v1. **Benchmark Circuit** (#398) reste hors scope.

---

## Context & Problem

**Who is affected:** Pratiquants qui font du conditionnement / HIIT / benchmarks type Cindy ; users qui construisent déjà des Circuits **Tours** (Zeus, Athena) et trouvent le Round Screen « pas ouf » ; agents MCP et l’**Embedded Agent** / Quick Workout qui ne peuvent exprimer qu’un nombre de tours.

**Current state:**
- Un Circuit est un **Exercise Block** à `rounds NOT NULL` (`file:supabase/migrations/20260613130000_create_exercise_blocks.sql`). Grille `per_round.length === rounds`. Hors moteur de progression (ADR 0007).
- **Round Screen** (`file:src/components/workout/BlockRunner.tsx`) : une station à la fois, Valider, anneaux Repos/Transition, pas de clock de séance. Skip logge la prescription.
- Historique (#396, ADR 0008) : temps **dérivé** des `set_logs`, PB = plus rapide à fingerprint égal. Inutile quand tout le monde « fait 20:00 ».
- MCP Circuit Item (ADR 0011) et générateurs (`file:supabase/functions/generate-quick-workout/groq.ts`) : `type: "circuit"` + `rounds` seulement.
- #351 avait **coupé** AMRAP / EMOM. Le workout viral Cindy (5-10-15, 20 min, Holland 27) est exactement ce trou.

**Pain points:**
| Pain | Impact |
|---|---|
| Terminaison = tours figés | Cindy / « autant de tours en X min » inexprimable |
| Score = temps | Sur un cap, tout le monde a le même temps ; le vrai score (`27+3`) n’existe pas |
| Builder tableur | 3 inputs + grille pyramidale pour un WOD uniforme |
| Round Screen sans clock | Pas un effort chronométré ; Skip = triche potentielle en cap |
| MCP / IA aveugles au cap | Un agent pose Zeus, pas Cindy — même faille qu’avant #452 |
| Sigle AMRAP nu | Personne ne capte ; le terme doit s’enseigner dans l’UI |

---

## User Stories

**Définition (Builder)**
1. As an advanced user, I want to pick **Tours** or **AMRAP** when defining a Circuit, so that I choose how it *ends*.
2. As a user seeing **AMRAP** for the first time, I want the word **never naked** — always `AMRAP {n} min` plus *« Autant de tours que possible. »* (EN: *As many rounds as possible.*) — so that I don’t bounce on a CrossFit sigle.
3. As a user in AMRAP, I want to set the cap in **minutes** (default 20, range 1–60) in one gesture (20 → 10), so that Cindy and a 10-min version are both easy.
4. As a user in AMRAP, I want rest and **Transition** hidden and forced to 0, so that I’m not sabotaged by the 90s default.
5. As a user in **Tours**, I want a uniform movement list by default, with the per-round pyramid grid as an **opt-in**, so that a flat 4-round Circuit isn’t a spreadsheet.
6. As a user, I want to switch Tours ↔ AMRAP on an existing Circuit without a lock, so that changing my mind doesn’t require delete+recreate. Past runs stay on **their** fingerprint (cap is part of AMRAP identity).
7. As a user of existing Zeus/Athena Circuits, I want them to remain **Tours** (`mode: "rounds"` default) with zero migration of meaning, so that v1 Circuits don’t change overnight.

**Séance (Round Screen)**
8. As a user starting any Circuit, I want a polished **3-2-1-GO**, then the first station, so that it feels like a WOD not a form.
9. As a user in AMRAP, I want a **real wall-clock cap** starting at GO (not derived from the first log), so that unpaid time before the first pull-up doesn’t inflate the cap.
10. As a user in **Tours**, I want an **elapsed** clock on screen (display only; history stays ADR 0008 derived), so that Zeus gets the same family of UI.
11. As a user mid-station, I want the clock as **persistent chrome** and the station amount as the **hero** (Valider), so that I never tap the timer by mistake.
12. As a user in AMRAP, I want to see **`Tour 8`** with no denominator, and `2/3` inside the round, so that I’m not shown a fake `8/1`.
13. As a user, I want to **Valider** one station at a time (no « round done »), so that leftover reps and duration holds stay honest.
14. As a user when the cap hits 0, I want a **TIME** overlay (no more Valider), then a leftover stepper `0…amount` on the **current** station (holds: seconds, pre-filled with elapsed), then done, so that `27+3` is capturable.
15. As a user who is gassed before the cap, I want **Terminer** to take the same leftover path and keep the score, so that 14 rounds in 11 min is a result not a crash.
16. As a user who wants to abort, I want **Annuler** to wipe logs (today’s cancel), so that a false start doesn’t pollute history.
17. As a user in AMRAP, I want **no Skip**, so that I cannot mint empty rounds or skip pull-ups to log push-ups.
18. As a user who pauses the session, I want the AMRAP cap to **keep ticking** (wall-clock), so that `27+3` remains comparable.
19. As a user who kills the app at 12:00, I want remaining time restored from a persisted GO stamp **per (session, block)**, so that reload isn’t a 20:00 cheat. No second GO.
20. As a user on a mixed day (solo then AMRAP), I want the cap to start at that Circuit’s GO, not at **Démarrer**, so that the squat doesn’t eat Cindy.

**Score & historique**
21. As a user finishing AMRAP, I want the score **never naked**: hero `27+3` plus gloss `27 tours · 3 pompes` (leftover movement named), so that CrossFit notation is taught like the word AMRAP.
22. As a user reviewing history, I want the same **Block history sheet** with an inverted score: AMRAP = rounds+leftover (PB = more is better, leftover tie-break); Tours = time (PB = faster). Fingerprints never mixed.
23. As a user who changed the cap 20 → 10, I want a **new fingerprint / new PB**, so that two different WODs aren’t compared.

**MCP & IA**
24. As an agent author, I want `create_program` / `create_workout_day` / `update_program` to accept `{ type: "circuit", mode: "amrap", cap_minutes, exercises: [{exercise_id, amount, weight_kg}] }`, so that I can persist Cindy. Omitted `mode` stays Tours. `rounds` / `per_round` / rest / transition on AMRAP → **reject**, no silent drop.
25. As an agent, I want dry_run `rendered`, `get_program_details`, and `get_workout_history` to speak `AMRAP 20 min` and `27+3` glossed, so that I can propose, confirm, and read back the score.
26. As a user of Quick Workout / **Embedded Agent**, I want generators to **be able** to emit AMRAP (schema + validate + preview), but only on a **closed intent list** (the word AMRAP / « autant de tours » / Cindy / Holland / a cap with no round count). « HIIT 20 min » or « 4 rounds in 20 min » → Tours.

**Edge / offline / empty**
27. As a user offline, I want AMRAP logging and the GO stamp to follow the same offline-first queue as block `set_logs`, so that a dead gym basement doesn’t void the cap.
28. As a user on a day that is **only** an AMRAP Circuit, I want **Démarrer** then GO, so that a Cindy-only day is startable (`canStartPreSession` already allows block-only days).
29. As a first-time Builder user, I want the segmented **Tours | AMRAP** as the first control, not three equal number fields, so that the mode is the decision.

### Success measures

| Story # | Measure |
|---|---|
| 2, 21 | 0 surface (Builder, card, runner, history, MCP render) shows `AMRAP` or `27+3` without gloss — test snapshots |
| 9, 19 | Kill-app at T+12:00 of a 20 min AMRAP restores remaining ≈ 8:00 (±2s), not 20:00 |
| 24–25 | HITL: *« crée-moi Cindy AMRAP 20 min »* → dry_run shows `AMRAP 20 min · 5/10/15` → apply → details echo the same |
| 26 | Fixture « HIIT 20 min » emits Tours; fixture « Cindy / Holland / AMRAP 20 » emits AMRAP |
| 7 | Existing Circuits in DB need **no backfill** to keep behaving as Tours |

---

## Scope

**In scope (v1):**
- Schema: `mode` `'rounds' | 'amrap'`, `cap_seconds`, GO `started_at` per (session, block); AMRAP `per_round` length 1; leftover writes **actuals**.
- Builder: segmented Tours | AMRAP, minutes 1–60 default 20, rest/transition hidden in AMRAP, uniform list, pyramid opt-in Tours, free mode switch.
- Round Screen: 3-2-1-GO both modes, clock chrome (countdown / elapsed), station hero, TIME + leftover, Terminer vs Annuler, no Skip in AMRAP, `Tour N` without denominator.
- History sheet: inverted score; glossed `27+3`; fingerprint includes cap.
- MCP writes + reads + dry_run; skill + tool schemas.
- QW Groq + Embedded Agent draft schema/validate/preview + closed intent list.
- Glossary already started in `docs/CONTEXT.md`; ADR for schema + GO stamp + wall-clock cap (amends 0008’s « no persisted clock » **for AMRAP only**).
- Copy: **AMRAP** never naked; score never naked.

**Out of scope (v1):**
- **#398 Benchmark Circuit** (catalogue nommé, PR global « 27 » vs Holland).
- **T144 / #393** top-level « Créer un circuit » hors Builder.
- **EMOM** and prescribed rest inside AMRAP.
- Reopening ADR 0008 persistence for **Tours** completion time (elapsed is display-only).
- Achievements / leaderboards.

---

## Success Criteria

- **Qualitatif :** un user (ou un agent) définit Cindy (`AMRAP 20 min`, 5-10-15), part sur 3-2-1-GO, voit le cap en chrome, valide station par station, prend TIME avec leftover, lit `27+3` glosé en done + historique, et Zeus à côté n’a pas bougé.
- **Honnêteté :** Skip absent en AMRAP ; pause ne gèle pas le cap ; reload ne reset pas 20:00 ; 20 min et 10 min ne partagent pas un PB.
- **Pédagogie :** nulle part `AMRAP` ou `27+3` sans phrase d’aide.
- **Non-régression :** Circuits **Tours** existants (builder, runner, history dérivée, MCP `rounds`) byte-identical in meaning; generators default to Tours when intent is ambiguous.
- **MCP :** dry_run → details → history round-trip for an AMRAP Circuit without a second tool.

---

## References

- Issue : [#474](https://github.com/PierreTsia/workout-app/issues/474)
- Parents : #351, #396, #452. Pas #398.
- Glossary : `file:docs/CONTEXT.md` (**AMRAP**, **Tours**, **Round**, **Round Screen**, **Circuit Completion Time**)
- ADRs : `file:docs/adr/0007-exercise-blocks-rich-structure-no-progression.md`, `file:docs/adr/0008-circuit-completion-time-derived-not-scored.md`, `file:docs/adr/0011-mcp-circuit-items-in-exercises-array.md`
