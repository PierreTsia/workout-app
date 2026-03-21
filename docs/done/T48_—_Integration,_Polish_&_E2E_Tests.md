# T48 — Integration, Polish & E2E Tests

## Goal

Final integration ticket: wire the Library CTA to the creation wizard, add the session guard, and write E2E tests covering all three creation paths. After this ticket, the AI-Powered Program Generation feature is complete end-to-end.

## Dependencies

- T46 (AI preview + confirm must be functional)
- T47 (template path must be functional)

## Scope

### Library CTA update

In `file:src/pages/LibraryPage.tsx` (refactored in T40):

- Replace `CreateProgramDialog` trigger with `navigate("/create-program")`
- Remove `CreateProgramDialog` component import and `createOpen` state
- The "Nouveau programme" button now navigates to the full-page wizard

### Session guard

The CTA was already disabled during active sessions (T40). Verify it still works after the navigation change. The `/create-program` route itself should also redirect to `/library` if `sessionAtom.isActive` is true (belt and suspenders).

### E2E tests

`e2e/create-program.spec.ts`:

| Test | What it covers |
|---|---|
| AI path: full flow | Navigate to wizard —> select AI —> fill constraints —> wait for generation —> verify preview (rationale + days + exercises) —> confirm —> verify program in library |
| AI path: error + retry | Mock edge function failure —> verify error message —> retry —> verify success |
| Template path: full flow | Navigate to wizard —> select Template —> browse catalog —> select template —> verify preview —> confirm —> verify program in library |
| Blank path: full flow | Navigate to wizard —> select Blank —> enter name —> verify redirect to builder |
| Session guard | Start a session —> verify CTA is disabled —> verify `/create-program` redirects |

### Polish

- Verify back navigation works at every wizard step
- Verify close button navigates to `/library` from any step
- Verify loading states don't flash for cached data
- Verify toast messages appear for program creation success

## Out of Scope

- Performance optimization (acceptable for v1)
- Rate limiting (deferred per epic brief)
- Analytics/telemetry

## Acceptance Criteria

- [ ] Library "Nouveau programme" CTA navigates to `/create-program`
- [ ] `CreateProgramDialog` is fully removed from Library page
- [ ] `/create-program` redirects to `/library` if a workout session is active
- [ ] E2E: AI path creates a program visible in the library with correct day/exercise structure
- [ ] E2E: Template path creates a program from a template
- [ ] E2E: Blank path creates an empty program and redirects to builder
- [ ] E2E: Session guard prevents access to wizard during active session
- [ ] Back/close navigation works correctly at every wizard step

## References

- Epic Brief: `file:docs/Epic_Brief_—_AI-Powered_Program_Generation.md`
- Tech Plan: `file:docs/Tech_Plan_—_AI-Powered_Program_Generation.md` (Integration + Polish section)
