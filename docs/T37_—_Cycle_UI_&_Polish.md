# T37 — Cycle UI & Polish

## Goal

Add the cycle-aware UI overlays and finishing touches: progress header with dots, cycle completion banner, reset day action, Quick Workout trailing card, and all remaining i18n keys. After this ticket, the full carousel experience is complete.

## Dependencies

- T36 — Session Card Carousel

## Scope

### CycleProgressHeader

Create `file:src/components/workout/CycleProgressHeader.tsx`:

- Compact bar above the carousel: program name, filled/empty dots per day, "2/3" count text
- Three-dot `DropdownMenu` with "Finish rotation" action → `supabase.from("cycles").update({ finished_at: now() })`
- Reads `useActiveCycle` + `useCycleProgress`

### CycleCompleteBanner

Create `file:src/components/workout/CycleCompleteBanner.tsx`:

- Visible when `cycleProgress.isComplete && activeCycle?.finished_at === null`
- "Rotation complete — start a new cycle?" with Confirm / Dismiss buttons
- Confirm → sets `finished_at`, invalidates queries, shows toast
- Dismiss → hides for current render (reappears on reload — derived from state)

### Reset day action

In `file:src/components/workout/WorkoutDayCard.tsx`:

- Wire the "Reset day" button on completed cards
- Confirmation dialog: "This day will be marked as pending again. Your session data is kept in history."
- On confirm: `supabase.from("sessions").update({ cycle_id: null }).eq("workout_day_id", dayId).eq("cycle_id", cycleId)`
- Invalidate `["cycle-sessions"]` and `["last-session-day"]` queries

### QuickWorkoutCard

Create `file:src/components/workout/QuickWorkoutCard.tsx`:

- Trailing card in carousel: dashed border, Zap icon, "Quick Workout" label
- Tapping opens `QuickWorkoutSheet` (existing component)

### i18n

Add remaining keys to `file:src/locales/en/workout.json` and `file:src/locales/fr/workout.json`:

- `cycleProgress`, `finishRotation`, `rotationComplete`, `confirm`, `dismiss`, `resetDay`, `resetDayConfirm`

### WorkoutPage integration

- Add `CycleProgressHeader` and `CycleCompleteBanner` above the carousel
- Add `QuickWorkoutCard` as trailing carousel item

## Out of Scope

- Cycle history view ("Week 12: Push, Pull, Legs") — follow-up epic
- Cross-cycle progression analytics — follow-up
- Active session UX changes — stays as-is

## Acceptance Criteria

- [ ] Progress header shows correct filled/empty dots matching cycle state
- [ ] "Finish rotation" closes the cycle early and updates UI
- [ ] Cycle complete banner appears when all days are done but cycle is unconfirmed
- [ ] Confirming the banner closes the cycle; next Start creates a new one
- [ ] Dismissing the banner hides it; it reappears on reload
- [ ] "Reset day" unlinks the session (sets `cycle_id = null`), preserves session data
- [ ] "Reset day" requires confirmation dialog
- [ ] Quick Workout trailing card opens QuickWorkoutSheet
- [ ] All i18n keys present in EN and FR
- [ ] `npm run build` succeeds, all tests pass

## References

- [Epic Brief](docs/Epic_Brief_—_Workout_Overview_Session_Cards.md) — PR B items 11, 13-15, PR A item 4 (lifecycle)
- [Tech Plan](docs/Tech_Plan_—_Workout_Overview_Session_Cards.md) — PR B sections (progress header, banner, reset day, Quick Workout card, i18n)
