# Epic Brief — Slot-Scoped Last Performance (#463)

## Summary

Quand le même exercice catalogue vit sous deux intentions de charge (salle en surcharge vs HIIT maison), le moteur ancre aujourd’hui sa **Progression Suggestion** sur la dernière perf *globale* — et pollue la séance lourde avec le poids léger. Cet epic rattache **Last Performance** (et le préremplissage séance) à l’**Exercise Slot**, via `set_logs.workout_exercise_id`, pour que chaque prescription progresse dans son propre historique sans casser trends / PR catalogue-globaux.

---

## Context & Problem

**Who is affected:** Tout utilisateur qui entraîne le même mouvement catalogue sous plusieurs **Exercise Slots** (programmes différents, ou intents différents dans un même programme) — cas réel du reporter (#463).

**Current state:**
- **Last Performance** was catalog-`exercise_id`-global before #463; glossary + ADR 0012 now define slot scope (implementation pending)
- **Exercise Block** logs are already excluded from the progression RPC (ADR 0007); two solo **Exercise Slots** sharing a catalog id are not
- `set_logs` has `block_exercise_id` but no link to the solo `workout_exercises` row
- Pre-session (`get_last_performance_for_exercises`) and in-session (`useLastSessionDetail`, `useLastSession`, `useLastWeights`) all read catalog-global today
- Product decisions locked in grill-with-docs → ADR `file:docs/adr/0012-slot-scoped-last-performance.md`

**Pain points:**

| Pain | Impact |
|---|---|
| Suggestion / préremplissage croisent les intents | Charge dangereusement sous-dosée (ou l’inverse) en séance force |
| **Manual Override Window** regarde une “dernière séance” globale | Un HIIT peut ouvrir/fermer la fenêtre d’override salle |
| Workaround = éditer le Builder avant chaque contexte | Friction ; ce n’est pas un modèle |

---

## User Stories

1. As a lifter alternating a heavy gym program and a light home program that share catalog exercises, I want each program’s **Progression Suggestion** anchored on that program’s **Exercise Slot** history, so that a light HIIT log never replaces my gym working weight.
2. As a lifter with two solos of the same catalog exercise in one program (heavy main lift + light finisher), I want each slot to keep its own **Last Performance**, so that intents inside one program don’t pollute each other either.
3. As a lifter opening a pre-session day list, I want the displayed suggestion weight/reps/sets to match the slot-scoped engine output, so that what I see before starting matches what I get in-session.
4. As a lifter mid-session, I want the “last time” line and the set prefill for an existing slot to reflect that slot’s last logs (not another context’s), so that the UI doesn’t contradict the **Progression Pill**.
5. As a lifter who swaps an exercise on a slot in the Builder or session, I want the new movement to bootstrap (not inherit the previous movement’s slot logs), so that rowing history doesn’t become lat-pulldown prescription.
6. As a lifter adding or swapping in a catalog exercise with no slot history yet, I want the initial template weight seeded from my last catalog-global load when available, so that a brand-new slot isn’t stuck at 0 when I’ve lifted that movement before. *(Preserve existing seed behavior — not a new feature workstream.)*
7. As a lifter who edited a slot’s **Template Prescription** since I last trained *that* slot, I want the **Manual Override Window** to ignore unrelated catalog sessions (e.g. HIIT), so that my deload/correction sticks until I train that slot again.
8. As a lifter logging sets offline then syncing, I want solo `set_logs` to carry `workout_exercise_id` through the queue, so that slot scope survives the offline path. Legacy or incomplete queue payloads without a slot id must **not** fall back to catalog-global **Last Performance** — the engine bootstraps from **Template Prescription** instead.
9. As a lifter with solo logs from before this change, I want those rows left unattached (`workout_exercise_id` NULL) so the engine bootstraps from **Template Prescription** rather than guessing a slot after deleted dual-intent siblings.
10. As a lifter whose past day logged the same catalog exercise in two slots (or once had two and deleted one), I want legacy rows never auto-attached to a surviving slot, so that the migration cannot reintroduce cross-intent pollution.
11. As a lifter training an **Exercise Block** (Circuit), I want block logs to remain outside the progression engine, so that ADR 0007 behavior is unchanged.
12. As a lifter reviewing exercise history, trends, or PRs, I want those views to stay catalog-global across programs, so that I can still see “how I’m progressing on rowing” as an athlete.
13. As a lifter who creates a new program (or deletes/recreates a slot) with the same catalog exercises, I want progression to start from that slot’s **Template Prescription**, so that slot identity stays honest (no silent cross-program inheritance).
14. As a lifter using Quick Workout / ad-hoc days, I want each day to mint fresh slots without accumulating engine progression across QWs, so that one-shot sessions don’t invent a fake progression identity.
15. As a lifter on a duration-based solo slot, I want slot-scoped **Last Performance** to apply the same way as reps/weight slots, so that duration axes don’t stay on the old global key.
16. As a lifter whose slot has never been logged (or only has null-FK legacy residue), I want the engine to bootstrap from **Template Prescription** with no suggestion anchored on foreign context, so that empty/orphan states fail safe.

### Success measures

| Story # | Measure |
|---|---|
| 1 | Reporter repro: after light home log then gym session, suggested weight for the gym slot stays on the gym anchor (± normal **Progression Rule** step), not the home load |
| 3–4 | Pre-session suggestion weight equals in-session prefill for the same slot on a dual-program fixture (automated) |
| 8 | Automated: queued solo payload without `workoutExerciseId` never anchors **Last Performance** via catalog-global fallback |
| 9–10 | Migration leaves pre-deploy solos with null `workout_exercise_id`; first post-deploy session bootstraps from template (spot-check: no guessed attachments) |

---

## Scope

**In scope:**
- Authoritative docs already from grilling: **Exercise Slot** in `docs/CONTEXT.md`, ADR `file:docs/adr/0012-slot-scoped-last-performance.md`
- Schema: `set_logs.workout_exercise_id` nullable FK → `workout_exercises`, `ON DELETE SET NULL`
- Write path: all solo set-log inserts, including offline queue (`SetLogPayload.workoutExerciseId`)
- **No** eager historical backfill (deleted dual-slot siblings make “unique now” unsafe)
- Read path: `get_last_performance_for_slots` + `useLastSessionDetail` + session prefill for **existing** slots
- Match key `(workout_exercise_id, exercise_id)` after Builder/session swap
- **Manual Override Window** uses the same slot-scoped last session as **Last Performance**
- Preserve catalog-global weight seed on add/swap (story 6 — no redesign)
- Fail-safe: no catalog-global **Last Performance** fallback for null FK (legacy, orphans, offline)
- Tests for dual-program / dual-slot, swap, block exclusion, offline null-FK bootstrap
- Close the loop on #463 (acceptance criteria; T176 HITL after deploy)

**Out of scope:**
- Cross-program progression inheritance / “fork program keep history”
- Slot identity across Quick Workout days
- Scoping trends / history / PRs to the slot
- Pedagogical UI explaining bootstrap vs former cross-intent pollution
- Progression inside **Exercise Blocks** (ADR 0007 unchanged)

---

## Success Criteria

- Dual-intent repro (#463) cannot make a heavy slot’s **Progression Suggestion** / séance prefill adopt the light slot’s last load
- **Last Performance** and **Manual Override Window** share one slot-scoped definition (CONTEXT + ADR 0012), implemented in RPC and client read paths
- Pre-migration solos never get a guessed FK; block logs never pull into solo progression via a solo slot FK
- Null-FK solo logs (legacy, orphan, incomplete offline payload) bootstrap from **Template Prescription** — never via catalog-global last performance
- Athlete-level history / trends / PRs remain catalog-global
- Automated coverage for dual-slot, swap, and null-FK bootstrap; plus T176 manual spot-check of the reporter repro after deploy
