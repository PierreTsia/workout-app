# T286 — Locale `en|fr` : noms localisés + libellés

## Goal

Rendre la carte **identique à l'app** en **EN** et **FR** : les noms d'exercices/Circuits sont localisés via le catalogue, et les libellés de la carte réutilisent les clés app existantes. Couvre la story 8 de l'Epic Brief.

## Mode

**AFK** — la résolution de locale suit le pattern existant du **Program draft step** ; aucune décision produit restante (0 clé nouvelle).

## Slice

`renderSessionCard.ts` (arg `locale`) → `lib/sessionCard.ts` (jointure `exercises` `name_en`/`name`) → `src/mcp-views/session-card/labels.ts` (EN/FR importés de `src/locales`) → `SessionCard.tsx` (sélection par `locale`).

## Dependencies

**T285** (projection + pont en place).

## Scope

### Outil

- `inputSchema` : `locale?: { type:'string', enum:['en','fr'] }`.
- Résolution : arg → `user_profiles.locale` → `en`. Le payload porte `locale`.

### Projection

- Joindre `exercises` et choisir `name_en` (EN) / `name` (FR) ; repli sur `exercise_name_snapshot` si la ligne catalogue manque.
- Les chaînes dynamiques (durée, date relative, tonnage) sont pré-formatées selon `locale`.

### Libellés de la vue

- `labels.ts` importe les clés **existantes** de `src/locales/{en,fr}` et exporte `{ en: {...}, fr: {...} }` ; le composant sélectionne par `payload.locale`.
- **0 clé nouvelle.** Table de réutilisation (Tech Plan § i18n contract) : `workout:recap.tabLastSession`, `profile:tonnage.title`, `history:sets`, `history:pr`, `history:circuit.fallbackLabel`, `history:circuit.completionTime`, `history:circuit.rounds_one/_other`, `workout:blockRunner.amrapScoreGloss`, `history:noSessions` / `noSessionsHint`.
- Chemins exacts confirmés avec la skill `microcopy` ; toute clé manquante est ajoutée en **EN et FR** (parité `file:src/locales/locales.test.ts`).

### Tests

- Résolution de locale (arg / profil / repli).
- Noms EN vs FR depuis le catalogue.
- Libellés EN/FR présents ; aucune clé orpheline.

## Out of Scope

- `SKILL.md` → **T287**.
- QA dans un vrai hôte → **T288**.
- Toute nouvelle copy produit (si une clé manque, elle est ajoutée à l'identique des valeurs app existantes, pas inventée).

## Acceptance Criteria

- [ ] `render_session_card` accepte `locale` ; défaut = `user_profiles.locale`, repli `en`.
- [ ] Les noms d'exercices et de Circuits sont localisés via le catalogue (pas le snapshot FR seul).
- [ ] Les libellés de la carte sont EN **et** FR, issues de clés **existantes** ; **0** clé nouvelle.
- [ ] `file:src/locales/locales.test.ts` vert (parité, pas de clé orpheline).
- [ ] Rendu FR et EN vérifiés (noms + libellés + nombres/dates).

## References

- Epic Brief `file:docs/Epic_Brief_—_Surface_agentique_Nomos_#591.md` (story 8)
- Tech Plan `file:docs/Tech_Plan_—_Surface_agentique_Nomos_#591.md` (§ i18n contract)
- ADR `file:docs/adr/0027-agentic-view-contract.md`
- `file:docs/CONTEXT.md` (**Display Locale**), `file:src/lib/i18n.ts`, `file:src/locales/`
