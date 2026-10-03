# T268 — Fondation Nomos : pin, tokens, provider

## Goal

Installer la fondation de l'adoption de Nomos dans GymLogic : épingler `@nomosui/react@0.7.0`, brancher les tokens/theme CSS du cœur dans `globals.css`, et monter le `TooltipProvider` du cœur à la racine du rendu. À l'issue, l'app consomme les tokens Nomos **sans changement visuel** (les valeurs par défaut du cœur reproduisent l'identité GL), et les tickets de surface (T269–T272) peuvent s'appuyer sur les primitives cœur.

Contribute à l'epic #583 (mécanisme de consommation + skin).

## Mode

`AFK` — configuration + CSS + un provider, entièrement mécanique.

## Slice

`package.json (pin) → src/styles/globals.css (imports tokens/theme) → src/main.tsx (TooltipProvider) → npm run build/lint/test + passe @qa baseline`

## Dependencies

None.

## Scope

### Dépendance épinglée

| Item | Détail |
|---|---|
| Paquet | `@nomosui/react` |
| Version | **`0.7.0` (pin exact, pas de `^`)** — 0.x = breaking sur minor (ADR nomos 0024) |
| Registry | npmjs public, aucun `.npmrc`/secret |

### `src/styles/globals.css`

Ajouter en tête, après `@import 'tailwindcss'` (`file:src/styles/globals.css:1`) :

```css
@import '@nomosui/react/tokens/tokens.generated.css';
@import '@nomosui/react/tokens/theme.css';
```

- **Conserver le `@theme` GL existant** (`file:src/styles/globals.css:17-49`) : redondant mais inoffensif (mêmes valeurs), filet de sécurité ; dédoublonnage déféré à un ticket post-phase-1.
- Conserver les tokens GL hors-Nomos : `--heatmap-0..6` et les usages `hsl(var(--background))` / `hsl(var(--muted-foreground)/…)`.
- L'import de `theme.css` apporte le `@source '../dist/index.js'` indispensable au scan Tailwind des classes du cœur.

### `src/main.tsx`

Monter `TooltipProvider` (du cœur) autour de l'arbre, sans retirer les providers existants (`ThemeProvider`, `QueryClientProvider`, `AppErrorBoundary`, `RouterProvider`, `Toaster`).

- **Ne pas poser `data-density`** (défaut `1` = `0.25rem`, identique aujourd'hui).
- Le thème reste piloté par `next-themes` `attribute="class"` (pose `.dark`/`.light`, que les sélecteurs Nomos reconnaissent).

### Ne pas toucher

Les `TooltipProvider` vendorés locaux (`file:src/components/circuit/AmrapLabel.tsx:31`, `file:src/components/history/heatmap-calendar.tsx:338`, `file:src/pages/ProfilePage.tsx:110`) restent en place jusqu'à migration de leurs surfaces (hors phase 1).

## Out of Scope

- Migration de composition des pages admin → T269–T272.
- Dédoublonnage du `@theme` GL → ticket post-phase-1.
- Bump agent-os (autre dépôt, action séparée).

## Acceptance Criteria

- [ ] `package.json` contient `"@nomosui/react": "0.7.0"` (pin exact, sans caret).
- [ ] `node -e "console.log(require('@nomosui/react/package.json').version)"` affiche `0.7.0` après `npm ci`.
- [ ] `src/styles/globals.css` importe `tokens.generated.css` et `theme.css` ; le `@theme` GL et les tokens hors-Nomos sont conservés.
- [ ] `src/main.tsx` monte le `TooltipProvider` du cœur ; les providers existants sont intacts.
- [ ] `npm run build` et `npm run lint` passent ; `npm test` reste vert.
- [ ] Passe @qa baseline↔post sur les 7 pages admin (desktop light/dark + mobile) : **aucun diff visuel** (les défauts Nomos égalent la palette GL).
- [ ] Aucune chaîne user-facing ajoutée.

## References

- Tech Plan : `docs/Tech_Plan_—_Adopter_Nomos_phase_1_surfaces_admin_#583.md` (§ Architectural Approach, § Critical Constraints).
- Epic : GitHub #583. Baseline : rapport @qa (`/tmp/qa-gl583-admin-baseline/`).
- Modèle de câblage : `agent-os/src/main.tsx:9,21`, `agent-os/src/styles/globals.css:10-11`.
