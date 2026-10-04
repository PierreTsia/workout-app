# T290 — ADR : intention de vue + consentement par token (amendements 0023 / 0027) + glossaire

## Goal

Trancher et documenter le contrat de la surface agentique « de show à act » (epic [#643](https://github.com/PierreTsia/workout-app/issues/643)) : une vue émet une **intention**, l'hôte arbitre, l'apply passe par un **token signé serveur** ; le clic humain est le consentement. Amender explicitement ADR 0027 §3 et ADR 0023 / le terme **Write Consent**, et entrer les termes nouveaux dans `docs/CONTEXT.md`. **Prérequis** de tous les autres tickets.

## Mode

AFK — décisions déjà verrouillées au grill + revue autopilot ; rédaction et glossaire mécaniques.

## Slice

docs (ADR nouveau → amendement 0027 → amendement 0023 → `CONTEXT.md`).

## Dependencies

None.

## Scope

### ADR nouveau — `docs/adr/0028-view-intention-and-consent-token.md`

- **Contexte** : #591 a livré une vue read-only ; #643 ouvre l'action ; `visibility:["app"]` est host-enforced (SEP-1865), pas server-enforced.
- **Décision** : une vue n'écrit jamais *directement* ; elle demande à l'hôte d'appeler un outil (`tools/call`). L'apply (`apply_program_patch`) exige un `preview_token` **HMAC signé serveur**, émis par le `dry_run` d'`update_program` dans `structuredContent` (hors contexte modèle). Le token porte le patch exact → « ce qui a été montré est ce qui s'applique ».
- **Deux voies de consentement** (amende **Write Consent**, ADR 0023) : (a) écho de payload + Noul **Jev** (chemin modèle classique) ; (b) **clic de vue + token signé** (chemin carte). Le token n'est pas un « second concept » interdit : c'est la preuve matérielle du clic.
- **Alternatives rejetées** : reliance à la seule `visibility` de l'hôte (échec non conforme) ; `ui/message` + rejeu par le modèle (drift) ; propose-only global (casse Cursor/Le Chat).
- **Conséquences** : enforcement du chemin carte ; `update_program{dry_run:false}` **conservé** (pas de propose-only v1) → #287 reste une piste séparée, nommée.

### Amendement ADR 0027 §3

`file:docs/adr/0027-agentic-view-contract.md` : remplacer « A view never writes » par « A view never writes *directly* ; it asks the host to call a tool (`tools/call`); the user's click is the consent, materialised by a server-signed token. »

### `docs/CONTEXT.md`

- **MCP App View** : retirer « emits intentions, never writes » → « emits intentions, never writes *directly* ».
- **Write Consent** : ajouter la voie (b) clic + token.
- Ajouter **Carte de décision** (decision card) et **Outil app-only** (app-only tool) ; pointer l'ADR 0028.

## Out of Scope

- Tout code. Le token, l'outil et la vue → T291/T292.
- Généraliser le propose-only à `create_program` / `create_workout_day` (#287, hors epic).

## Acceptance Criteria

- [ ] `docs/adr/0028-view-intention-and-consent-token.md` existe, avec Contexte / Décision / Conséquences / Alternatives.
- [ ] ADR 0027 §3 est explicitement amendé (le mot « directly » + `tools/call`).
- [ ] ADR 0023 / **Write Consent** référence la voie (b) sans laisser croire que le token est interdit.
- [ ] `docs/CONTEXT.md` : **MCP App View** corrigé, **Carte de décision** + **Outil app-only** ajoutés, badge `→ file:` posé.
- [ ] Un lecteur qui suit l'ADR comprend pourquoi le token est une garde **serveur** et pas un confort.

## References

- Epic [#643](https://github.com/PierreTsia/workout-app/issues/643) · revue [commentaire](https://github.com/PierreTsia/workout-app/issues/643#issuecomment-5981399156)
- Tech Plan `file:docs/Tech_Plan_—_Agentic_components_show_act_#643.md` (Key Decisions, Critical Constraints)
- ADR `file:docs/adr/0027-agentic-view-contract.md` · `file:docs/adr/0023-jev-verdicts-only-embedded-agent.md` · SEP-1865
