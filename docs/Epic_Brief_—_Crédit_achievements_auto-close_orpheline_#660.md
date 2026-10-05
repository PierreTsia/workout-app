# Epic Brief — Crédit achievements à l'auto-close d'une orpheline (#660)

## Summary

Quand une **Session** orpheline est refermée automatiquement (self-heal à l'ouverture de l'app) ou par l'action « Terminer » du prompt, ses `set_logs` récupérés ne comptent aujourd'hui dans aucune track de succès, car le close n'appelle pas `check_and_grant_achievements` (ADR 0024 §4). Cet epic rend le crédit **automatique et idempotent** sur ces deux chemins, sans ré-enfiler de `session_finish` ni reconstruire `was_pr`. La dette cesse d'être récurrente : plus besoin d'un runbook manuel après chaque sweep d'orphelines.

---

## Context & Problem

**Who is affected:** tout athlète dont une séance est fermée par le self-heal au lieu d'un vrai « Terminer » (app fermée avant la fin), et l'équipe qui doit ré-créditer à la main.

**Current state:**
- `useOrphanSessionClose` ferme via `closeOpenSession(…)` sur deux chemins : auto-close des orphelines périmées (> 3 h) et `finish` du prompt. Ni l'un ni l'autre n'appelle `check_and_grant_achievements`.
- Le chemin normal (`processSessionFinish`) appelle l'RPC puis pousse les unlocks dans l'overlay.
- Le re-grant a déjà été fait à la main deux fois : #569/#572 (5 orphelins #568) et le sweep #654 (PR #659) — dont une orpheline `adfd615f` restée non créditée.

**Pain points:**
| Pain | Impact |
|---|---|
| Un close orphelin ne crédite rien | Les séries récupérées ne comptent dans aucune track |
| Dette récurrente | Chaque sweep exige un runbook manuel (script service-role) |
| Incohérence visible | Profil/achievements faux pour l'utilisateur concerné |

---

## User Stories

1. As a `<athlète>`, I want `<qu'une séance fermée automatiquement crédite mes succès>`, so that `<mes séries récupérées comptent comme un vrai entraînement>`.
2. As an `<athlète>`, I want `<que l'action « Terminer » du prompt d'orpheline crédite mes succès>`, so that `<les deux chemins de fermeture donnent le même résultat>`.
3. As an `<athlète>`, I want `<ne pas être re-crédité deux fois si la séance est déjà comptée>`, so that `<mes tiers restent stables>`.
4. As an `<athlète>`, I want `<voir la cérémonie de déblocage quand un badge est gagné à l'auto-close>`, so that `<je sais ce que j'ai gagné>`.
5. As a `<mainteneur>`, I want `<qu'une erreur du crédit ne casse pas la fermeture de la séance>`, so that `<le self-heal reste best-effort>`.
6. As a `<mainteneur>`, I want `<que les invariants ADR 0024 soient conservés>`, so that `<le close n'enfile pas de `session_finish` et ne réécrit pas `was_pr`>`.
7. As a `<mainteneur>`, I want `<un seul appel RPC par fermeture, pas par ligne>`, so that `<plusieurs orphelines fermées en un boot ne coûtent qu'un crédit>`.

### Success measures

| Story # | Measure |
|---|---|
| 1,2 | Après fermeture d'une orpheline, `user_achievements` contient les tiers dérivables des `set_logs` |
| 3 | Un 2ᵉ appel (`check_and_grant_achievements`) n'ajoute aucune ligne |
| 5 | Une RPC en échec n'empêche pas le `UPDATE … finished_at` |

---

## Scope

**In scope:**
- Extraire `grantAchievementsForUser(userId)` du `processSessionFinish` et l'appeler après un close orphelin réussi (auto-close avec `closed > 0`, et `finish` du prompt).
- Tests unitaires du helper + test du hook (RPC appelé si fermeture, pas si rien).
- Amendement ADR 0024 §4 et de la conséquence « no re-credit ».

**Out of scope:**
- `was_pr` (détection TS, non reconstructible en SQL) — reste au script `scripts/backfill-was-pr.ts --regrant`.
- `has_skipped_sets` (non reconstructible).
- Le sweep serveur one-shot #654 (déjà appliqué) — seul le chemin client devient durable.
- Le re-grant manuel du stock (runbook séparé).

---

## Success Criteria

- **Numeric:** fermer une orpheline appelle `check_and_grant_achievements` exactement une fois ; un second run est un no-op (0 ligne).
- **Qualitative:** le crédit ne dépend plus d'un runbook manuel ; les deux chemins de fermeture (auto et prompt) sont couverts ; ADR 0024 reflète la nouvelle règle.
