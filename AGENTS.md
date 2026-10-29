# workout-app (GymLogic) — instructions pour l'agent

GymLogic est un tracker d'entraînement MCP-native : PWA React 19 + Vite, Supabase
(Postgres + Edge Functions), et un serveur MCP — Edge Function
`supabase/functions/mcp`, JSON-RPC 2.0 écrit à la main, OAuth 2.1 ou PAT `glp_…` — qui
laisse un agent lire l'historique d'entraînement et créer un programme. Dépôt public.
Prod : `https://www.gymlogic.me` (Vercel, projet `prj_JiSPg0hrxu2IEEMrtvtjxCLp41qy`),
Supabase `favusepjqwpcroiolvaz`, Sentry org `oim` projet `gymlogic`.

[`README.md`](README.md) porte le comportement de référence (les six outils MCP, le flux
`dry_run`, les PAT, le setup des clients) et [`docs/CONTEXT.md`](docs/CONTEXT.md) le
vocabulaire du domaine : les lire avant de toucher `src/`, `supabase/functions/` ou un
outil MCP.

## Invariant : les données d'entraînement restent dans leur compte

Chaque utilisateur ne voit et ne touche que ses propres lignes : toute requête passe par
RLS, jamais par un service role qui contournerait le cloisonnement, et jamais de données
d'entraînement, d'identifiant ou d'email d'utilisateur dans un rapport, un test committé ou
un message. Côté agent : écriture **opt-in** — un outil qui écrit défaut à
`dry_run: true`, et rien n'écrit sans le consentement explicite de la personne. La prod
(Vercel, Supabase cloud, secrets) ne se touche pas depuis une session d'agent sans
autorisation explicite pour cette action précise. Un signal illisible est `indisponible`
et un **gap** — jamais un zéro.

## Conventions maison

Ces règles valent dans **tous** les dépôts de Pierre, pas seulement ici.

**AGENTS.md d'abord.** Chaque dépôt porte un `AGENTS.md` à sa racine, écrit pour qu'un
agent entre dans le dépôt en lisant ce seul fichier. Un dépôt sans `AGENTS.md` : la
première tâche commence par l'écrire (skill `agents-md-authoring`), et le fichier suit les
repères quand ils changent.

**DDD — le domaine avant le code.** Le vocabulaire vit dans `CONTEXT.md`, les décisions
structurantes dans `docs/adr/NNNN-slug.md` :

- Un terme est tranché → il entre dans `CONTEXT.md` dans la foulée, jamais à la fin.
- `CONTEXT.md` est un **glossaire et rien d'autre** : aucune implémentation, aucune spec.
- Le code, les issues, les tests et les commits nomment les concepts avec les mots du
  glossaire — aucun synonyme dérivé.
- Un ADR seulement si les trois tiennent : dur à inverser, surprenant sans contexte,
  arbitrage réel. Sinon l'ADR n'existe pas.
- Une décision qui contredit un ADR existant se dit (« contredit ADR 0003, mais… »),
  jamais en silence.
- Vocabulaire de conception : module profond, interface, seam, adapter (skill
  `codebase-design`). Un contexte délimité = `CONTEXT-MAP.md`, pas deux glossaires en vrac.

**TDD.** Le test qui échoue d'abord, puis le code. Un changement de contrat commence par
son test.

**Commit and push often — les commits _sont_ le journal.** Un commit par étape finie,
poussé tout de suite : le travail non poussé n'existe pas et n'est pas relu. Pas de
`JOURNAL.md`, pas de fichier d'état : le message de commit porte le journal — quoi,
pourquoi, ce qui a été vérifié (commande + résultat), ce qui reste. Commit en français,
Conventional Commits (`feat(#288): …`, `docs: …`), identité
`PierreTsia <PierreTsia@users.noreply.github.com>`.

## Flow produit & sous-agents

Chaîne produit, **dans l'ordre — aucune étape ne démarre avant que la précédente ait laissé son
artefact** :

