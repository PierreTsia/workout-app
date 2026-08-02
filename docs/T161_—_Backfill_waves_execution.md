# T161 — Backfill waves execution

## Goal

Exécuter la traduction sur le catalogue réel, en vagues, et amener l'exposition relue par un humain au-dessus du seuil de l'epic. C'est le seul ticket qui produit de la donnée en production, et le seul qui peut faire échouer le critère numérique.

L'ordre des vagues est un garde-fou, pas une préférence : le spike n'a mesuré que **30 lignes sur 372**. Le taux réel de signalement au-delà de l'échantillon est inconnu, et la longue traîne des exercices que personne n'a jamais logués est l'endroit où le mesurer sans rien risquer.

Sert le critère agrégé de l'epic : ≥ 76 % de l'exposition réelle servie par des consignes anglaises relues par un humain.

## Mode

**HITL** — et pas parce qu'une décision manque. Le jugement exige les données en main : regarder le taux de signalement sur 231 lignes réelles, décider si Gemini Flash tient hors échantillon, puis relire à la main 60 exercices de coaching. Rien de tout cela ne se ramène à une acceptation mécanique.

## Slice

migration en production → vague longue traîne → mesure → décision → vague top 60 → relecture humaine → clôture

## Dependencies

T157 (le script) et T159 (les actions de relecture). T160 rend la relecture nettement plus rapide et devrait être livré avant la vague du top 60, sans la bloquer.

## Scope

### Préalable

La migration de T156 doit être **appliquée en production avant** que le script ne tourne contre elle — le précédent de T152 dans l'epic #415 a établi cet ordre.

### Vague 1 — longue traîne

Les **231 exercices que personne n'a jamais logués**, via `--unlogged`. Dry-run d'abord, puis `--apply`.

C'est la vague de mesure. Elle produit trois chiffres qui n'existent pas encore : le taux de lignes `flagged`, la nature dominante des objections, et le coût réel en temps et en jetons. Sur des exercices que personne ne consulte, une erreur qui passe ne blesse personne.

### Point de décision

Le taux de signalement est comparé aux 1/30 du spike. S'il s'effondre — disons au-delà de 20 % — on ne poursuit pas : on corrige le prompt, ou on change de traducteur, **avant** de toucher aux exercices qui comptent. La décision et ses chiffres sont consignés en commentaire sur l'issue de l'epic.

### Vague 2 — top 60

Les 60 exercices les plus logués, via `--top 60`. Ils portent **76,7 %** des séries enregistrées, contre 61,8 % pour les 40 premiers et 41,1 % pour les 20 premiers. C'est là que la relecture humaine a un rendement réel.

### Relecture

Passes de relecture dans `/admin/translations`, les `flagged` d'abord puis les `clean` par exposition décroissante, avec l'assistant de T160 pour les cas difficiles. Résumable par tranches : c'est la raison pour laquelle la décision est horodatée.

### Reste du catalogue

Le solde des lignes loguées est traduit par vagues, sans exigence de relecture exhaustive. La couverture partielle est un **état supporté** de l'epic, pas un incident.

## Out of Scope

- Toute modification du script ou de l'UI. Si une correction s'avère nécessaire, elle repart en ticket : ce ticket exécute, il ne code pas.
- La correction du français source, même quand la contre-relecture le débusque.
- La relecture humaine exhaustive des 372 lignes.
- Les templates de programme ([#58](https://github.com/PierreTsia/workout-app/issues/58)), même si le pipeline s'y appliquerait.

## Acceptance Criteria

- [ ] La migration de T156 est appliquée en production avant la première exécution avec `--apply`.
- [ ] Vague 1 exécutée sur les 231 exercices jamais logués.
- [ ] Le taux de signalement réel, la nature dominante des objections et le coût effectif sont **mesurés et consignés** sur l'issue de l'epic.
- [ ] La décision de poursuivre ou de corriger le prompt est tracée, avec ses chiffres.
- [ ] Vague 2 exécutée sur le top 60 par séries loguées.
- [ ] Aucune ligne `flagged` non relue ne s'affiche en anglais dans l'app — vérifié par échantillonnage.
- [ ] Le ticket se clôt sur une mesure et une décision tracées ; si le seuil de 76 % n'est pas atteint, le pourcentage réel est rapporté et l'epic reste ouvert. La couverture partielle est un état supporté, pas un échec.

## References

- Epic Brief : `docs/Epic_Brief_—_English_Exercise_Instructions_#417.md`, § Success Criteria
- Tech Plan : `docs/Tech_Plan_—_English_Exercise_Instructions_#417.md`, § Key Decisions (ordre des vagues)
- Issue [#417](https://github.com/PierreTsia/workout-app/issues/417)
- Précédent d'ordre migration/production : T152 dans [#422](https://github.com/PierreTsia/workout-app/issues/422)
