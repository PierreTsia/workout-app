# Reference — Hevy Program Builder

Competitive captures for the **Canvas** step ([#503](https://github.com/PierreTsia/workout-app/issues/503)). Scores ([#504](https://github.com/PierreTsia/workout-app/issues/504)) sit on this same surface later. Not an Epic Brief. Not a commitment to clone.

**Hevy nouns vs ours:** a Hevy **Routine** is one day. A Hevy **Programme** is a folder of routines — closest to our **Program**. Their builder edits a routine. Ours edits a **workout day** on a **Program** (`DayEditor`).

Source PNGs: `file:docs/references/hevy-program-builder/`.

---

## Screens

| File | Screen | Usage | Notable patterns |
| --- | --- | --- | --- |
| [hevy-routines-home.png](references/hevy-program-builder/hevy-routines-home.png) | Routines home | Library of *days*: start empty, create, explore, then pick a routine to run. | Folders = programmes (collapsible). Card shows name + exercise preview so you don't open to know what's inside. One fat **Start** CTA per card; edit/overflow is `⋯`. Dashed “add” slot in **Mes routines**. Sticky **live session** bar (timer + current move + discard) — survives leaving the logger. |
| [hevy-programs-explore.png](references/hevy-program-builder/hevy-programs-explore.png) | Programmes / Explorer | Discover catalog programmes, then drop into a saved folder on home. | Filter chips (Niveau / Objectif) sit *above* the list. Programme row = thumbnail + title + “N routines”. “Afficher les 26” admits the list is a teaser. **Trainer** banner is a second creation door (AI). Below that, a 2-col **Routines** grid by *constraint* (home, travel, dumbbells…) — not by goal. Programme ≠ routine, visually. |
| [hevy-programs-filters.png](references/hevy-program-builder/hevy-programs-filters.png) | Filtres (Explorer sheet) | Narrow the catalogue before opening a programme. | Bottom sheet, 3×N icon cards: Level / Goal / Equipment. Goal includes **Perdre du poids** (we do not have that `UserGoal`). Sticky footer: clear vs **Afficher N résultats** (count on the button). |
| [hevy-program-detail.png](references/hevy-program-builder/hevy-program-detail.png) | Programme identity | Decide whether to save this plan. Read the week as written. | Hero: thumb + title + author + **Enregistrer**. Then a 2×2 meta grid (level, lieu, **goal**, routine count). Each routine is a named block: note + exercise rows (thumb + blue name + `sets · reps`). `⋯` per routine. This is the closest Hevy has to a **Program** page — we still only have `ProgramDetailSheet`. |
| [hevy-routine-builder-empty.png](references/hevy-program-builder/hevy-routine-builder-empty.png) | Créer une Routine (empty) | First stroke of authoring a day. | Modal chrome: Annuler / title / **Enregistrer** (disabled until something exists). Title is an inline field, not a settings screen. Empty state is one job: **+ Ajouter un exercice**. No set table until there is an exercise. |
| [hevy-add-exercise-browse.png](references/hevy-program-builder/hevy-add-exercise-browse.png) | Ajouter un Exercice (browse) | Find the next movement without leaving the builder. | Full-screen picker. Search first. Two chips: equipment / muscle. **Récents** then **Tous**. Row = circular thumb + name + primary muscle + `i` (inspect without selecting). **Créer** is a first-class header action (custom exercise). |
| [hevy-add-exercise-multiselect.png](references/hevy-program-builder/hevy-add-exercise-multiselect.png) | Ajouter un Exercice (selected) | Add several movements in one trip. | Same picker, multi-select: row tint + check on the thumb. Sticky **Ajouter N exercices** — count lives on the CTA, not a badge elsewhere. `i` still available so selection ≠ detail. |

---

## Flow (how the seven connect)

```
Routines home ──Explorer──► Programmes ──Filtres──► same list, narrower
       │                         │
       │                         └──► Programme detail ──Enregistrer──► folder on home
       │
       ├── Nouv. Routine ──► empty builder ──► add-exercise (browse → multi-select)
       └── Commencer la Routine ──► live session (sticky bar)
```

---

## What this is *not* yet

- No live muscle map, no goal-track scores, no clone/share. Those are our jobs on this floor.
- Hevy’s “goal” on the programme card is a **catalog tag** (hypertrophy / strength / fat-loss). It is not a live grade of the week as written. Do not confuse it with [#504](https://github.com/PierreTsia/workout-app/issues/504).
