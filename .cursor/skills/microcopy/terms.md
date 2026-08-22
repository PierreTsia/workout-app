# User-facing terms

Allowlist for microcopy **values**. Source of truth is `docs/CONTEXT.md` and `docs/adr/`. This file is the compact UI extract — if CONTEXT and this file disagree, CONTEXT wins, then update this file.

Internal names (left column in CONTEXT, code identifiers) are **not** user-facing unless this table gives a UI form.

---

## Locked pairs

Use these words. Do not invent a synonym.

| Concept | EN | FR | Never in UI |
|---|---|---|---|
| **Program** | Program | Programme | plan (as the object), workout plan |
| **Session** | Session | Séance | workout (when you mean the logged run) |
| **workout day** | Day | Jour | |
| **Circuit** | Circuit | Circuit | Block, Exercise Block, WOD (as a type) |
| **Round** | Round | Tour | |
| **Tours** (mode) | Rounds | Tours | |
| **AMRAP** | AMRAP (as many rounds as possible) | AMRAP (autant de tours que possible) | `AMRAP` alone |
| **Cycle** | Cycle | Cycle | |
| **Builder** | Builder | Créateur d'entraînement | editor, Workout Builder (new keys) |
| **Library** | Library | Bibliothèque | |
| **Quick Workout** | Quick Workout | Séance rapide | QW, "Quick Generate" as a product name |
| **Achievements** | Achievements | Succès | trophy case (except the empty-state wink) |
| **Profile** | Profile | Profil | dashboard |
| **Session time** | Session time | Temps de séance | time under the bar |
| **RIR 0 rate** | % RIR 0 | % RIR 0 | (gloss RIR on the same screen) |
| **Tonnage** | Tonnage | Tonnage | volume (when you mean loaded weight × reps) |
| **Mix** | Mix | Mix | |
| **Regulars** | Regulars | Récurrents | habits, favorites |
| **Profil tenure** | Active since {{span}} | Actif depuis {{span}} | streak (that's a different term) |
| **Training streak** | Streak · {n} d | Série · {n} j | |
| **Hero hop line** | Also {{other}} this week | Aussi {{other}} cette semaine | |
| **Last Session Recap** | Last session / Program | Dernière séance / Programme | Last Performance |
| **Round Screen** | (no chrome name required) | | Block runner |
| **Benchmark Circuit** | named circuit / the circuit's label (Cindy, Zeus) | circuit nommé / le nom | WOD, seed |
| **Program Facts** | speak the facts (N days, N sets, N circuits) | N jours · N séries · N circuits | Program Facts (as a heading unless CONTEXT says so) |
| **Program Balance** | Balance | Équilibre | CV, log1p |
| **Goal Track** (hypertrophy) | Muscle growth | Prise de masse | Hypertrophy (unless glossed) |
| **Goal Track** (strength) | Strength | Force | |
| **Goal Track** (endurance) | Endurance | Endurance | |
| **Set** | Set | Série | |
| **Reps** | Reps | Reps / répétitions | |
| **Rest** | Rest | Repos | |
| **Transition** | Transition | Transition | |
| **Weight** | Weight | Poids | |
| **Hold** | Hold | Gainage / tenue | leftover English "Hold" in FR |
| **Personal record** | PR (personal record) | Record personnel | |
| **Personal best** (circuit score) | PB (personal best) | PB (meilleur score) | |
| **Embedded Agent** | the assistant | l'assistant | Gemini, Groq, Embedded Agent |
| **Onboarding form** | (field labels only) | | questionnaire (as a product name) |
| **MCP** | MCP (the connector that lets an AI agent talk to GymLogic) | MCP (le connecteur qui permet à un agent IA de parler à GymLogic) | MCP naked on first meeting |
| **MCP Personal Access Token** | personal access token (a long-lived password for agents) | jeton d'accès personnel (un mot de passe longue durée pour les agents) | PAT naked, opsec |
| **Display Locale** | Language | Langue | locale |

Loanwords kept in both languages (CONTEXT): **Circuit**, **AMRAP**, **RIR**, **Tonnage**. Do not translate those four into a "pure" French that CONTEXT rejected.

---

## Forbidden in values

From CONTEXT **Program Score Copy**, ADR 0007 §Decision.5, and the i18n scan:

- `Exercise Slot`, `Template Prescription`, `Goal Track`, `Exercise Block`, `block`, `Prescription Snapshot`
- `solo`, `solos` — say exercise / exercice
- `UUID`, `thread`, `dry_run`, `JSONB`, `RLS`, `JWT`, `RPC`
- `rep_range_max`, `MUSCLE_TAXONOMY`, `CV`, `log1p`, file paths
- Provider / model brand names in product chrome (Gemini, Groq, …)
- `WOD` as a GymLogic type (the catalog object is **Benchmark Circuit**)

Keys may use the internal word (`blockRunner.cancelBody`, `embeddedAgent.statusLine`). Values may not.

---

## Surface-specific laws (already decided)

- **Circuit vs Block** — ADR `file:docs/adr/0007-exercise-blocks-rich-structure-no-progression.md`. Humans say Circuit.
- **AMRAP never naked** — CONTEXT **AMRAP**. Badge `AMRAP 20 min` + gloss. Score `27+3` + leftover movement.
- **No provider branding** — CONTEXT **Embedded Agent onboarding product (v1)** rule 1. Privacy Policy is the exception.
- **Program scores** — speak like a coach to a beginner (muscles, sets, days, rest / muscles, séries, jours, repos). One rule-sentence visible; worked example on tap.
- **Cindy / Pantheon labels** — catalog `label` is the name. Do not rename Zeus to "20-min full-body AMRAP" in UI.

---

## If the term is missing

Do not improvise a user-facing name for a new domain concept. Add it to `docs/CONTEXT.md` first (canonical term + `UI:` EN/FR if the UI words differ from the domain name), then write the keys.
