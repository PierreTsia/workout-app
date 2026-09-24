# Microcopy examples

Corpus: `src/locales/{en,fr}/*.json` (1,540 strings × 2). Steal the left column. Do not ship the right column again.

---

## Keep this rhythm

### Error, one wink, then a next step

| | EN | FR |
|---|---|---|
| Good | Dropped the bar / Something crashed mid-set. Hit retry to get back on track, or head home and start fresh. | Raté la rep / Un truc a planté en pleine série. Réessaie ou retourne à l'accueil pour repartir de zéro. |
| Good | This page skipped leg day — it doesn't exist. | Cette page a séché l'entraînement — elle n'existe pas. |
| Stuck | Something went wrong. Please try again. | Un problème est survenu, veuillez réessayer |

### Teach the term on first meeting

| | EN | FR |
|---|---|---|
| Good | RIR (reps in reserve) — how many more reps you could have done. | RIR (répétitions en réserve) — combien de répétitions tu aurais encore pu faire. |
| Good | AMRAP (as many rounds as possible). | AMRAP (autant de tours que possible). |
| Good | This line is your best estimated one-rep max (1RM) — the weight you could likely lift once, inferred from the weight and reps you logged. | Cette courbe est ton meilleur 1RM estimé (charge max sur une répétition) — le poids que tu pourrais probablement soulever une fois, déduit du poids et des reps que tu as enregistrés. |
| Naked | 1RM / PRs / RIR 0 | 1RM / PRs / RIR 0 |

Existing `workout.rir.infoText` and `historySheet.epleyInfoBody` are the house style for explainers. Existing `profile.records.hint` is too compressed for a first meeting — new hints should gloss.

### Profile hint (factual, one job)

| | EN | FR |
|---|---|---|
| Good | How many days you trained. Dashed line = 4 days a week. | Combien de jours tu t'es entraîné. La ligne pointillée = 4 jours par semaine. |
| Good | Weight × reps, only when you logged a weight. 0 kg and timed holds don't count. | Poids × reps, seulement si tu as enregistré un poids. 0 kg et les gainages ne comptent pas. |
| Schema leak | Sets · 1 / 0.5 | Sets · 1 / 0.5 |

### Circuit, not block

| | EN | FR |
|---|---|---|
| Good | Create circuit | Créer un circuit |
| Good | Nice work — every round logged. | Bien joué — tous les tours sont enregistrés. |
| Good | This will no longer be Cindy. Scores you already logged stay. From now on, this is a different workout. | (same facts, tu, no "fork") |
| Leak | Cancel block / UUID list shown for now | Annuler le block / liste d'UUID |

### Our-side failure

| | EN | FR |
|---|---|---|
| Good | We couldn't save your answers. Something went wrong on our side. Try again in a moment. | On n'a pas pu enregistrer tes réponses. C'est de notre côté. Réessaie dans un instant. |
| Good | You're offline. Reconnect to keep building your program. | Tu es hors ligne. Reconnecte-toi pour continuer ton programme. |
| Stuck | Mutation failed | Échec de la mutation |

### Celebration (one bang)

| | EN | FR |
|---|---|---|
| Good | Session complete! | Séance terminée ! |
| Good | Unlocked | Débloqué |
| Too much | Session Complete! / Cycle Complete! / First cycle — great start! stacked on one screen | (same) |

---

## Do not ship again

These exist in the corpus. They fail the tone. New keys must not rhyme with them.

| Key (approx.) | Why it fails | Write this instead |
|---|---|---|
| `onboarding.welcomeDescription` "perfect training plan" | Marketing, not factual | "A few questions so we can build a program that fits." |
| `create-program.split_ppl` `PPL` | Naked acronym, gym slang | `Push / pull / legs (PPL)` / `Poussée / tirage / jambes (PPL)` |
| `create-program.split_bro_split` `Bro Split` | Jargon | `One muscle group per day` / `Un groupe musculaire par jour` |
| `onboarding.goalBadge_hypertrophy` `Hypertrophy` | Jargon; sibling key already says Muscle growth | `Muscle growth` / `Prise de masse` |
| `create-program.embeddedAgentPreview.argsFallbackHint` UUID | Internal leak | Do not mention UUIDs. "Exercise names will show on the next refresh." |
| `embeddedAgent.statusLine` `Thread {{idShort}}` | Internal leak | Drop it, or "Conversation · {{status}}" |
| `api-tokens.subtitle` `MCP and headless agents` | Naked MCP + jargon | `Long-lived passwords so an AI agent (Claude, Cursor) can talk to GymLogic.` |
| `api-tokens.lifetimeNeverWarning` `opsec` | Jargon | `A token that never expires is easier to steal. Prefer 90 days.` |
| `profile.mix.slice.programme` `Programme` in EN | FR word in EN | `Program` |
| `workout.holdOverBody` FR `Log ta série` | English verb in FR | `Enregistre ta série` |
| `common.workoutBuilder` EN `Workout Builder` vs FR `Créateur` | New keys: Builder / Créateur d'entraînement | (see terms.md) |
| `feedback.errorToast` `Please try again` | Stuck, no next step | `Couldn't send. Check your connection and retry.` |

---

## Worked request

**Ask:** New empty state on the circuit catalog when the fetch fails.

**Contract**

| Key | EN | FR | Why |
|---|---|---|---|
| `library.circuitsBrowseError` | Couldn't load circuits. Try again. | Impossible de charger les circuits. Réessaie. | Factual, next step, no "please" |
| `library.circuitsBrowseEmpty` | No circuits yet. | Pas encore de circuits. | Short. No joke — empty catalog is not a punchline |

**Rejected:** "Circuits failed to hydrate" (jargon). "The benchmark shelf is empty — time to meet Cindy!" (fun on a data hole; also names a seed the user may not know).
