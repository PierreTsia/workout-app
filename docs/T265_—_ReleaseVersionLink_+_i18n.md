# T265 — `ReleaseVersionLink` sur About + Account + i18n (AFK)

**Mode:** AFK · **Slice:** `src/components/ReleaseVersionLink.tsx → src/locales/{en,fr}/common.json → src/pages/AboutPage.tsx → src/pages/AccountPage.tsx`

## Goal

Afficher la version de release et un lien vers les notes sur `AboutPage` et `AccountPage`, via un composant partagé qui consomme `useReleaseVersion` (T264). Copie EN + FR.

## Dependencies

- T264 (`useReleaseVersion`, `GITHUB_RELEASES_URL`).
- Design système existant : classes Tailwind des sections About (`text-zinc-500`) et du pied de compte (`text-muted-foreground`).

## Scope

### Composant partagé

| Item | Detail |
|---|---|
| Fichier | `file:src/components/ReleaseVersionLink.tsx` |
| Rendu | `<p className={className}>` → `t("common:releaseVersion", { version })` puis `<a href={GITHUB_RELEASES_URL} target="_blank" rel="noopener noreferrer">` avec `t("common:releaseNotes")` + `ExternalLink` (`lucide-react`) |
| Version | `useReleaseVersion()` |
| i18n | namespace `common` |

### i18n

| Fichier | Clés |
|---|---|
| `file:src/locales/en/common.json` | `releaseVersion` = `Version {{version}}`, `releaseNotes` = `Release notes` |
| `file:src/locales/fr/common.json` | `releaseVersion` = `Version {{version}}`, `releaseNotes` = `Notes de version` |

### Intégration

| Page | Emplacement |
|---|---|
| `file:src/pages/AboutPage.tsx` | section Open Source, sous le bouton GitHub |
| `file:src/pages/AccountPage.tsx` | pied de page, sous la danger zone |

### Tests

| Fichier | Couverture |
|---|---|
| `file:src/components/ReleaseVersionLink.test.tsx` | version affichée depuis le fetch ; href/target/rel ; fallback quand `fetchReleaseVersion` renvoie `null` |
| `file:src/pages/AboutPage.test.tsx` | la ligne version + le lien releases sont présents |
| `file:src/pages/AccountPage.test.tsx` | idem |

## Out of Scope

- Route `/version` et hook (T264).
- Indicateur « nouvelle version disponible ».
- Rendu du changelog dans l'app.

## Acceptance Criteria

- [ ] About et Account affichent « Version X » et un lien vers `https://github.com/PierreTsia/workout-app/releases`.
- [ ] Le lien ouvre un nouvel onglet : `target="_blank"` + `rel="noopener noreferrer"`.
- [ ] Le texte provient des clés i18n (`common:releaseVersion`, `common:releaseNotes`), présentes EN et FR.
- [ ] Un échec du fetch affiche le fallback, sans erreur ni état vide.
- [ ] Tests colocalisés verts ; `npm test` et `npm run lint` verts.

## References

- Epic Brief `file:docs/Epic_Brief_—_App_Release_Version_#584.md`
- Tech Plan `file:docs/Tech_Plan_—_App_Release_Version_#584.md`
- T264 `file:docs/T264_—_MCP_version_route_+_fallback_+_hook.md`
