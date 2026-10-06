# Tech Plan — Decision Card locale (#677)

Bug: après la release 1.7.0, la **Decision Card** `ui://gymlogic/program-patch` s'affiche
avec des libellés EN (`rest`, `Apply`, `To approve`) alors que le contenu est FR. Même
mécanisme (et mêmes trous) pour la **Session Card**.

## Cause racine

`payload.locale` est résolu **côté serveur** par `resolveCardLocale(args.locale, profile.locale)`.
Deux trous se cumulent :

1. L'argument `locale` d'`update_program` n'est **pas documenté** dans `skills/gymlogic-mcp/SKILL.md`
   (il l'est pour `render_session_card`) → le modèle ne le passe pas.
2. Le repli `user_profiles.locale` n'est pas fiable : la colonne est **NULL** pour tout compte
   créé avant la migration T152, et la règle **Display Locale** veut que la valeur de l'appareil
   (`localStorage["locale"]`) gagne — le profil ne fait qu'**amorcer** un appareil vierge.

Quand `args.locale` est absent et le profil NULL, `resolveCardLocale` retombe sur `"en"`.

## Décision

Le seul signal **fiable et joignable** par la carte est la **locale de l'hôte MCP Apps**
(`HostContext.locale`, BCP-47, SEP-1865). La vue lit donc `ui/initialize` /
`ui/host-context-changed` et retombe dessus quand `payload.locale` est **absent**.

Précédence retenue pour une carte : **argument d'outil explicite → locale de l'hôte →
`user_profiles.locale` (seed) → `en`**. On **ne reordonne pas** la chaîne d'ADR 0031 ; on
remplace seulement son défaut terminal `en` par un défaut **hôte → seed → `en`**, ce qui est
exactement ce que propose #677 et ce que dit **Display Locale** (la valeur de l'appareil
gagne, le profil n'amorce qu'un hôte qui n'expose aucune langue).

Conséquence serveur : `update_program` émet les deux sources **séparément** — `locale`
(argument explicite seul) et `profile_locale` (le seed) — et omet chaque champ absent, pour
que la vue puisse intercaler la locale de l'hôte entre les deux. `render_session_card` garde
`?? "en"` : ses **noms d'exercices** sont localisés côté serveur, donc sa locale doit rester
décidée serveur (sinon noms et libellés divergeraient). Sa correction passe par le même
argument `locale` documenté et transmis par le modèle.

## Cas inverse — warnings

Les `warnings[]` d'`update_program` sont des chaînes **FR codées serveur**
(`formatActiveCycleWarning`, `formatSlotDetachmentWarning`). Une carte EN les afficherait en
FR. On les **type** (`warning_details`) et on les compose **dans la vue** par locale ; le
texte du tool (`payload.warnings`, FR) reste inchangé pour les clients non-UI.

## Périmètre

- Serveur : `resolveCardLocale` → `… | null` ; `update_program` omet `locale` et ajoute
  `warning_details` ; `render_session_card` `?? "en"`.
- Vue : `src/mcp-views/locale.ts` (`normalizeLocale`, `resolveViewLocale`) ; bridge expose
  `hostContext.locale` ; `program-patch/entry.tsx` l'utilise ; libellés de warnings.
- Docs : `skills/gymlogic-mcp/SKILL.md` documente `locale` pour `update_program` + note
  Display Locale ; note dans ADR 0031.
- Tests : résolution de locale (vue + serveur), rendu carte FR (`repos` / `Appliquer`),
  warning localisé.

## Non-goals

- Localiser les **noms d'exercices** de la Decision Card (le serveur n'envoie que `name` FR) —
  hors périmètre, suivi séparé.
- Refonte de la Session Card (noms/dates côté serveur).
- Le repli `user_profiles.locale` n'est pas supprimé : il reste le seed après l'argument.

## Découpage

Quick win → **un seul lot**, pas de split de tickets.
