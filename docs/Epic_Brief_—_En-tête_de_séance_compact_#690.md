# Epic Brief — En-tête de séance compact (#690)

## Summary

Sur l'écran d'une **Session** en cours, l'en-tête (`AppShell`) doit tenir sur un
écran mobile étroit. Aujourd'hui, depuis l'ajout du bouton texte « Terminer »
persistant (#571), la grappe de gauche grossit jusqu'à chasser le témoin de sync
hors de l'écran. On compacte les deux côtés : « Terminer » devient un bouton
**icône** (carré rouge) aligné sur pause / annulation, et le témoin de sync
devient un **dot coloré** à quatre états. Résultat : toutes les commandes et
l'état de sync restent visibles sans toucher à la logique de session.

---

## Context & Problem

**Who is affected:** tout utilisateur qui lance une **Session** et consulte
l'en-tête en cours de séance, en particulier sur un téléphone étroit (≤ 375 px).

**Current state:**
- L'en-tête est en `justify-between` sans `min-w-0` ni `shrink-0`
  (`file:src/components/AppShell.tsx:43`).
- Grappe gauche : `☰` + `SessionTimerChip` (timer + pause + annulation) +
  `FinishSessionButton` (`file:src/components/workout/FinishSessionButton.tsx`).
- Grappe droite : `RestTimerPill` (si actif) + `SyncStatusChip`
  (`file:src/components/SyncStatusChip.tsx`).
- `FinishSessionButton` est un bouton **texte** (`variant="outline" size="sm"`),
  large ; `SyncStatusChip` est un `Badge` **texte** (« Synchronisé »,
  « Échec de synchro »…), large aussi.

**Pain points:**
| Pain | Impact |
|---|---|
| Le bouton texte « Terminer » élargit la grappe de gauche | le témoin de sync sort de l'écran sur mobile |
| Un `RestTimerPill` actif amplifie la pression de largeur | le sync disparaît même sur des largeurs moyennes |
| Le témoin de sync est un badge texte verbeux | il consomme la ressource la plus rare (largeur) pour une info ambiante |

---

## User Stories

1. As an athlete mid-session on a narrow phone, I want the sync indicator to stay
   on screen, so that I can tell whether my session is being saved.
2. As an athlete mid-session, I want the finish control to stay reachable, so that
   I can end my session from the header.
3. As an athlete, I want to read the sync state at a glance, so that I do not have
   to parse a word.
4. As an athlete offline or in sync failure, I want a distinct persistent signal,
   so that I notice the degraded state.
5. As a screen-reader user, I want each sync state to expose a translated label,
   so that the dot is not a colour-only signal.
6. As an athlete, I want the header row (☰, timer, pause, cancel, finish) to stay
   aligned on one line, so that it does not wrap or clip.
7. As an athlete with a rest timer active, I want the rest pill and the sync
   indicator to coexist, so that a rest does not hide sync state.
8. As a sighted athlete, I want the finish button to be recognizable as a stop
   control, so that I still know it ends the session.
9. As an athlete mid-session from another route, I want the finish icon to keep
   working (navigate home then request finish), so that behaviour is unchanged.

### Success measures

| Story # | Measure |
|---|---|
| 1, 6, 7 | Header fits without horizontal overflow at 360 px, with and without `RestTimerPill` |
| 3, 5 | Each of the four states renders a distinct colour class + a translated `aria-label` |
| 8, 9 | Finish icon has accessible name `Finish` and still bumps `finishRequestAtom` |

---

## Scope

**In scope:**
- `FinishSessionButton` → bouton icône `variant="ghost" size="icon"`,
  `h-7 w-7 rounded-full text-destructive`, icône carré rouge (`Square`),
  `aria-label` depuis `workout.finish`.
- `SyncStatusChip` → dot coloré 4 états : gris `offline`, ambre (pulse)
  `syncing`, vert `synced`, rouge `failed` ; `idle` + online → rien. `aria-label`
  par état depuis les clés `common` existantes.
- Tests unitaires des deux composants (états, labels, comportements).

**Out of scope:**
- Durcissement du layout (`shrink-0` / `min-w-0`) — décidé minimal.
- Refonte de `RestTimerPill`.
- Tout changement de sémantique ou de données de sync (`syncStatusAtom` inchangé).
- Toute écriture DB / migration / Edge Function.

---

## Success Criteria

- **Numeric:** `npm test` vert ; `npx tsc -b` sans erreur ; `npm run lint` sans
  erreur ; aucun overflow horizontal de l'en-tête à 360 px.
- **Qualitative:** l'en-tête garde visibles timer, pause, annulation, terminer et
  l'état de sync ; le dot couvre les quatre états avec un `aria-label` traduit ;
  « Terminer » reste reconnaissable (carré rouge) et son comportement est inchangé.
