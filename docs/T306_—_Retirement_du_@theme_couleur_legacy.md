# T306 — Retirement du @theme couleur legacy

## Goal

Retirer le mapping couleur legacy de `globals.css` (bloc `@theme` + valeurs HSL `:root/.dark/.light` couvertes par Nomos), en ne conservant qu'un `@theme` minimal GL (animations) et un bloc GL `--heatmap-*`. Le raccord Tailwind vient désormais de `@nomosui/react/tokens/theme.css`. Couvre les stories 2, 4, 7, 14.

## Mode

AFK — retrait + migration des deux usages restants ; l'audit visuel est T308.

## Slice

`src/styles/globals.css → app`

## Dependencies

T303 (l'import skin remplace le défaut) et T305 (plus aucun usage direct des vars legacy).

## Scope

### Retraits

- Bloc `@theme` : retirer **toutes** les entrées couleur (`--color-border`, `--color-primary`, …, `--color-teal`) — le mapping vient de `theme.css`.
- Blocs `:root`, `.dark`, `.light` : retirer les variables HSL couleur (`--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`) et `--radius`.

### Conservations (bloc GL distinct)

- `@theme` minimal : `--animate-accordion-down`, `--animate-accordion-up`, `--animate-success-flash` + leurs `@keyframes` (utilisés par `file:src/components/ui/accordion.tsx` et `file:src/components/feedback/FeedbackSheet.tsx`). **Aucune** entrée couleur ici (garde-fou du test T307).
- Bloc GL `:root` (dark par défaut) / `.light` : `--heatmap-0..6` (rampe spécifique GL, lue par `file:src/components/history/TrainingHeatmap.tsx`).
- Bloc `@layer base html/body` : `html { background-color: hsl(var(--nomos-color-background)) }` (`hsl(var(--background))` → Nomos).
- Guard d'orientation (`@media (orientation: landscape)…`) : `background: hsl(var(--nomos-color-background))`.
- Achievements overlay, `@custom-variant dark`, utilities `container`/`scrollbar-*`, compat border-color : inchangés.

## Out of Scope

- Audit visuel (T308).
- Toute modification de composant.
- Le contenu du `glSkin`.

## Acceptance Criteria

- [ ] `globals.css` n'a plus aucun `--color-*` legacy, ni aucune variable HSL `--primary/--muted/--border/…` hors `--heatmap-*`.
- [ ] `animate-accordion-down/up` et `animate-success-flash` fonctionnent toujours (FeedbackSheet, accordion).
- [ ] Le thème dark/light et le toggle existant (`file:index.html`, `file:src/lib/themeStorage.ts`) fonctionnent via `.dark`/`.light` Nomos.
- [ ] La rampe heatmap reste identique (7 stops dark + light).
- [ ] `npm run lint` et `npm test` verts.

## References

- Epic Brief `file:docs/Epic_Brief_—_Skin_GL_nommé_partagé_app_et_vues_MCP.md` (stories 2, 4, 7, 14)
- Tech Plan `file:docs/Tech_Plan_—_Skin_GL_nommé_partagé_app_et_vues_MCP.md` (§ Critical Constraints, Component Responsibilities)
