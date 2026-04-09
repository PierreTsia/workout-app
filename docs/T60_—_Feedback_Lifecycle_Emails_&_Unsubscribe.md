# T60 — Feedback lifecycle emails & unsubscribe

## Goal

Extend `**send-transactional-email**` (or a sibling function) to handle `**exercise_content_feedback**` INSERT (acknowledgment) and UPDATE (resolved), respect `**user_email_preferences.feedback_notifications**`, and implement an `**email-unsubscribe**` Edge Function with signed tokens plus visible **Unsubscribe** + `**List-Unsubscribe`** headers on feedback mail — mandatory per Epic Brief when these emails ship.

## Dependencies

- **T56** — `transactional_email_log` (with `feedback_id`) and `user_email_preferences`.
- **T57** — Resend integration and webhook validation pattern.
- **T58** — Webhook wiring understood (same pattern for new webhooks).

## Scope

### Database Webhooks


| Event                                   | Behavior                                                                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `INSERT` on `exercise_content_feedback` | If `user_email` present and user has not opted out, send **ack** email; log `feedback_ack` with `feedback_id` (idempotent per feedback). |
| `UPDATE` when `status` → `resolved`     | If `user_email` present and preferences allow, send **resolved** mail once; log `feedback_resolved`.                                     |


Detect true transition to resolved (compare `old_record` vs `record` in payload) to avoid duplicate sends.

### Email content

- Short, no internal admin notes; align with `file:docs/done/Epic_Brief_—_Compliance_Legal_Privacy_and_Account_Deletion.md`.
- **Unsubscribe** link near top of body; **List-Unsubscribe** header with HTTPS URL to unsubscribe endpoint.

### `email-unsubscribe` function


| Item         | Detail                                                                           |
| ------------ | -------------------------------------------------------------------------------- |
| Route        | `GET` (or `POST`) with signed token: `user_id`, `exp`, `purpose=feedback`.       |
| `verify_jwt` | `false` (public link from email).                                                |
| Action       | Set `feedback_notifications = false` via service client or authenticated upsert. |


### Preferences row

- If no row in `user_email_preferences`, treat as **opted in** (Epic Brief).
- Optional: `INSERT` policy or trigger on first signup — implement if missing from **T56**.

### Config


| File                        | Change                                             |
| --------------------------- | -------------------------------------------------- |
| `file:supabase/config.toml` | `[functions.email-unsubscribe] verify_jwt = false` |


### Webhooks (Dashboard) — `exercise_content_feedback`

Use the **same** Edge Function URL and **same** `Authorization: Bearer …` value as for the `**auth.users`** welcome webhook. Only the **schema**, **table**, and **events** change.

#### Prérequis

1. `**send-transactional-email`** est déployée sur le projet :
  `supabase functions deploy send-transactional-email --project-ref <ref>`
2. Le secret `**WEBHOOK_SECRET**` est défini (`supabase secrets set …`) et **identique** à celui utilisé pour le webhook `auth.users`.
3. `**email-unsubscribe`** est déployée si tu veux que les liens dans les mails fonctionnent :
  `supabase functions deploy email-unsubscribe --project-ref <ref>`

#### Trouver l’URL et la ref

- Dashboard → **Project Settings** → **General** → **Reference ID** (ex. `abcdxyz123`).
- URL de la fonction :  
`https://<Reference ID>.supabase.co/functions/v1/send-transactional-email`  
(pas d’espace, pas de slash à la fin.)

#### Valeur du header `Authorization`

- Onglet / champ **HTTP Headers** (ou équivalent).
- **Key** : `Authorization`
- **Value** : `Bearer`  + **exactement** la même chaîne que `WEBHOOK_SECRET` (celle stockée en secret Supabase).  
Exemple de forme : `Bearer a3f5a1e7bd33f3d4…` (un seul espace après `Bearer`).

Si ce header ne correspond pas, la fonction répond **401** et aucun mail n’est envoyé.

#### Variante A — Deux webhooks séparés (recommandé si l’UI impose un seul type d’événement)

**Webhook 1 — accusé de réception (INSERT)**

1. **Database** → **Webhooks** → **Create a new webhook** (ou **New webhook**).
2. **Name** : ex. `feedback-insert-email`.
3. **Schema** : `public` (pas `auth`).
4. **Table** : `exercise_content_feedback`.
5. **Events** : cocher **Insert** uniquement (pas Update/Delete sauf si tu sais ce que tu fais).
6. **Type** : **HTTP Request**.
7. **Method** : **POST**.
8. **URL** : `https://<Reference ID>.supabase.co/functions/v1/send-transactional-email`
9. **Headers** : garder `Content-Type: application/json` si proposé ; **ajouter**
  `Authorization` = `Bearer <WEBHOOK_SECRET>`.
10. **Create** / **Save** et vérifier que le webhook est **enabled**.

**Webhook 2 — résolu (UPDATE)**

1. Créer un **second** webhook (même flux).
2. **Name** : ex. `feedback-update-resolved-email`.
3. **Schema** : `public` — **Table** : `exercise_content_feedback`.
4. **Events** : cocher **Update** uniquement.
  (Le code ignore les mises à jour qui ne passent pas à `resolved` ; pas besoin de filtrer dans le Dashboard.)
5. **URL** et **Authorization** : **strictement les mêmes** que pour le webhook 1 et que pour `auth.users`.

#### Variante B — Un seul webhook Insert + Update

Si l’interface permet de cocher **Insert** et **Update** sur **une** même règle pour `public.exercise_content_feedback`, une seule entrée suffit : mêmes URL et `Authorization` que ci-dessus.

#### Vérification rapide

- Après un **nouveau signalement** utilisateur : mail « We received your feedback » (si pas désabonné / pas domaine exclu).
- Après passage du statut à **resolved** dans l’admin : mail « Your content feedback was addressed » (une fois par signalement).
- **Edge Functions** → **send-transactional-email** → **Logs** : requêtes `POST` 200 ou erreurs explicites.

#### Dépannage


| Symptôme             | Piste                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 401 dans les logs    | `Authorization` manquant, faux secret, ou espace en trop dans `Bearer …`.                                              |
| Rien ne se déclenche | Webhook désactivé, mauvaise table (`public` / `exercise_content_feedback`), ou événement non coché (Insert vs Update). |
| Double mail          | Normalement évité par `transactional_email_log` ; vérifier les logs Resend.                                            |


Optional env: `**UNSUBSCRIBE_SECRET`** — if unset, unsubscribe links use `**WEBHOOK_SECRET**` (must match signing secret in Edge Function env).

## Out of Scope

- Marketing newsletters.
- Changing `useSubmitFeedback` beyond optional toast copy (product choice).

## Acceptance Criteria

- New feedback insert can trigger **at most one** ack email per report (idempotent).
- Resolve transition triggers **at most one** resolution email per report.
- Users with `feedback_notifications = false` receive **no** feedback lifecycle mail.
- Unsubscribe link works without login (token verified) and persists preference.
- `List-Unsubscribe` header present on feedback-related emails.
- Webhooks for `exercise_content_feedback` configured in Dashboard (document steps like **T58**).

## References

- Epic Brief — nice-to-have + unsubscribe: `file:docs/Epic_Brief_—_Transactional_Email_Resend_&_GymLogic_Domains_#117.md`
- Tech Plan: `file:docs/Tech_Plan_—_Transactional_Email_Resend_&_GymLogic_Domains_#117.md`
- Feedback table: `file:supabase/migrations/20260315100000_exercise_content_feedback.sql`
- Issue: [#117](https://github.com/PierreTsia/workout-app/issues/117)