`grilling` (ou `grill-with-docs` quand ça touche au domaine : `CONTEXT.md` et ADR) → `to-prd`
(PRD publié dans l'issue tracker, décisions d'implémentation et seams de test) → `to-issues`
(tranches verticales, une issue = une tranche livrable) → `implement` (boucle `tdd`, un commit
par tranche) → `review` (sous-agent `reviewer`) → QA (sous-agent `qa`).

Le grill est **HITL** (Pierre répond) ou **AFK** (l'agent tranche à la place de Pierre et nomme
ses hypothèses) ; hors codebase, `grill-me`. Deux verrous d'ordre : **pas de PRD, pas de
ticket** ; **pas de test rouge, pas de code**. Un bug saute `to-prd` et `to-issues` : l'issue
tient lieu de cadrage, plan court (cause + critère d'acceptation), puis `tdd` — **le test qui
reproduit le bug d'abord**.

**Piège de ce dépôt — deux générations de skills coexistent.** Les skills du flow sont
**globales** (hors du dépôt). Ce dépôt porte en plus `.opencode/skills/` avec l'**ancienne**
génération (`epic-brief`, `tech-plan`, `split-tickets`, `create-pr`, `deliver-tickets`) — et
comme **le repo-local prime sur le global**, `tdd` et `grill-with-docs` chargent ici la version
du dépôt et non la globale. Lire l'inventaire effectif avec `opencode debug skill` avant de
nommer une étape.

Sous-agents disponibles (`Task`, définis dans `.opencode/agents/`) :

- **`reviewer`** — relit une PR contre les standards du dépôt et le ticket lié, trie ses
  constats, pose les labels `review:*` et publie ses conclusions en **un seul commentaire** ;
  lecture seule pour tout le reste (jamais d'édition, de commit ni de review GitHub).
- **`qa`** — passe QA navigateur : monte l'app (Supabase local + Playwright, ou la prod),
  parcourt les flux dans un vrai navigateur, capture des captures d'écran et rend un rapport
  pass/fail avec preuves, plus un commentaire `## QA report`. Indépendant de `reviewer` — les
  deux tournent en parallèle sur la même PR.

## TDD dans ce dépôt

`npm test` = `TZ=UTC vitest run` (le TZ est volontaire : le domaine est sensible aux
fuseaux). Trois familles, toutes colocalisées à côté du code :

- `*.test.ts(x)` — unitaire et composant ;
- `*.arch.test.ts` — **tests d'architecture** : ils lisent les migrations SQL et les
  policies et vérifient les invariants (security definer, grants, RPC de lecture). Les
  lire avant de toucher `supabase/` : c'est là que le cloisonnement est prouvé ;
- `e2e/` via Playwright (`npm run test:e2e`).

Cycle rouge → vert → refactor. `npm run lint` avant de pousser.

## Repères non déductibles du code

- Un outil MCP est une **interface publique** : son nom, ses paramètres et la forme de sa
  réponse sont un contrat pour des agents tiers (Claude, Cursor, Le Chat). Le changer casse
  des clients : ADR + test, pas un renommage discret.
- [`skills/gymlogic-mcp/SKILL.md`](skills/gymlogic-mcp/SKILL.md) est le contexte qu'un agent
  tiers charge : il fait partie du produit et se met à jour avec les outils.
- Le glossaire vit dans `docs/CONTEXT.md` et les ADR dans `docs/adr/` (0001..0023) : les
  chemins sont sous `docs/`, pas à la racine.
- `docs/done/` est l'archive des briefs et tech plans terminés, `docs/references/` les
  textes de référence (comparaisons produit), `docs/mcp-connect/` les guides de connexion
  par client : archives et guides, pas source de vérité du comportement.
- Le vocabulaire de labels est riche et fait foi : `type:*` (feature/fix/infra),
  `priority:*` (0..3, low/medium/high), `needs-grilling`, `routing:*` (posés par le routeur
  de PR), `review:*`, `epic`. Les issues sont en français.
- `public/`, `node_modules/`, `.env*` et les exports de données brutes
  (`*-export-*.csv`, `delete_candidates.csv`) ne sont jamais committés.
- `npm run lint` porte les **règles maison** (`eslint.config.js`) : zéro littéral JSX (i18n),
  Nomos/`@nomosui/react` par sa seule surface publique, Radix confiné à `src/components/ui/**`,
  pas de primitive vendorée dans les surfaces migrées (`admin/`, `mcp-views/`), couleurs par
  tokens, et frontières de couches (`lib/store/types/data` sans UI ni hooks, pas de `pages`
  depuis `hooks`/`components`, `mcp-views` autonome, un seul client Supabase). Exemptions
  commentées dans le fichier.

## Release

Versioning is owned by ADR [`docs/adr/0025-release-mechanism.md`](docs/adr/0025-release-mechanism.md): **one version** for the repo (tag = `package.json` = `SERVER_INFO.version`), via **release-please**, with the production deploy gated on the release.

- **Merging to `main` deploys nothing — except the docs site.** `docs`/`chore`/`ci`/`deps` PRs never cut a release; the one artefact that ships on merge is the `web/` docs mini-site (ADR 0028).
- **Cutting a release = merging the standing `chore(release): vX.Y.Z` PR** (on GitHub, or by an agent with `gh pr merge`): release-please creates the tag + GitHub Release + `CHANGELOG.md`, and bumps `package.json` and `SERVER_INFO.version`.
- The release triggers [`.github/workflows/release-deploy.yml`](.github/workflows/release-deploy.yml), which deploys **only what changed since the previous tag**: the SPA (`src/`…) and the changed Edge Functions (`supabase/functions/**`, via `SUPABASE_ACCESS_TOKEN`). The Cloudflare MCP proxy stays manual. The docs site is deliberately not on this path: it deploys from the pushed commit, on merge, via [`.github/workflows/deploy-web.yml`](.github/workflows/deploy-web.yml).
- **Setup (one-time):** the repo must allow GitHub Actions to create PRs (Settings → Actions → General → *Allow GitHub Actions to create and approve pull requests*), and a `RELEASE_PLEASE_TOKEN` secret (fine-grained PAT, *Contents* + *Pull requests: write*) lets the release PR **run CI** — a PR opened with the default `GITHUB_TOKEN` suppresses its own `pull_request` workflows and stays blocked on the required checks.
- **Migrations: never the SQL editor, always `supabase db push`.** A schema migration applied by hand leaves the prod history out of sync with `supabase/migrations/` (incident of 21/10: five migrations applied through the dashboard under other timestamps, and a raw `db push` would have replayed destructive backfills). Before any push, run `supabase db push --dry-run --include-all` and **read the list**. `--include-all` is **permanent** since that incident — local versions insert *before* the last remote one — not a temporary workaround. `npm run db:drift` is the preflight that checks no migration entered the database outside the repo (exit 1 on drift; repo-only versions are normal and only reported). It **requires an explicit `SUPABASE_DB_URL`** and must target the **same database as the push** (the linked project) — there is no localhost fallback, so a clean local stack cannot report OK while the real target drifts. A local check is still possible by passing the local URL explicitly.

## Agent skills

### Issue tracker

Issues et specs vivent dans les GitHub Issues du dépôt, via le CLI `gh`. Voir
`docs/agents/issue-tracker.md`.

### Triage labels

Cinq rôles canoniques (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`,
`wontfix`) ; le dépôt porte déjà `type:*`, `priority:*`, `needs-grilling`, `routing:*`,
`review:*`. Voir `docs/agents/triage-labels.md`.

### Domain docs

Single-context : `docs/CONTEXT.md` + `docs/adr/`. Voir `docs/agents/domain.md`.
