# T29 — Change Program, Analytics & Polish

## Goal

Enable in-app program switching for returning users, instrument the onboarding funnel with analytics events, handle edge cases, and polish i18n. This is the final ticket in the epic — after it ships, all 12 scope items from the epic brief are complete.

## Dependencies

- T28 — Onboarding Wizard UI (step components must exist and be reusable)

## Scope

### ChangeProgramPage

**`file:src/pages/ChangeProgramPage.tsx`**
- In-app wizard that reuses shared step components from T28 (Steps 3-5 only):
  - `PathChoiceStep` → guided or self-directed
  - `TemplateRecommendationStep` → ranked template list
  - `ProgramSummaryStep` → preview and confirm
- Skips Welcome and Questionnaire (profile already exists)
- Inside `AppShell` (user retains nav context — hamburger menu, session timer visible)
- On program creation: deactivates old program, creates new one, old sessions preserved under inactive program

### Route & Navigation

- Add `/change-program` route to `file:src/router/index.tsx` (inside AppShell, within OnboardingGuard)
- Add "Change Program" nav link to `file:src/components/SideDrawer.tsx`

### Analytics Events

**`file:src/hooks/useTrackEvent.ts`**
- Mutation hook: `INSERT INTO analytics_events (event_type, user_id, payload)`
- Simple utility, reusable for any future feature

**Instrument the onboarding wizard** (modify step components from T28):

| Event | Trigger | Payload |
|---|---|---|
| `onboarding_started` | WelcomeStep mount | `{}` |
| `onboarding_step_completed` | Each step `onNext` | `{ step: number, step_name: string }` |
| `template_selected` | TemplateRecommendationStep `onSelect` | `{ template_id, template_name }` |
| `program_created` | useGenerateProgram success | `{ program_id, template_id, path: "guided" \| "self_directed" }` |
| `onboarding_skipped` | Skip link on steps 4-5 | `{ from_step: number }` |
| `program_changed` | ChangeProgramPage program creation | `{ old_program_id, new_program_id, template_id }` |

### Edge Cases

- **Profile editing:** if the user's profile already exists and they go through `/change-program`, the recommendation engine uses the stored profile. If a future "Edit Profile" action is needed, the upsert in `useCreateUserProfile` already handles it — but there's no UI for standalone profile editing in this ticket.
- **Re-onboarding detection:** if a user with an existing program somehow lands on `/onboarding`, the already-onboarded guard (from T25/T28) redirects to `/`. If their program was deleted externally (e.g., via SQL), `hasProgramAtom` would be false on next auth → they'd re-enter onboarding naturally.

### i18n Review & Polish

- Review all strings in `file:src/locales/en/onboarding.json` and `file:src/locales/fr/onboarding.json`
- Add strings for ChangeProgramPage, analytics confirmations, SideDrawer link
- Verify no hardcoded strings remain in any onboarding component
- Check both languages for completeness and natural phrasing

## Out of Scope

- Standalone profile editing UI (deferred — upsert hook exists but no dedicated screen)
- Session duration-based volume adaptation (deferred per epic brief)
- Inline exercise editing in program summary (deferred per epic brief)
- Additional templates beyond the initial 5 (future seed migrations)
- Analytics dashboard or SELECT policy on analytics_events (write-only for now)

## Acceptance Criteria

- [ ] Users can switch programs from side drawer → "Change Program" → `/change-program`
- [ ] `/change-program` shows steps 3-5 (path choice → recommendation → summary) inside AppShell
- [ ] Old program is deactivated (`is_active = false`), session history preserved under it
- [ ] New program is created and becomes active
- [ ] `useTrackEvent` hook inserts events into `analytics_events`
- [ ] Analytics events fire at all specified touchpoints (started, step_completed, template_selected, program_created, skipped, program_changed)
- [ ] Already-onboarded users cannot access `/onboarding` (redirected to `/`)
- [ ] All onboarding and change-program strings are translated (EN + FR) with no hardcoded text
- [ ] "Change Program" link appears in the side drawer navigation

## References

- Epic Brief: `file:docs/Epic_Brief_—_Onboarding_&_Program_Generation.md` — Scope items 9 (analytics), 12 (template switching)
- Tech Plan: `file:docs/Tech_Plan_—_Onboarding_&_Program_Generation.md` — Phase 3 steps 1-7, Component Responsibilities (ChangeProgramPage), New Files table (useTrackEvent)
