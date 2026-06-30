# ADR 0009 — AI Provider Fallback : Groq en secours de Gemini, sur indispo uniquement (v1)

- **Status:** Accepted
- **Date:** 2026-06-30
- **Decided in:** grilling session (`grill-with-docs`) pour l'issue #405

## Context

Les trois call-sites IA in-app — le chat **Embedded Agent** (`file:supabase/functions/embedded-agent/chatModel.ts`), le **Program draft step** / `generate-program` (`file:supabase/functions/_shared/programGemini.ts`), et **Quick Workout AI (v1)** / `generate-quick-workout` (`file:supabase/functions/generate-quick-workout/gemini.ts`) — tapent tous **`gemini-2.5-flash` en dur**, via `fetch` brut, dans des Edge Functions Deno.

On a mangé plusieurs `503 UNAVAILABLE` ("high demand") de Gemini en prod. Le retry-on-5xx ajouté en #358 (chat uniquement) absorbe les blips transitoires **mais re-cogne le même modèle** : sur un outage soutenu, les trois tentatives échouent et l'utilisateur se prend une bannière d'erreur. Les deux sites JSON sont en fait **plus** fragiles : `generate-program` ne retry que sur JSON invalide, `generate-quick-workout` ne retry pas du tout.

Tensions apparues pendant le grilling :

1. **Quel est le vrai problème ?** Disponibilité, pas qualité de modèle. Benchmarker « quel modèle est meilleur » (evalite) est un sujet orthogonal qui dépend de l'abstraction provider livrée ici, pas l'inverse.
2. **Fiabilité achetée ≠ décorrélation.** Un free tier (Groq, OpenRouter, Cerebras…) n'a aucun SLA. Le gain n'est pas un meilleur SLA par provider, c'est qu'il est rare que Google ET le secondaire tombent à la même seconde.
3. **Parité JSON.** Deux des trois flux dépendent du `response_schema` natif de Gemini ; un secondaire doit reproduire la shape, ou tout le downstream casse.

## Decision

On introduit un **AI Provider Fallback** : Gemini reste **Primary Provider**, **Groq** devient **Fallback Provider**, engagé **sur indisponibilité uniquement**.

