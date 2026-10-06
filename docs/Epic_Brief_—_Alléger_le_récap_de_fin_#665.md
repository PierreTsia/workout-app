# Epic Brief — Alléger le récap de fin de séance (#665)

## Summary

Après une séance, l'écran de fin (`SessionSummary`) affiche aujourd'hui une section
**Ajustements** (`SessionAdjustments`) qui liste les déviations de charge capturées
pendant la séance (`reasonCode` + note). Une fois la séance terminée, ce détail n'aide
plus la personne qui vient de s'entraîner : elle veut lire son **bilan de séance** et,
au plus, écrire une **note de fin**. Cet epic retire entièrement la section déviations
du récap, sans remplacement, tout en conservant la capture et la persistance des
déviations pour l'observatoire interne.

---

## Context & Problem

**Who is affected:** toute personne qui termine une séance dans la PWA.

**Current state:**
- `file:src/components/workout/SessionSummary.tsx` rend `SessionAdjustments` quand la
  prop `adjustments` est fournie.
- `file:src/pages/WorkoutPage.tsx` lit `session_deviation_events` via
  `useSessionDeviations`, fusionne avec la file offline, et passe le résultat au récap.
- La capture in-session (`SetsTable`, `DeviationReasonSheet`) et la persistance
  (`syncService`, table `session_deviation_events`) sont indépendantes du récap.

**Pain points:**

| Pain | Impact |
|---|---|
| Le récap expose des raisons de déviation après coup | Bruit sur un écran de bilan ; l'athlète n'agit plus dessus |
| Le récap mélange bilan et journal interne | Charge cognitive, écran plus long que nécessaire |
| La note de fin est noyée sous la section déviations | La seule action utile du récap est moins visible |

---

## User Stories

1. As an athlete who just finished a session, I want the recap to show only my session
   summary (exercises/sets, duration, PRs), so that I read my result without internal
   noise.
2. As an athlete, I want no deviation reason, deviation note, or deviation delta on the
   finish screen, so that the recap never re-opens a decision I already made mid-session.
3. As an athlete, I want to keep writing a one-line session note on the recap, so that I
   can annotate how the session felt.
4. As an athlete, I want my session note to persist to `sessions.session_note`, so that
   it survives a reload and a later read.
5. As an athlete mid-session, I want the deviation reason prompt to work exactly as
   before, so that nothing about capture changes.
6. As the product owner, I want deviation events and reasons still captured and readable
   internally, so that the observatory keeps its data.
7. As a maintainer, I want the dead UI (`SessionAdjustments`, its test, the `adjustments`
   plumbing) removed, so that the codebase carries no unused surface.

### Success measures

| Story # | Measure |
|---|---|
| 1, 2 | The finish recap renders no `Adjustments` heading and no deviation row |
| 3, 4 | `SessionNote` still renders and `enqueueSessionNote` still persists |
| 5, 6 | `SetsTable` / `DeviationReasonSheet` / `syncService` untouched; arch test still green |

---

## Scope

**In scope:**
- Remove the deviations section from the end-of-session recap.
- Remove the now-dead UI: `SessionAdjustments.tsx` + test, the `adjustments` prop of
  `SessionSummary`, the `useSessionDeviations` wiring in `WorkoutPage`.
- Delete `useSessionDeviations.ts` if nothing else imports it.
- Keep `SessionNote` and its persistence.
- Update the **Deviation** entry in `file:docs/CONTEXT.md`.

**Out of scope:**
- Removing in-session reason capture (`SetsTable`, `DeviationReasonSheet`).
- Deleting or migrating already-stored deviation data.
- Changing deviation or progression computation rules.
- Any replacement section on the recap.

---

## Success Criteria

- **Qualitative:** the finish recap is centred on the session summary; no deviation
  reason, note, or delta appears.
- **Qualitative:** the session note remains enterable and persisted.
- **Qualitative:** capture, persistence, and internal access to deviation events are
  unchanged (arch test + `syncService` tests still green).
- **Numeric:** `npm test`, `npm run lint`, `npx tsc -b` all pass.
