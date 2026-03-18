# Epic Brief — Persistent Timer & Navigation Access

## Summary

Replace the intrusive full-screen rest timer overlay with a non-blocking **floating pill** that follows the user app-wide (excluding admin pages), allowing them to consult exercise instructions, navigate between exercises, and log sets without interrupting the countdown. Tapping the pill opens a **drawer** (Vaul) with full timer controls including pause/resume. The timer persists across all navigation, including leaving and returning to the workout page.

---

## Context & Problem

**Who is affected:** Users in an active workout session who need to access instructions, log sets, or navigate exercises while resting.

**Current state:**
- Rest timer uses a full-screen overlay (`file:src/components/workout/RestTimerOverlay.tsx`) that blocks all interaction
- Timer state (`restAtom`) is already global and persisted via `atomWithStorage` — the infrastructure is sound
- To access instructions or log a set, users must skip/dismiss the timer, losing their countdown
- Drawer component (Vaul) already exists and is used elsewhere (RirDrawer, QuickWorkoutSheet)

**Pain points:**

| Pain | Impact |
|---|---|
| Full-screen overlay blocks UI | Cannot view exercise instructions during rest |
| Must skip timer to interact | Lose countdown progress; defeats purpose of timer |
| Accidental timer dismissal | Frustrating mid-workout; no way to resume |
| No visibility outside workout page | Timer state lost (perceptually) when navigating away |
| No pause capability | Cannot pause timer for interruptions (phone call, etc.) |

---

## Goals

| Goal | Measure |
|---|---|
| Non-blocking rest timer | Pill visible + drawer on tap; user can interact with UI while timer runs |
| App-wide persistence | Timer pill visible on all non-admin pages when rest is active |
| Session continuity | Navigation away from workout page does not reset or hide the timer |
| Pause/resume capability | User can pause and resume the countdown from the drawer |
| Familiar interaction pattern | Drawer (Vaul) matches existing patterns (RirDrawer, QuickWorkoutSheet) |

---

## Scope

**In scope:**

1. **Floating pill component** — compact UI showing remaining time, visible app-wide (except admin pages) when `restAtom` is active
2. **Timer drawer** — tap pill to open drawer with countdown circle, skip button, pause/resume toggle, and time display
3. **Pause/resume functionality** — extend `restAtom` to track paused state; drawer shows play/pause control
4. **Migrate existing logic** — audio beeps, vibration, notifications moved from RestTimerOverlay to new components
5. **Conditional overlay behavior** — keep full-screen drawer as the expanded view (replaces overlay UX without deleting the pattern)
6. **App-wide rendering** — pill rendered in `AppShell` with condition to hide on admin routes
7. **Position: bottom-right** — fixed floating position, thumb-friendly on mobile (Tech Plan finalizes exact specs)

**Out of scope:**

- Customizable rest duration (user preference) — future enhancement
- Position customization — fixed position only
- Refactoring sounds/vibration behavior — keep existing logic as-is, just migrate location
- Admin page visibility — pill explicitly hidden on `/admin/*` routes

---

## Success Criteria

- [ ] Timer persists during navigation between exercise instructions and logging
- [ ] Floating "timer pill" is visible when timer is running — on all non-admin pages
- [ ] Tapping pill expands full timer controls in a drawer
- [ ] Navigation away from the workout page does not reset the timer (session persistence)
- [ ] User can log a set or view instructions without dismissing the timer
- [ ] User can pause and resume the timer from the drawer
- [ ] Audio/vibration notifications fire at 10s warning and timer end (existing behavior preserved)
- [ ] Pill is hidden on admin pages (`/admin/*`)
