# T703 — ADR 0032, ancre de progression

## Goal

Enregistrer la décision : l'ancre d'un déload intra-séance vit dans sa propre colonne
(`set_logs.anchor_reps`), jamais dans le Prescription Snapshot. Couvre les stories 8 et 9 de l'Epic
Brief.

## Mode

AFK — la décision est déjà tranchée (Tech Plan, décision « Persistance ») ; il reste à la rédiger.

## Slice

`docs/adr/0032-…md` + ligne d'index

## Dependencies

None

## Scope

### ADR

- `docs/adr/0032-progression-anchor-reps.md`, format des ADR existants : `Status` / `Date` / `Decided
  in` / `Context` / `Decision` / `Consequences` / `Alternatives considered`.
- `Decided in: epic #705` ; `Relates to` : ADR `0006-decouple-template-from-progression-engine.md`,
  ADR 0012, ADR 0026.
- Alternatives à lister : écraser `prescribed_*` ; writeback du template en fin de séance
  (ADR 0006 / #373) ; lire le réel brut (ratchet sur un miss) ; table `(session, slot)` dédiée ;
  ancre sur le premier set seulement.

### Index

- Ajouter la ligne dans `docs/adr/README.md` (même changement).

## Out of Scope

- Toute implémentation (T704 / T705).
- L'axe durée.

## Acceptance Criteria

- [x] L'ADR suit le format des ADR existants et porte le numéro 0032.
- [x] Le Context cite les trois faits : observatoire de déviations, règle unique de `CONTEXT.md`,
      précédent #381 de l'axe poids.
- [x] Les alternatives sont listées avec leur raison de rejet (six, dont le stamp sur le row).
- [x] La ligne d'index est ajoutée dans le même changement.

## References

- Epic Brief `docs/Epic_Brief_—_Fermeture_de_la_boucle_de_progression_#705.md` (stories 8, 9)
- Tech Plan `docs/Tech_Plan_—_Fermeture_de_la_boucle_de_progression_#705.md` §Key Decisions
- ADR `0006-decouple-template-from-progression-engine.md`, `0012-slot-scoped-last-performance.md`,
  `0026-deviation-storage.md`
