# T11 — Unit Tests: epley & useWeightUnit

## Goal

Write the first unit tests in the project, covering the two pure-logic modules with the highest data-integrity risk: the Epley 1RM formula and the weight unit conversion hook.

## Dependencies

T10 — Vitest Setup & Test Utilities must be complete (test runner, setup file, `renderWithProviders`).

## Scope

### `src/lib/epley.test.ts` — computeEpley1RM

Tests for `computeEpley1RM(weight, reps)` in `file:src/lib/epley.ts`.

| Case | Input | Expected |
|---|---|---|
| Normal case | `(100, 10)` | `100 * (1 + 10/30) = 133.33` |
| Reps = 1 | `(100, 1)` | `100` (identity — no formula needed) |
| Weight = 0 | `(0, 10)` | `0` |
| Reps = 0 | `(100, 0)` | `0` |
| Reps negative | `(100, -1)` | `0` |
| Weight negative | `(-50, 10)` | `0` |
| Non-finite weight | `(NaN, 10)` | `0` |
| Non-finite reps | `(100, Infinity)` | `0` |
| Both non-finite | `(NaN, NaN)` | `0` |
| High reps | `(60, 30)` | `60 * (1 + 30/30) = 120` |

This is a pure function with no dependencies — no mocking required.

### `src/hooks/useWeightUnit.test.tsx` — useWeightUnit

Tests for the `useWeightUnit` hook in `file:src/hooks/useWeightUnit.ts`. Uses `renderHook` from `@testing-library/react` wrapped in `renderWithProviders` (or a custom wrapper providing Jotai + i18next).

**Critical constraint:** `useWeightUnit` calls `useTranslation()` internally. Tests need an `I18nextProvider` wrapper with a minimal i18next instance (already provided by `renderWithProviders` from T10).

#### `toDisplay(kg)`

| Unit | Input kg | Expected |
|---|---|---|
| `kg` | `100` | `100` (identity) |
| `lbs` | `100` | `220.462` (100 * 2.20462) |
| `lbs` | `0` | `0` |

#### `toKg(value)`

| Unit | Input | Expected |
|---|---|---|
| `kg` | `100` | `100` (identity) |
| `lbs` | `220.462` | `100` (220.462 / 2.20462) |
| `lbs` | `0` | `0` |

#### `formatWeight(kg)`

| Unit | Locale | Input kg | Expected output |
|---|---|---|---|
| `kg` | `en` | `40` | `"40 kg"` |
| `kg` | `en` | `40.5` | `"40.5 kg"` |
| `lbs` | `en` | `40` | `"88.2 lbs"` (40 * 2.20462, 1 decimal) |
| `kg` | `fr` | `40.5` | `"40,5 kg"` (comma separator) |
| `lbs` | `fr` | `40` | `"88,2 lbs"` (comma separator) |

#### Unit switching

- Default unit is `kg`
- Calling `setUnit('lbs')` and re-reading `unit` returns `'lbs'`
- `toDisplay` and `toKg` reflect the new unit after switch

### Mocking Strategy

- **`useWeightUnit` tests** require the `I18nextProvider` with a minimal synchronous i18next instance (provided by `renderWithProviders`).
- To test locale-aware formatting (FR comma vs EN period), the tests switch `i18n.language` between calls or render with different i18next configs.
- No Supabase mocking needed — these modules don't touch Supabase.

## Out of Scope

- SyncService and useBest1RM tests (T12)
- E2E tests (T13)
- `formatDate` / `formatNumber` tests from `src/lib/formatters.ts` (future coverage epic)

## Acceptance Criteria

- [ ] `src/lib/epley.test.ts` passes all cases: normal, identity (reps=1), zero weight, zero reps, negative inputs, non-finite inputs
- [ ] `src/hooks/useWeightUnit.test.tsx` passes: `toDisplay` for kg and lbs, `toKg` for kg and lbs, `formatWeight` with locale-aware decimal separator for EN and FR
- [ ] All tests pass via `npm run test`
- [ ] No lint or type-check regressions introduced

## References

- `Epic_Brief_—_Quality_Foundation_(Testing_+_CI_CD).md` — highest-risk modules: epley, useWeightUnit
- `Tech_Plan_—_Quality_Foundation_(Testing_+_CI_CD).md` — Unit Test Files table
