# T273 — Retirement des doublons admin + vérification globale

## Goal

Clore la phase 1 : supprimer tout doublon admin restant, finaliser l'adaptation des `columns.tsx`/`features.ts`, vérifier que la suite complète est verte, contrôler le bundle (double `lucide-react`), et faire la passe @qa complète des 7 pages contre la baseline. Aucune primitive partagée `src/components/ui/*` n'est retirée (elle sert toute l'app).

## Mode

`AFK`.

## Slice

`cleanup fichiers admin → colonnes/features → suite complète + @qa 7 pages + bundle`

## Dependencies

- T269, T270, T271, T272.

## Scope

### Suppression / nettoyage

- Vérifier qu'aucune référence ne subsiste aux fichiers supprimés (`exercises-table/DataTable*`, `feedback-table/DataTable*`).
- Supprimer les helpers/imports morts (`cn` inutilisés, `features.ts` orphelins, `Toast`/`Skeleton` vendorés devenus inutiles côté admin).
- Ne **pas** supprimer `src/components/ui/*` : vérifier par recherche que chaque primitive encore partagée hors admin est conservée.

### Colonnes / features

- Finaliser l'adaptation des `columns.tsx`/`features.ts` restants aux types/TanStack du cœur ; sinon documenter la raison du maintien.

### i18n

- Vérifier la parité EN/FR des clés admin ajoutées en T269–T272 (`file:src/locales/locales.test.ts` doit rester vert).

### Checks

- `npm test`, `npm run lint`, `npm run build`.
- Contrôle bundle : pas de double `lucide-react` problématique (tailles `build:analyze`).
- **Passe @qa complète** des 7 pages (desktop light/dark + mobile), états manquants seedés (translations `instructions_en`+`flagged`, quelques `exercise_content_feedback`, un exercice avec image), au moins une capture FR.

## Out of Scope

- Phase 2 / surface agentique (#591).
- Dédoublonnage du `@theme` GL (ticket post-phase-1).
- Bump agent-os.

## Acceptance Criteria

- [ ] Aucun fichier admin dupliqué supprimé n'est encore référencé (recherche vide).
- [ ] Aucune primitive `src/components/ui/*` encore utilisée hors admin n'a été supprimée.
- [ ] `npm test`, `npm run lint`, `npm run build` passent.
- [ ] `locales.test.ts` vert (parité EN/FR).
- [ ] Passe @qa complète des 7 pages : diff baseline↔post documenté par paire page/état/thème ; tout écart visuel inattendu est signalé comme bug.
- [ ] Bundle : pas de régression de taille anormale liée à un doublon de dépendance.

## References

- Tech Plan : § Deleted files, § Stress-Test List.
- Epic : GitHub #583. Tickets liés : T269–T272 (deps).
