# T44 — Creation Wizard Shell & Path Choice

## Goal

Create the `/create-program` route and wizard page shell with step management, the path choice screen (AI / Template / Blank), and the blank program path. After this ticket, users can navigate to `/create-program`, see three creation options, and use the "Start from Scratch" path to create an empty program — exactly like the current `CreateProgramDialog` but in a full-page experience.

## Dependencies

T40 (Library redesign must be shipped — the wizard builds on the simplified Library).

## Scope

### Route registration

Add `/create-program` to `file:src/router/index.tsx` as a sibling of `AppShell` under `OnboardingGuard`:

```tsx
{
  element: <OnboardingGuard />,
  children: [
    { path: "/create-program", element: <CreateProgramPage /> },
    { element: <AppShell />, children: [...] },
  ],
}
```

### Wizard page

`src/pages/CreateProgramPage.tsx`:

- Full-page layout (no AppShell, no nav bar) — same pattern as `file:src/pages/OnboardingPage.tsx`
- Local state: `{ step, path, constraints, aiResult, selectedTemplate }`
- Back/close button in header that navigates to `/library`
- Renders current step component based on `step` state
- Step transitions via `onNext(data)` / `onBack()` callbacks

### Path choice step

`src/components/create-program/PathChoiceStep.tsx`:

Three cards with icons:
- **AI Generate** — sparkle icon, primary accent. Navigates to `AIConstraintStep` (T45).
- **From Template** — copy icon. Navigates to `TemplateChoiceStep` (T47).
- **Start from Scratch** — pencil icon. Navigates to `BlankProgramStep`.

### Blank program step

`src/components/create-program/BlankProgramStep.tsx`:

- Name input (same as `file:src/components/library/CreateProgramDialog.tsx`)
- Uses `file:src/hooks/useCreateProgram.ts` to create empty program
- On success: navigates to `/builder/{programId}`

### i18n

Create `src/locales/en/create-program.json` and `src/locales/fr/create-program.json` with keys for:

| Key | EN | FR |
|---|---|---|
| `title` | Create Program | Nouveau programme |
| `pathAI` | AI Generate | Générer avec l'IA |
| `pathAIDescription` | Get a personalized program based on your goals | Un programme personnalisé selon vos objectifs |
| `pathTemplate` | From Template | Depuis un modèle |
| `pathTemplateDescription` | Pick a proven program and make it yours | Choisissez un programme éprouvé |
| `pathBlank` | Start from Scratch | Partir de zéro |
| `pathBlankDescription` | Build your own program exercise by exercise | Construisez votre programme exercice par exercice |
| `back` | Back | Retour |
| `programName` | Program name | Nom du programme |
| `create` | Create | Créer |

Add `"create-program"` namespace to `file:src/lib/i18n.ts`.

## Out of Scope

- AI constraint step and generating step (T45)
- AI preview step (T46)
- Template choice and preview steps (T47)
- Wiring Library CTA to this route (T48)

## Acceptance Criteria

- [ ] `/create-program` route renders `CreateProgramPage` outside `AppShell`
- [ ] Page has a back/close button that navigates to `/library`
- [ ] Three path cards are displayed with correct labels in both EN and FR
- [ ] Clicking "Start from Scratch" shows name input, creates program, redirects to builder
- [ ] Clicking "AI Generate" and "From Template" transition to placeholder steps (wired in T45/T47)
- [ ] `create-program` i18n namespace loads correctly in both languages

## References

- Epic Brief: `file:docs/Epic_Brief_—_AI-Powered_Program_Generation.md` (Scope item 2)
- Tech Plan: `file:docs/Tech_Plan_—_AI-Powered_Program_Generation.md` (Route Structure, Wizard Step Flow)
- Existing pattern: `file:src/pages/OnboardingPage.tsx` (full-page layout outside AppShell)
