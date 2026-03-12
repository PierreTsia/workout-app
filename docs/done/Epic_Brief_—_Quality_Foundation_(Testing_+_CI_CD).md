# Epic Brief — Quality Foundation (Testing + CI/CD)

## Summary

This Epic introduces a quality foundation to the Workout App: a focused automated test suite and a GitHub Actions CI/CD pipeline. The app is fully built and working but has zero tests and no automation — every change is manually verified and every deployment is manual. This Epic addresses all three quality concerns simultaneously: confidence to refactor safely, regression safety for future features, and engineering hygiene before the project is shared or open-sourced.

---

## Context & Problem

The app has 16 hooks, a stateful `SyncService` with offline queue logic, an Epley 1RM formula driving PR detection, and 4 full-screen pages — all with zero test coverage. The highest-risk areas are:

- **`file:src/lib/syncService.ts`** — fingerprint-based deduplication, queue drain, and auto-sync on reconnect. A regression here silently corrupts workout history.
- **`file:src/lib/epley.ts`** — the 1RM formula underpins all PR detection and analytics. Edge cases (reps = 1, weight = 0) are untested.
- **`file:src/hooks/useBest1RM.ts`** — queries historical set logs and computes the PR threshold. Incorrect output produces false PR badges or missed records.
- **`file:src/hooks/useWeightUnit.ts`** — unit conversion between kg and lbs affects every weight display and every value written to Supabase. A conversion bug is invisible until data is corrupted.

Beyond unit logic, three critical user flows have no regression safety: the login flow, a full workout session (start → log sets → finish), and the builder CRUD flow.

On the delivery side, there is no CI pipeline — lint, type-check, and build are run manually (or not at all) before merging. Deployments to Vercel/Netlify are triggered manually.

---

## Goals

| Goal | Measure |
|---|---|
| Cover highest-risk logic | Unit tests for `SyncService`, `epley`, `useBest1RM`, `useWeightUnit` pass in CI |
| Regression safety on critical flows | 3 Playwright E2E flows pass in CI |
| Automated quality gate | All PRs blocked until lint + type-check + unit + E2E pass |
| Automated deployment | Merge to `main` triggers deploy to Vercel/Netlify automatically |

---

## Scope

**In scope:**
- Vitest + React Testing Library setup
- Unit/integration tests: `SyncService`, `epley`, `useBest1RM`, `useWeightUnit`
- Playwright setup + 3 E2E flows: login, full workout session, builder CRUD
- GitHub Actions workflow: lint → type-check → unit tests → E2E → deploy
- Vercel/Netlify deploy step on merge to `main`

**Out of scope:**
- Tests for all hooks and components (broad coverage is a future Epic)
- Visual regression testing
- Load or performance testing
- Test coverage reporting / badges (can be added later)