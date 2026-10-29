# Coach vocal — référence (Stitch)

Design du **mode « Coach »** (interaction permanente à la voix) pour la PWA GymLogic, exploré dans Stitch sur le compte perso.

**Projet Stitch :** `7622141005727868523` — *GymLogic In-App PWA*
**Écran de référence :** *Empty state « Salut »* — screen id `9c8c448f7bf34067814976c9a2f34d5b`
→ https://stitch.withgoogle.com/projects/7622141005727868523/screens/9c8c448f7bf34067814976c9a2f34d5b

> ⭐ **`reference/empty-state-salut`** est l'écran **retenu comme référence** par l'équipe.

---

## Le parcours (machine à états)

| # | État | Déclencheur | Comportement |
| --- | --- | --- | --- |
| 01 | Repos | — | Micro permanent, rien d'autre |
| 02–04 | Réponse rapide | demande **qualifiée** | Carte éphémère : détail exo / prochaine séance / stats |
| 05 | Clarification | confiance basse | Une seule question, pas d'action |
| 06 | Chip contexte | en permanence | `Contexte · PPL · S3 · Push 1 · 30 j` |
| 07 | Sheet contexte | tap chip | Ce que le Coach voit + Changer / Réinitialiser / Voir tout |
| **08** | **Empty « Salut »** | contexte **0/4** | Bascule en **chat vocal dirigé** : « requête non qualifiée » |
| 09 | Remplissage | contexte **2/4 · 50 %** | Le modèle pose **une** question ciblée ; variables qui se cochent |
| 10 | Contexte prêt | **4/4** | « J'ai ce qu'il me faut » → retour à la réponse rapide |

Boucle : **vide → remplissage dirigé → 4/4 → qualifié → réponse rapide**, la chip de contexte servant de fil conducteur.

## Contenu

- `reference/` — l'écran retenu (HTML + PNG).
- `explore/` — tous les autres états (HTML + PNG), pour contexte.

## Notes

- Les écrans viennent de Stitch (compte perso). Design system : **GymLogic** (`assets/5584cc68bb7a4837878ab52c9e89bae9`).
- **Mobile = omettre `deviceType`** dans `generate_screen_from_text` (sinon `"mobile"` → erreur, `"MOBILE"` → souvent desktop). Stitch sort parfois du desktop malgré tout : régénérer.
- L'API Stitch n'a **pas** de `delete_screen` : les essais desktop ratés restent dans le projet.
- `explore/05` et `explore/07` sont les versions **mobile** régénérées.
