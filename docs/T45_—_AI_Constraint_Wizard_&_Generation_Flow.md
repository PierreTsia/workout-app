# T45 — AI Constraint Wizard & Generation Flow

## Goal

Build the AI constraint form (prefilled from user profile) and the generation loading/error step. After this ticket, a user can fill in their preferences, submit, see a loading state while the edge function runs, and land on either a success state (data ready for T46's preview) or an error state with retry/fallback options.

## Dependencies

- T43 (frontend hook must be available to call)
- T44 (wizard shell must exist to host these steps)

## Scope

### Constraint form

`src/components/create-program/AIConstraintStep.tsx`:

- React Hook Form + Zod schema from `file:src/components/create-program/schema.ts` (T43)
- Prefill from `user_profiles` via existing `file:src/hooks/useUserProfile.ts`:
  - `training_days_per_week` —> `daysPerWeek`
  - `session_duration_minutes` —> `duration`
  - `goal` —> `goal`
  - `experience` —> `experience`
  - `equipment` —> `equipmentCategory` (mapped: `gym` —> `full-gym`, `home` —> `dumbbells`, `minimal` —> `bodyweight`)
- Optional free-form fields (not prefilled):
  - Focus areas (text input): "e.g. emphasis on upper body"
  - Split preference (select): PPL / Upper-Lower / Full Body / Let AI decide
- Submit button triggers `onNext(constraints)`

### Generation step

`src/components/create-program/AIGeneratingStep.tsx`:

- On mount: calls `useAIGenerateProgram.mutateAsync(constraints)` from T43
- Loading state: shimmer skeleton mimicking day cards (3—6 skeleton bars)
- Message: "Generating your program..." with a subtle animation
- On success: calls `onNext(aiResult)` to transition to preview (T46)
- On error:
  - Network error: "Connection lost. Try again?"
  - Timeout: "Generation took too long. Try again?"
  - Generic: "Something went wrong."
  - Actions: Retry (re-call mutation), Pick a template (navigate to template path), Start from scratch (navigate to blank path)

### i18n additions

Add keys to `create-program.json`:

| Key | EN | FR |
|---|---|---|
| `constraintTitle` | Customize your program | Personnalisez votre programme |
| `daysPerWeek` | Training days per week | Jours d'entraînement par semaine |
| `duration` | Session duration | Durée de la séance |
| `goal` | Goal | Objectif |
| `experience` | Experience level | Niveau d'expérience |
| `equipment` | Equipment | Équipement |
| `focusAreas` | Focus areas (optional) | Zones de focus (optionnel) |
| `focusAreasPlaceholder` | e.g. emphasis on upper body | ex. accent sur le haut du corps |
| `splitPreference` | Split preference | Préférence de split |
| `letAIDecide` | Let AI decide | Laisser l'IA décider |
| `generate` | Generate program | Générer le programme |
| `generating` | Generating your program... | Génération de votre programme... |
| `errorNetwork` | Connection lost. Try again? | Connexion perdue. Réessayer ? |
| `errorTimeout` | Generation took too long. Try again? | La génération a pris trop de temps. Réessayer ? |
| `errorGeneric` | Something went wrong. | Une erreur est survenue. |
| `retry` | Retry | Réessayer |
| `useTemplate` | Pick a template instead | Choisir un modèle |
| `startBlank` | Start from scratch | Partir de zéro |

## Out of Scope

- Preview step UI (T46)
- Program creation/persistence (T46)
- Edge function internals (T41—T42)

## Acceptance Criteria

- [ ] Constraint form prefills all available fields from user profile
- [ ] Equipment mapping is correct (`gym` —> `full-gym`, `home` —> `dumbbells`, `minimal` —> `bodyweight`)
- [ ] Form validates via Zod before submission (invalid states show errors)
- [ ] Generating step shows skeleton loading state on mount
- [ ] On success: transitions to next step with `AIGeneratedProgram` data
- [ ] On network error: shows network-specific message with retry
- [ ] On timeout/generic error: shows appropriate message with retry + fallback options
- [ ] All strings are translated in both EN and FR

## References

- Epic Brief: `file:docs/Epic_Brief_—_AI-Powered_Program_Generation.md` (Scope item 3)
- Tech Plan: `file:docs/Tech_Plan_—_AI-Powered_Program_Generation.md` (AIConstraintStep, AIGeneratingStep sections)
