# Issue tracker — workout-app (GymLogic)

Le tracker est **GitHub Issues** sur `PierreTsia/workout-app` (dépôt public), via le CLI
`gh` :

- `gh issue view <n> -R PierreTsia/workout-app`, `gh issue list -R PierreTsia/workout-app --label type:feature`.

Règles du dépôt :

- Les issues sont **en français**, avec des critères d'acceptation cochables.
- Vocabulaire de labels en place : `epic`, `type:*` (feature/fix/infra), `priority:*`
  (0..3, low/medium/high), `needs-grilling`, `review:*`, et la famille `routing:*` posée par
  le routeur de PR (`routing:needs-author`, `routing:hitl`) — cette dernière n'est **pas**
  posée à la main.
- `to-spec` publie la spec, `to-tickets` découpe, `triage` route, `implement` travaille une
  issue à la fois.
- Les issues restent la surface de demande : **les pull requests ne sont pas** un canal de
  demande entrant (`PRs as a request surface` = `no`).
