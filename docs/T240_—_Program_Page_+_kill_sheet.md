# T240 — Program Page + kill sheet

## Goal

First-class `/programs/:programId`: character sheet, facts, read-only days, Éditer / Activer / Archiver. Card tap goes here. `ProgramDetailSheet` is deleted. Read links (Profil badge, Home “see program”) go to the page, not the Builder. Addresses Epic stories 1, 2, 5, 11, 14–19.

## Mode

AFK — route, sheet death, and read-link retarget are locked. Rubric *strings* come from the Tech Plan contract; HITL polish is T241.

## Slice

router → `useProgram` + `useProgramIntent` → `ProgramPage` + `ProgramScoreSheet` + `ProgramFactsBlock` + `ProgramDayRow` → card `Link` → delete sheet → retarget Profil/Home → vitest

## Dependencies

T238, T239 (chips, `program` ns, `["program-intent"]` hydrate).

## Scope

### Fetch

- `file:src/hooks/useProgramIntent.ts` — key `["program-intent", id]`. Same slim embed as T239. Hydrate from `useProgramsIntent` cache when present; otherwise fetch one program’s days.

### Route

- Lazy `ProgramPage` at `/programs/:programId` in `file:src/router/index.tsx` (sibling of `/builder/:programId`).
- UUID gate + not-found → `program.notFound` + `notFoundBack` (pattern: `file:src/pages/library/ExerciseLibraryExercisePage.tsx`).
- Offline + cache miss → `program.offline`. Cache hit → score. Query error → `program.loadError`.

### Page

- Header: name, active/archived, `pageTitle`. Back → `/library/programs`. No gold / pin / filter on `profile.goal` (story 4).
- `ProgramScoreSheet`: contract `rubric.*` always visible; tap → `example.hypertrophy` (and siblings as needed) with *this* week’s facts.
- `ProgramFactsBlock`: `facts.line` + mix buckets (`facts.mix.*`). No clock.
- Days: compact `ProgramDayRow`s (name, index, counts). Expand to read solos + Circuits. No « Commencer ». Header Edit → Builder day list (`location.state.from`). Day pencil → that day's editor (`location.state.dayId`).
- Actions: header Edit as above. Activate / archive in the header kebab — reuse `useActivateProgram` / `useArchiveProgram` + `ActivateConfirmDialog`. Use existing `library` action keys.

### Card + sheet

- Card body/title is a `Link` to `/programs/:id`. Action row `stopPropagation`. Drop `onDetails` / details link.
- Delete `file:src/components/library/ProgramDetailSheet.tsx` and all call sites (`MyWorkoutsTab` state). Grep = 0.

### Read links

- `ProgramBadgePopover` (and any Home “see this program” that today hits `/builder/:id`) → `/programs/:id`. Éditer remains Builder.

### i18n

Add remaining contract keys: `rubric.*`, `example.hypertrophy`, `facts.mix.*`, `empty.scores`, `notFound`, `notFoundBack`, `loadError`, `offline`, `edit`, `pageTitle`. Values = Tech Plan table. Do not invent synonyms.

### Tests

- Invalid UUID / missing program → not-found, no bands
- Empty week → `empty.scores`, no `short`
- Card click navigates (MemoryRouter)
- Zero `ProgramDetailSheet` imports (arch grep test welcome)
- `vi.mock("@/lib/supabase")`

## Out of Scope

- Live Builder banner (#519)
- HITL copy rewrite (T241)
- ADR (T242)
- Start-session CTA

## Acceptance Criteria

- [ ] `/programs/:uuid` renders scores + facts + day rows for the owner
- [ ] Foreign / junk id → not-found + back to Library; 0 fake `ok`
- [ ] Card tap (not Edit/Activate/Archive) → the page; `ProgramDetailSheet` gone
- [ ] Profil / Home read path → `/programs/:id`, not Builder
- [ ] Header Edit → Builder day list; day pencil → that day's editor; Activate/Archive behave as on the card
- [ ] No « Commencer » on the page
- [ ] EN + FR keys match the Tech Plan i18n contract
- [ ] Env-stripped vitest + `tsc -p tsconfig.app.json --noEmit`
- [ ] Demoable: Library → card → page → Éditer → back → scores still match the week

## References

- Epic Brief stories 1, 2, 5, 11, 14–19
- Tech Plan: ProgramPage, Failure Mode Analysis, i18n contract
