# Epic Brief — App Release Version

## Summary

Rendre visible dans la SPA la **version de release unique** du dépôt, avec un lien vers ses notes. La version n'est **pas bakée** dans le bundle : elle est lue au **runtime** depuis `SERVER_INFO.version` exposé par la fonction MCP déployée — le même numéro que lisent les agents externes — avec la valeur `package.json` du build comme **fallback hors-ligne**. Une release backend-only met donc le numéro à jour sans redéployer la PWA, et « une seule version » (ADR [`docs/adr/0025-release-mechanism.md`](adr/0025-release-mechanism.md)) reste vrai côté navigateur.

---

## Context & Problem

**Who is affected:** l'utilisateur de la SPA (savoir quelle release tourne, atteindre les notes), le mainteneur en debug (mapper un rapport/bug à un tag), et — par cohérence — les **External MCP Client** qui lisent déjà `SERVER_INFO.version`.

**Current state:**
- `__APP_VERSION__` (`file:vite.config.ts:99`) est un **timestamp de build** (`Date.now().toString(36)`), utilisé uniquement pour le cache-busting localStorage (`file:src/lib/versionManager.ts`) — ce n'est **pas** un numéro de release.
- Aucune version n'est affichée : `file:src/pages/AboutPage.tsx` et `file:src/pages/AccountPage.tsx` n'en montrent aucune ; aucun lien vers les releases.
- La source unique existe déjà : `SERVER_INFO.version` (`file:supabase/functions/mcp/index.ts:22`), réécrite par release-please à **chaque** release (`extra-files`, `file:release-please-config.json`) → la fonction MCP est **toujours redéployée** (diff `supabase/functions/**` dans `file:.github/workflows/release-deploy.yml`), donc en prod `SERVER_INFO.version` == tag courant.
- Le déploiement SPA est path-gated et **exclut `package.json`** (ADR 0025 §7) : une release backend-only ne redéploie pas la SPA → toute valeur bakée resterait périmée.

**Pain points:**

| Pain | Impact |
|---|---|
| Aucune version visible | L'utilisateur ignore quelle release tourne ; impossible de pointer un changelog |
| `__APP_VERSION__` n'est pas un numéro de release | Ne peut pas servir de version affichable (timestamp de build) |
| Déploiement SPA path-gated (ADR §7) | Une version bakée ment sur une release backend-only |
| Notes de release seulement sur GitHub | Pas de chemin depuis l'app |

---

## User Stories

1. As a **user**, I want to see the app's release version, so that I know which release I'm running.
2. As a **user**, I want a link to the release notes, so that I can see what changed without hunting.
3. As a **maintainer debugging a report**, I want the displayed version to equal the deployed release, so that I can map the report to a tag.
4. As a **user on a flaky/offline network**, I want the version area to still render (build-time fallback), so that the page never breaks or empties.
5. As a **user**, I want the version on both About and Account, so that I find it wherever I look.
6. As a **keyboard/screen-reader user**, I want the releases link to be labeled and announce opening in a new tab, so that it's usable non-visually.
7. As a **maintainer**, I want a backend-only release to update the displayed number with no SPA redeploy, so that ADR 0025 §7 (no PWA cache churn) stays intact.
8. As a **maintainer**, I want the displayed number to be `SERVER_INFO.version` (not a second counter), so that "one version" holds.
9. As a **maintainer**, I want the version read to fail soft (fallback, no error toast), so that a version-endpoint blip is invisible.
10. As a **maintainer**, I want a colocated test proving version + link wiring, so that a regression is caught.

### Success measures

| Story # | Measure |
|---|---|
| 3, 7, 8 | Online, displayed number == git tag == `package.json` == `SERVER_INFO.version` |
| 5 | Version present on both `/about` and `/account` |
| 7 | A release with no `src/` change updates the displayed number without a Vercel SPA deploy |
| 4 | With the endpoint unreachable, the fallback renders; no thrown error |

---

## Scope

**In scope:**
1. Route `GET …/functions/v1/mcp/version` → `{ "version": "<tag>" }`, publique (`verify_jwt=false` déjà), **additive** — aucun outil MCP modifié.
2. `__RELEASE_VERSION__` (build-time) = `package.json.version` via `file:vite.config.ts`.
3. Lecture runtime (`fetchReleaseVersion` + `useReleaseVersion`) : lit la route, fallback `__RELEASE_VERSION__` ; cache court, retry nul.
4. UI partagée (`ReleaseVersionLink`) : `AboutPage` (section Open Source) + `AccountPage` (pied de page) — texte version + lien `…/releases` (`target="_blank"`, `rel="noopener noreferrer"`, libellé accessible).
5. i18n EN + FR.
6. Tests colocalisés (`releaseVersion`, `ReleaseVersionLink`, `AboutPage.test.tsx`, `AccountPage.test.tsx`).

**Out of scope:**
- Indicateur « nouvelle version disponible / mettre à jour ».
- Rendu du changelog **dans** l'app (on pointe vers GitHub Releases).
- Versionner `web/` (mini-site) ou le proxy Cloudflare.
- Authentification de la route version.
- Détourner `__APP_VERSION__` (reste le cache-busting).
- Canaux pre-release.

---

## Success Criteria

- **Numeric:** en ligne, le numéro affiché est identique à `SERVER_INFO.version` ; une release backend-only le met à jour sans deploy SPA.
- **Numeric:** la version est visible sur `/about` et `/account`, avec un lien releases ouvrant un nouvel onglet `rel="noopener noreferrer"`.
- **Qualitative:** aucun nouveau compteur de version ; aucun cookie/donnée d'entraînement touché ; `npm test` et `npm run lint` verts.
