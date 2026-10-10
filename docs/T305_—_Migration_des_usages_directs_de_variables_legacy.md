# T305 — Migration des usages directs de variables legacy

## Goal

Migrer les derniers composants qui lisent directement les variables HSL legacy (`hsl(var(--primary))`, `hsl(var(--muted))`, `hsl(var(--border))`) vers les variables Nomos (`--nomos-color-*`). Couvre la story 8 : retirer le `@theme` legacy ne cassera rien. Changement **value-preserving** (mêmes valeurs).

## Mode

AFK — substitution mécanique, `grep`-vérifiable.

## Slice

`6 composants → arch test (grep)`

## Dependencies

None — `--nomos-color-*` est déjà fourni par l'import CSS courant. Parallélisable avec T303.

## Scope

### Fichiers

| Fichier | Substitution |
|---|---|
| `file:src/components/RestTimerDrawer.tsx` | `hsl(var(--muted))` → `hsl(var(--nomos-color-muted))` ; `hsl(var(--primary))` → `hsl(var(--nomos-color-primary))` |
| `file:src/components/workout/CountdownRing.tsx` | idem |
| `file:src/components/workout/ExerciseHistoryTrendChart.tsx` | `hsl(var(--border))` → `hsl(var(--nomos-color-border))` |
| `file:src/components/body-map/bodyMapColors.ts` | `hsl(var(--primary) …)` → `hsl(var(--nomos-color-primary) …)` (conserver les opacités) |
| `file:src/components/body-map/BodyMap.tsx` | idem |
| `file:src/components/history/ExerciseChart.tsx` | idem |

- Un `grep` final ne doit plus trouver `var(--primary)`, `var(--muted)`, `var(--border)`, `var(--input)`, `var(--ring)`, `var(--card)`, `var(--background)`, `var(--foreground)` hors `globals.css` et hors `var(--heatmap-*)`.

### Arch test

- Ajouter à `src/test/glSkin.arch.test.ts` : aucun `src/**` (hors `globals.css`) ne contient `var(--primary|muted|border|input|ring|card|background|foreground)`.

## Out of Scope

- Retrait du `@theme` legacy (T306) — cette migration le rend possible.
- La rampe `--heatmap-*` (reste GL, non migrée).
- Les classes Tailwind (`bg-primary`, `text-muted-foreground`) — inchangées.

## Acceptance Criteria

- [ ] Les 6 fichiers lisent `--nomos-color-*`.
- [ ] `grep` ne trouve plus aucune variable legacy hors `globals.css` et `--heatmap-*`.
- [ ] Rendu identique (mêmes valeurs) ; `npm run lint` et `npm test` verts.

## References

- Epic Brief `file:docs/Epic_Brief_—_Skin_GL_nommé_partagé_app_et_vues_MCP.md` (story 8)
- Tech Plan `file:docs/Tech_Plan_—_Skin_GL_nommé_partagé_app_et_vues_MCP.md` (§ Modified Files, Critical Constraints)
