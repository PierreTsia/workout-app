# Tech Plan — En-tête de séance compact (#690)

## Architectural Approach

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Bouton « Terminer » | Icône seule, `buttonVariants({ variant: "ghost", size: "icon" })` + `h-7 w-7 rounded-full text-destructive` | Aligne la commande sur pause / annulation (`file:src/components/SessionTimerChip.tsx:104-126`) et retire la largeur du libellé |
| Icône de fin | `Square` (lucide) avec `fill-current` | Carré rouge = métaphore « stop / terminer » reconnue ; `fill-current` hérite de `text-destructive` |
| Nom accessible de fin | `aria-label={t("finish")}` (`workout`) | Réutilise la clé existante ; le nom accessible « Finish » reste identique → tests existants inchangés |
| Témoin de sync | `<span>` dot `h-2.5 w-2.5 rounded-full` à la place du `Badge` texte | Plus gros gain de largeur, signal ambiant mieux adapté qu'un mot |
| États du dot | `offline` → anneau vide gris, `syncing` → dot ambre (pulse), `synced` → dot plein vert, `failed` → carré rouge | Les 4 états existants de `syncStatusAtom` + `navigator.onLine` sont conservés 1:1 ; **forme + animation distinguent les états sans dépendre de la couleur** (WCAG 1.4.1) |
| Nom accessible du dot | wrapper `role="status"` (live region, monté en permanence) + texte `sr-only` ; dot en `aria-hidden` | Le dot ne doit pas être un signal couleur-seul ; la live region doit exister avant le changement d'état pour annoncer le libellé traduit |
| Layout de l'en-tête | Inchangé | Décision de grill : le compactage A+B suffit, pas de `shrink-0` |

### Critical Constraints

- **Aucune modification de `syncStatusAtom` ni de `finishRequestAtom`.** On ne touche qu'à la présentation ; la logique de fin (`file:src/components/workout/FinishSessionButton.tsx:27-30`) et d'état de sync (`file:src/store/atoms.ts`) est figée.
- **Le nom accessible du bouton de fin ne doit pas changer.** `FinishSessionButton.test.tsx` interroge `getByRole("button", { name: "Finish" })` ; on conserve donc `aria-label={t("finish")}`, pas un libellé d'icône inventé.
- **`idle` + en ligne reste invisible.** Comportement actuel (`file:src/components/SyncStatusChip.tsx:25-34`) : ne rien afficher quand rien ne se passe. On garde ce contrat, seul `idle` + hors ligne produit le dot gris.
- **Pas de couleur arbitraire.** Les classes `bg-green-500` / `bg-amber-500` suivent l'usage existant (`text-green-500` dans `file:src/components/builder/SaveIndicator.tsx:41`, `bg-green-500/15` dans `file:src/components/workout/BlockSessionCard.tsx:82`) ; `bg-destructive` et `border-muted-foreground` sont des tokens. La règle eslint ne bannit que `bg-[#…]` (`file:eslint.config.js:68-71`).
- **`RestTimerPill` non touché.** Il reste dans la grappe droite ; son coexistence avec le dot est couverte par le test de largeur.

---

## Data Model

Aucun changement de modèle de données : ni table, ni migration, ni type persisté. Les seuls états sont en mémoire (`syncStatusAtom`, `navigator.onLine`, `sessionAtom`).

---

## Component Architecture

### Layer Overview

```mermaid
graph TD
    AppShell["AppShell header (unchanged layout)"]
    AppShell --> Left["left cluster"]
    AppShell --> Right["right cluster"]
    Left --> Menu["☰ drawer"]
    Left --> STC["SessionTimerChip (timer + pause + cancel) — unchanged"]
    Left --> FSB["FinishSessionButton → icon Square (ghost)"]
    Right --> RTP["RestTimerPill — unchanged"]
    Right --> SSC["SyncStatusChip → coloured dot (role=status)"]
```

### New Files & Responsibilities

Aucun fichier **de production** nouveau : les deux composants modifiés gardent leur
chemin et leur nom. Un fichier de test unitaire est ajouté et la suite e2e gagne un cas.

| File | Change |
|---|---|
| `file:src/components/workout/FinishSessionButton.tsx` | Bouton texte → bouton icône (`Square`), `aria-label={t("finish")}` |
| `file:src/components/SyncStatusChip.tsx` | `Badge` texte → dot 4 états ; `role="status"` (live region) + texte `sr-only` ; forme par état |
| `file:src/components/workout/FinishSessionButton.test.tsx` | Assertion d'icône (contenu vide + `<svg>`) ; 4 tests existants conservés |
| `file:src/components/SyncStatusChip.test.tsx` | **Nouveau** : 4 états, `idle`+online → absent, label traduit, forme par état |
| `file:e2e/workout-session.spec.ts` | **Ajout** : en-tête sans overflow à 360 px (session + rest pill + dot), Finish + dot dans le viewport |

### Component Responsibilities

**`FinishSessionButton`**
- Reste monté seulement si `session.isActive` (inchangé).
- Rend un `Button` `variant="ghost" size="icon"`, `h-7 w-7 rounded-full text-destructive hover:bg-destructive/20 hover:text-destructive`.
- Contenu : `<Square className="h-3.5 w-3.5 fill-current" />`.
- `aria-label={t("finish")}` — nom accessible identique à avant.
- `onClick` inchangé : navigue vers `/` si nécessaire puis incrémente `finishRequestAtom`.

**`SyncStatusChip`**
- Résout un état unique : `offline` si `status === "idle" && !online` ; sinon l'un de `syncing` / `synced` / `failed` ; `null` si `idle && online`.
- Rend un wrapper `<span role="status">` **monté en permanence** (la live region existe avant le premier changement d'état, sinon l'annonce initiale est manquée) ; le dot `aria-hidden` et le label `sr-only` ne sont rendus que lorsqu'un état est visible. Le contenu est annoncé aux lecteurs d'écran. Forme par état : anneau vide (`rounded-full border border-muted-foreground`) / pulse (`rounded-full bg-amber-500 animate-pulse`) / dot plein (`rounded-full bg-green-500`) / carré (`rounded-[2px] bg-destructive`). Le radius vit sur chaque état, jamais sur la base (conflit Tailwind `rounded-full` émis après `rounded-[2px]`).
- Aucun abonnement supplémentaire : conserve `useSyncExternalStore(subscribeOnline, getOnlineSnapshot)` et `useAtomValue(syncStatusAtom)`.

### Failure Mode Analysis

| Failure | Behavior |
|---|---|
| `syncStatusAtom` vaut `idle` et l'appareil est en ligne | Aucun dot rendu (comportement actuel préservé) |
| L'appareil passe hors ligne (`offline` event) | Le dot passe gris, même en `idle` |
| Sync échoue (`failed`) | Dot rouge persistant + `aria-label` « Échec de synchro » |
| Session non active | `FinishSessionButton` retourne `null` ; le dot de sync est indépendant de la session |
| Largeur 360 px avec `RestTimerPill` actif | L'en-tête tient sur une ligne : gauche ≈ menu + timer + 3 icônes, droite ≈ pill + dot |

---

## i18n contract

**Aucune nouvelle chaîne utilisateur.** Le dot réutilise les clés existantes du namespace `common` — `offline` / `syncing` / `synced` / `syncFailed`
(`file:src/locales/{en,fr}/common.json`) — comme `aria-label`, et le bouton de fin réutilise `workout.finish`
(`file:src/locales/{en,fr}/workout.json:36`). Aucune clé à créer, aucun passage `microcopy`.