- **1 — Périmètre : les trois call-sites.** Un seul mécanisme réutilisable, comportement cohérent. Couvre le trou réel de résilience des deux flux JSON, pas seulement le chat où le 503 s'est manifesté.
- **2 — Ordonnancement : 1 retry → fallback → 1 retry.** Une tentative rapide sur Gemini ; sur échec retryable, bascule Groq ; une tentative de retry sur Groq. Le blip transitoire d'~1s est rattrapé in-place (sans brûler une requête Groq) ; l'outage soutenu bascule vite au lieu de marteler Gemini 3x.
- **3 — Déclencheurs : availability-only.** Bascule sur `provider_unavailable` (503), `provider_error` (autre 5xx), `timeout`. **Jamais** sur `client_error` (4xx — mauvaise clé/payload = NOTRE bug, doit remonter, pas être masqué) ni sur `empty_response` (2xx mais texte/JSON inutilisable — ambigu, hors scope v1).
- **4 — Abstraction : HOF générique au seam d'injection.** Un `withFallback(primary, secondary, classify)` compose autour des fonctions déjà injectées (`chatModel`, `callModel`, `callGemini`) dans les `index.ts` — pas de réécriture des handlers. Plus un classifieur d'erreurs partagé (les deux flux JSON gagnent la taxonomie que seul le chat avait via #358) et **trois adapters Groq fins**, un par shape, en miroir des adapters Gemini.
- **5 — Parité JSON : `response_format: json_schema` strict.** Le secondaire émet une sortie structurée OpenAI-compatible, schéma dérivé d'**une source unique partagée** avec Gemini (traduite au call). Les valideurs downstream (`validateProgram`, `validateAndRepair`) restent le filet de sécurité — ils sont provider-agnostiques.
- **6 — Budget : neuf et serré (~10s) pour le leg Groq.** Pas de partage du budget primaire : sinon un fallback déclenché par `timeout` hériterait de ~0s. Groq étant rapide (LPU), le pire-cas wall-time reste borné (~primaire + 10s) ; un succès lent vaut mieux qu'une erreur rapide.
- **7 — Observabilité : warn `provider_fallback` + champ `provider`.** En miroir du warn `provider_retry` de #358, pour mesurer le taux réel de bascule. Tag **Sentry**. Le nom du provider est de l'**infra** : logs/Sentry oui, **jamais** la réponse wire ni l'UI (règle branding — cf. **Embedded Agent onboarding product (v1)**).
- **8 — Quota : compté une fois, provider-agnostique.** Le `logBillableCall` vit **au niveau handler, hors du wrapper**, donc une seule usage IA est débitée quelle que soit le nombre de legs. Un appel servi par Groq ne donne ni cadeau ni double-compte.

## Consequences

- **Positive :**
  - Les trois flux survivent à un outage Gemini soutenu sans bannière d'erreur ; les deux flux JSON passent de « zéro résilience 5xx » à protégés.
  - Coût borné par construction : Groq gratuit sans carte (risque financier = 0) ; option cap mensuel à ~5 $ si on passe Developer.
  - Aucun changement de contrat wire ni d'UI ; le HOF respecte le seam d'injection existant.

- **Negative :**
  - Dépendance opérationnelle à un 2e provider (clé `GROQ_API_KEY` à provisionner, à monitorer).
  - Latence pire-cas plus longue sur le chemin fallback (≈ primaire + ~10s) — acceptable car rare.
  - Effet cascade : pendant un outage Gemini, tous les users basculent d'un coup → on choisit Groq pour son RPM confortable, mais le free tier reste sans SLA et peut 429 sous pic.
  - Deux providers à garder en parité de prompt/shape : une dérive de l'un peut produire des sorties subtilement différentes.

- **Follow-ups :**
  - Ticket evalite (comparaison **qualité** des modèles) — dépend de l'abstraction provider livrée ici ; hors scope #405.
  - Second fallback éventuel (OpenRouter en méta-routeur, Cerebras) : le HOF se compose, mais hors v1.
  - Revisiter `empty_response` comme déclencheur si la prod montre que Gemini répond « vide » plus souvent qu'anticipé.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **Garder les 3 retries Gemini, fallback seulement après épuisement** | Latence pire sur outage soutenu ; on continue de marteler un modèle dont on sait qu'il est à capacité. |
| **Fallback immédiat, 0 retry in-place** | Perd la résilience aux blips d'~1s et brûle inutilement une requête Groq pour un hoquet que le retry Gemini aurait rattrapé. |
| **Race Gemini + Groq en parallèle, garder le 1er** | Latence minimale mais double la consommation et le coût sur *chaque* appel, pour un bénéfice qui n'existe que pendant les rares outages. |
| **Interface `Provider` unifiée (chat + generateStructured)** | Plus « propre » à long terme mais big-bang sur les trois adapters ; le HOF au seam livre le même bénéfice sans la réécriture. |
| **Cerebras comme fallback** | Modèles excellents mais ~5 RPM sur le free tier → sature sur un pic d'outage où tous les users basculent. |
| **OpenRouter free seul** | 50 req/jour sans crédits, trop bas ; les 10 $ (→1000/jour) sont « presque gratuit » mais ajoutent une mécanique de crédit là où Groq n'en a aucune. |
| **Mistral (EU)** | Carte requise sur Scale ; le tier Experiment gratuit est à ~1-2 RPM, inutilisable pour absorber un pic. |
| **Remplacer Gemini plutôt qu'ajouter un fallback** | Confond disponibilité et qualité : aucune garantie qu'un autre modèle soit plus *up*, et on perdrait la qualité Gemini en régime nominal. |
