# T264 — MCP `/version` route + build-time fallback + runtime hook (AFK)

**Mode:** AFK · **Slice:** `supabase/functions/mcp/index.ts → vite.config.ts → src/lib/releaseVersion.ts → src/hooks/useReleaseVersion.ts`

## Goal

Rendre `SERVER_INFO.version` lisible par la SPA sans redéployer la PWA : exposer une route `GET /version` additive sur la fonction MCP, baker `package.json.version` au build comme fallback, et fournir un hook qui lit la route au runtime et retombe sur le fallback en cas d'échec. Aucune UI dans ce ticket.

## Dependencies

- ADR `file:docs/adr/0025-release-mechanism.md` (amendement #584).
- Route servie par la fonction MCP déployée (release-deploy `supabase/functions/**`).

## Scope

### Edge — route version

| Item | Detail |
|---|---|
| Fichier | `file:supabase/functions/mcp/index.ts` |
| Emplacement | handler `GET`, avant `handleWellKnown` |
| Comportement | si `new URL(req.url).pathname.endsWith("/version")` → `json({ version: SERVER_INFO.version })` |
| Garde | méthode non-GET → 405 existant inchangé ; aucun outil MCP modifié |

### Build — fallback

| Item | Detail |
|---|---|
| Fichier | `file:vite.config.ts` |
| Comportement | lire `package.json.version` (`node:fs`) et l'injecter via `define.__RELEASE_VERSION__ = JSON.stringify(...)` |
| Invariant | `__APP_VERSION__` inchangé (reste le cache-busting) |

### SPA — lib + hook

| Item | Detail |
|---|---|
| `file:src/lib/releaseVersion.ts` | `GITHUB_RELEASES_URL` ; `BUILD_RELEASE_VERSION` (garde `typeof __RELEASE_VERSION__`, patron `errorReport.ts:54`) ; `fetchReleaseVersion(): Promise<string \| null>` fail-soft |
| `file:src/hooks/useReleaseVersion.ts` | `useQuery` (`queryKey: ["release-version"]`, `retry: 0`, `staleTime: 1h`, `gcTime: Infinity`, `refetchOnWindowFocus: false`) → `data ?? BUILD_RELEASE_VERSION` |
| `file:src/lib/releaseVersion.test.ts` | ok / non-2xx / throw / URL absente / version non-string |

## Out of Scope

- Toute UI (T265).
- Cache persistant ou invalidation sur release.
- Modifier `SERVER_INFO.version` lui-même.

## Acceptance Criteria

- [ ] `GET …/functions/v1/mcp/version` renvoie `{ "version": "<SERVER_INFO.version>" }` (testé contre le handler ou équivalent).
- [ ] Un `GET` sur un autre chemin garde le comportement 405 actuel.
- [ ] `__RELEASE_VERSION__` est injecté au build depuis `package.json.version`.
- [ ] `fetchReleaseVersion` renvoie la version sur 2xx, `null` sur non-2xx / throw / URL absente / champ invalide.
- [ ] `useReleaseVersion` renvoie la valeur fetchée, sinon `BUILD_RELEASE_VERSION`.
- [ ] `npm test` et `npm run lint` verts.

## References

- Epic Brief `file:docs/Epic_Brief_—_App_Release_Version_#584.md`
- Tech Plan `file:docs/Tech_Plan_—_App_Release_Version_#584.md`
- ADR `file:docs/adr/0025-release-mechanism.md`
