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
