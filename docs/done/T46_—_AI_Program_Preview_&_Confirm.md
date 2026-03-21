# T46 — AI Program Preview & Confirm

## Goal

Build the AI program preview screen with progressive reveal (coach rationale, then collapsible day cards with exercises) and the program creation flow. This is the culmination of the AI path — the user sees the AI's work, understands the reasoning, and confirms to save the program.

## Dependencies

- T42 (validated program data from the edge function)
- T45 (constraint + generating steps feed data into this step)

## Scope

### Coach rationale component

`src/components/create-program/CoachRationale.tsx`:

- Displays the AI's `rationale` string in a styled card
- Sparkle/brain icon to signal "AI reasoning"
- Subtle background (muted accent), rounded, ~2 lines of text
- Appears at the very top of the preview, before day cards

### Program preview step

`src/components/create-program/AIProgramPreviewStep.tsx`:

Progressive reveal UX:
1. `CoachRationale` at top
2. List of day cards, initially showing label + muscle focus + exercise count (collapsed)
3. Tap a day to expand: shows exercise list with name, muscle group, sets x reps, rest time
4. Reuse existing DayCard styling patterns from `file:src/components/library/DayCard.tsx`

Actions at bottom:
- **Regenerate** — re-triggers `useAIGenerateProgram.mutateAsync` with same constraints, returns to generating step
- **Create Program** — calls `createAIProgram()` utility, navigates to `/library` on success

### Program creation utility

`createAIProgram()` function (in the hook or a utility file):

1. Deactivate current active program (`programs.is_active = false`)
2. Insert `programs` row: `{ name: "AI: {goal} / {daysPerWeek}d", template_id: null, is_active: true }`
3. For each day: insert `workout_days` row with label, emoji, sort_order
4. For each exercise in each day: insert `workout_exercises` row with `exercise_id`, `name_snapshot`, `muscle_snapshot`, `emoji_snapshot`, `sets`, `reps`, `weight: "0"`, `rest_seconds`, `sort_order`
5. Update Jotai atoms: `hasProgramAtom`, `activeProgramIdAtom`
6. Invalidate query caches: `workout-days`, `active-program`, `user-programs`

Same sequential insert pattern as `file:src/hooks/useGenerateProgram.ts`.

### i18n additions

| Key | EN | FR |
|---|---|---|
| `previewTitle` | Your AI Program | Votre programme IA |
| `coachSays` | Coach's reasoning | Le raisonnement du coach |
| `exercises` | {{count}} exercises | {{count}} exercices |
| `setsReps` | {{sets}} x {{reps}} | {{sets}} x {{reps}} |
| `restSeconds` | {{seconds}}s rest | {{seconds}}s repos |
| `regenerate` | Regenerate | Régénérer |
| `createProgram` | Create Program | Créer le programme |
| `creating` | Creating program... | Création du programme... |
| `created` | Program created! | Programme créé ! |

## Out of Scope

- Split modification UI (user can regenerate but cannot manually edit individual days in this step — full editing is available in the builder after creation)
- Template path (T47)
- E2E tests (T48)

## Acceptance Criteria

- [ ] CoachRationale displays the AI's rationale with appropriate styling
- [ ] Day cards show label, muscle focus, and exercise count when collapsed
- [ ] Tapping a day expands it to show exercises with name, muscle group, sets, reps, rest
- [ ] "Regenerate" re-calls the AI with same constraints and shows generating step
- [ ] "Create Program" inserts program + days + exercises into Supabase
- [ ] Created program is active; previous active program is deactivated
- [ ] Jotai atoms and query caches are updated after creation
- [ ] User is navigated to `/library` after successful creation
- [ ] Toast confirms program creation

## References

- Epic Brief: `file:docs/Epic_Brief_—_AI-Powered_Program_Generation.md` (Scope items 4, 7)
- Tech Plan: `file:docs/Tech_Plan_—_AI-Powered_Program_Generation.md` (AIProgramPreviewStep, AI Program -> Existing Pipeline Integration)
