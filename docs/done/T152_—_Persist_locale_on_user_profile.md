# T152 — Persist locale on user profile

## Goal

La langue ne vit aujourd'hui que dans `localStorage` : un utilisateur qui installe la PWA sur un second appareil repart en langue navigateur. Ce ticket ajoute `user_profiles.locale` pour **amorcer** un appareil neuf, sans jamais court-circuiter le boot synchrone d'i18n.

Réconcilie au passage deux défauts contradictoires qui coexistent depuis longtemps : `localeAtom` vaut `"fr"` (`file:src/store/atoms.ts`) tandis que `fallbackLng` vaut `"en"` (`file:src/lib/i18n.ts`).

## Mode

**AFK** — la règle de précédence est arbitrée (**Display Locale**).

## Slice

migration → écriture à la bascule → amorçage à l'onboarding → hydratation au boot

## Dependencies

Aucune (parallélisable avec T145-T151).

## Scope

### Migration

```sql
ALTER TABLE user_profiles
  ADD COLUMN locale text CHECK (locale IN ('en', 'fr'));
```

- **Nullable, sans défaut** : `NULL` signifie « n'a jamais exprimé de choix », ce qui est distinct de « a choisi le français ». Un défaut `'fr'` détruirait cette information et basculerait en français des anglophones qui n'ont rien demandé.
- CHECK inline, calqué sur `gender` ; vocabulaire aligné sur `embedded_agent_threads.locale`.
- Aucun changement de RLS : la policy `"Users manage own profile"` est `FOR ALL`.

### Écriture

- `SideDrawer.handleLocaleChange` persiste vers `user_profiles.locale` **après** avoir mis à jour `localStorage`.
- **Échec silencieux volontaire** : `localStorage` a déjà gagné, l'UI est correcte, seule la synchro cross-device est perdue. Pas de toast, pas de retry — c'est une préférence, pas une donnée d'entraînement.
- `useCreateUserProfile` amorce `locale` depuis `i18n.language` à l'onboarding, exactement comme `timezone` est capturé aujourd'hui.

### Lecture

- Consommée **uniquement** quand `readPersistedLocale()` retourne `null`. `localStorage` gagne toujours au rendu — sinon, flash de contenu non traduit à chaque chargement.
- Le boot i18n est **synchrone** (`file:src/lib/i18n.ts` 113-118) et le profil n'est lisible qu'après résolution de l'auth : sur un appareil sans valeur locale, l'app rend brièvement en langue navigateur avant bascule. **Accepté** — c'est le cas où l'on n'a aucune meilleure information, et il ne survient qu'une fois par appareil.

### Défauts

- Réconcilier `localeAtom` (`"fr"`) et `fallbackLng` (`"en"`) sur une règle unique et documentée en commentaire.

### Types

- `UserProfile.locale: "en" | "fr" | null` dans `file:src/types/onboarding.ts`.

## Out of Scope

- Toute consommation serveur : emails transactionnels, MCP. La colonne est **write-mostly** en v1 ; elle existe pour que ces usages deviennent possibles, pas pour les livrer.
- Un sélecteur de langue dans les réglages de compte — la bascule existante suffit.

## Acceptance Criteria

- [ ] La migration applique et le CHECK rejette une valeur hors `('en','fr')`.
- [ ] Basculer la langue écrit dans `localStorage` **et** dans le profil.
- [ ] Un échec d'écriture profil ne produit aucune erreur visible.
- [ ] `localStorage` renseigné → le profil n'est jamais lu au rendu.
- [ ] `localStorage` vide + profil renseigné → l'app converge vers la langue du profil.
- [ ] L'onboarding crée le profil avec la locale courante.
- [ ] Les défauts `localeAtom` / `fallbackLng` sont cohérents.

## References

- Epic Brief : stories 11 (nouvel appareil), 12 (capture à l'onboarding)
- Glossaire : **Display Locale** (`file:docs/CONTEXT.md`)
- Tech Plan : § Data Model, § Failure Mode Analysis
- Précédents : `file:supabase/migrations/20260314000010_add_gender_to_user_profiles.sql`
