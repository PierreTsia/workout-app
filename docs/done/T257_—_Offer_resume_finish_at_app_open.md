# T257 — Offer resume/finish at app open (A)

**Mode:** AFK · **Slice:** `useOrphanSessionClose → OrphanSessionPrompt → AppShell → vitest`

## Goal

Turn the silent boot-time auto-close into an offer: when an orphan's last set is **recent** (inside the 3 h idle threshold), prompt **Resume / Finish** so the user keeps agency; only auto-close when it is genuinely abandoned. Addresses Epic Brief stories 1, 5, 8.

## Dependencies

- T254 (`useOrphanSessionClose` exposes `recentOrphan`; `classifyOpenSession`)
- T255 (`resumeOrphanSession`)

## Scope

### `src/components/workout/OrphanSessionPrompt.tsx` (new)

- Dialog driven by `useOrphanSessionClose().recentOrphan`: `orphanPrompt.title` / `orphanPrompt.body`, actions `openSession.resume` and `openSession.finish`, plus a dismiss (X) that leaves the row open.
- Rendered by `AppShell` (`file:src/components/AppShell.tsx`), next to `useOrphanSessionClose()`.

### `src/hooks/useOrphanSessionClose.ts` (edit)

- Gate the prompt on `!session.isActive` and once per mount (ref).
- `resume()` → `resumeOrphanSession` + `session_orphan_resumed { surface: "app_open" }`.
- `finish()` → close with the last-set rule + `session_orphan_closed { cause: "open_prompt" }`.
- `dismiss()` → clear the prompt; the row stays open (the start guard is the backstop).
- Emit `session_orphan_prompted { surface: "app_open" }` when the prompt is shown.

### Tests

- `src/hooks/useOrphanSessionClose.test.ts` — a recent orphan is exposed and not closed; `finish()` closes it and emits `cause: "open_prompt"`; `resume()` seeds the meta and sets the atom; no prompt while a session is active.
- `src/components/workout/OrphanSessionPrompt.test.tsx` — renders the contract copy, wires the three actions.

## Out of Scope

- The start guard (T256).
- The header finish affordance (T258).
- Auto-finish on `pagehide` (Epic Brief out of scope).

## Acceptance Criteria

- [ ] A recent orphan (< 3 h) prompts **Resume / Finish** on app open instead of a silent close
- [ ] An abandoned orphan (> 3 h) is still auto-closed by #568 with no prompt
- [ ] **Resume** reopens the orphan on its day with its logged sets shown as done
- [ ] **Finish** closes the orphan with `finished_at = last set` and emits `session_orphan_closed { cause: "open_prompt" }`
- [ ] Dismissing leaves the row open and does not start anything
- [ ] No prompt is shown while a local session is active
- [ ] EN + FR keys match the Tech Plan i18n contract (`orphanPrompt.*`, `openSession.*`)
- [ ] `npm test` green

## References

- Epic Brief `file:docs/Epic_Brief_—_Prevent_Orphan_Sessions_#571.md` (stories 1, 5, 8; scope A)
- Tech Plan `file:docs/Tech_Plan_—_Prevent_Orphan_Sessions_#571.md` (Key Decisions: Recent vs abandoned / Prompt surface / gating)
- ADR `file:docs/adr/0024-session-orphan-self-heal.md`
