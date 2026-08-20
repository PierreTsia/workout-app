# T145 — Dual-locale test harness

## Goal

Rendre `createTestI18n()` capable de rendre en **français**. Aujourd'hui il est câblé en dur sur `lng: "en"` et n'importe que les 20 namespaces anglais (`file:src/test/utils.tsx` 32-63) : aucun test ne peut prouver qu'une surface reste correcte en FR. La story 4 du brief — *« un utilisateur français ne voit aucun changement »* — est donc **structurellement invérifiable** tant que ce ticket n'est pas livré.

Prérequis dur de tout l'epic : sans lui, chaque ticket suivant ne peut tester que la moitié du comportement qu'il introduit.

## Mode

**AFK** — changement d'outillage, aucune décision produit.

## Slice

`createTestI18n({ lng })` → `renderWithProviders(ui, { locale })` → un test FR de démonstration

## Dependencies

Aucune.

## Scope

### `createTestI18n`

- Accepte `{ lng }: { lng?: "en" | "fr" } = {}`, défaut `"en"` — **tous les tests existants doivent continuer à passer sans modification**.
- Importe les 20 namespaces FR en miroir des EN, et fournit `resources: { en, fr }` pour que `fallbackLng` reste réel en test comme en prod.
- Garder les deux listes de `import` adjacentes et ordonnées à l'identique : leur divergence est le mode de panne évident de ce fichier.

### `renderWithProviders` / `renderHookWithProviders`

- Nouvelle option `locale?: "en" | "fr"`, passée à `createTestI18n`.
- `i18nInstance` reste exposé dans le retour (déjà le cas), pour les tests qui veulent basculer la langue à chaud.

### Test de démonstration

- Un test qui rend une surface déjà localisée dans les deux locales et assère un libellé distinct par langue. Sert de canari : si l'import FR casse, ce test tombe avant les 40 autres.

## Out of Scope

- Le namespace `catalog` (T146) — ce ticket ne fait que rendre les ressources FR atteignables.
- Migrer les tests existants vers le FR : ils restent EN par défaut, on ajoute des cas FR ticket par ticket.

## Acceptance Criteria

- [ ] `createTestI18n()` sans argument se comporte exactement comme aujourd'hui.
- [ ] `createTestI18n({ lng: "fr" })` rend les libellés français.
- [ ] `renderWithProviders(ui, { locale: "fr" })` propage la locale à l'arbre.
- [ ] Les 20 namespaces FR sont chargés (pas seulement `common`).
- [ ] La suite existante passe sans modification d'un seul fichier de test.

## References

- Epic Brief : story 4 (non-régression FR)
- Tech Plan : § Critical Constraints (harnais de test), § Modified Files
- `file:src/test/utils.tsx`
