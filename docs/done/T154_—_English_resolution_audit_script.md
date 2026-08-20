# T154 — English resolution audit script (v1.5 gate)

## Goal

La v1.5 — ajouter un paramètre `locale` aux RPC `search_exercises` / `resolve_exercises_batch` et corriger leur biais français — est **conditionnée à une mesure**. On soupçonne qu'un agent anglophone résout mal les exercices parce que la RPC classe et trie sur `e.name` (français), mais aucun log ne le prouve : on ne sait pas si le problème est réel ni quelle est son ampleur.

Ce ticket produit le chiffre qui décide. Si la résolution anglaise est déjà bonne, **la v1.5 est annulée** et l'epic s'arrête à la v1.

## Mode

**AFK** — script d'audit, aucune surface produit.

## Slice

script one-shot → rapport chiffré → décision go/no-go

## Dependencies

Aucune. À lancer une fois la v1 en production, avec du trafic réel.

## Scope

### Script

- Script one-shot dans `scripts/`, dans la lignée de `file:scripts/audit-muscle-tags.ts`. **Ne pas instrumenter le code de production** : on cherche un ordre de grandeur, pas un tableau de bord.
- Rejoue un corpus de requêtes anglaises réalistes (noms d'exercices courants en anglais) contre `search_exercises` et `resolve_exercises_batch`, et mesure le taux de résolution correcte ainsi que le rang de la bonne réponse.
- Constituer le corpus à partir de noms `name_en` réels de la base plutôt que d'une liste inventée — sinon on mesure sa propre imagination.

### Rapport

- Taux de résolution EN vs FR sur corpus équivalent, et distribution du rang de la bonne réponse.
- Une recommandation explicite : **go** ou **no-go** sur la v1.5, avec le seuil qui la motive.

### Décision

- Consigner le résultat dans l'issue epic [#422](https://github.com/PierreTsia/workout-app/issues/422). Si **no-go**, fermer la v1.5 en le disant.

## Out of Scope

- Implémenter le paramètre `locale` sur les RPC — c'est précisément ce que ce ticket sert à décider.
- Instrumenter la production.

## Acceptance Criteria

- [ ] Le script tourne contre la base et produit un rapport chiffré.
- [ ] Le corpus est dérivé de `name_en` réels, pas inventé.
- [ ] Le rapport compare explicitement EN et FR.
- [ ] Une recommandation go/no-go est consignée dans #422.
- [ ] Aucun code de production modifié.

## References

- Epic Brief : § Scope (v1.5), stories 17 (ranking bibliothèque) et 18 (résolution agent MCP)
- Tech Plan : § Key Decisions (MCP)
- `file:supabase/migrations/20260326120000_search_exercises.sql` (biais de ranking)
- Précédent de script : `file:scripts/audit-muscle-tags.ts`
