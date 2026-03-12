# T10 — Vitest Setup & Test Utilities

## Goal

Bootstrap the test infrastructure for the project: install all testing dependencies, configure Vitest with jsdom, and create the shared `renderWithProviders` utility. This is the foundation every subsequent test ticket depends on.

## Dependencies

None — this is the first ticket in the Quality Foundation epic.

## Scope

### Install Dependencies

Add the following dev dependencies:

| Package | Purpose |
|---|---|
| `vitest` | Test runner, native Vite integration |
| `@testing-library/react` | Component/hook testing via behavior-based queries |
| `@testing-library/jest-dom` | Custom DOM matchers (`toBeInTheDocument`, `toHaveTextContent`, etc.) |
| `@testing-library/user-event` | Realistic user interaction simulation |
| `jsdom` | Browser environment for Vitest |

### npm Scripts

Add to `package.json`:

- `"test": "vitest run"` — single CI-friendly run
- `"test:watch": "vitest"` — interactive watch mode for development

### Vitest Configuration (`vitest.config.ts`)

- Environment: `jsdom`
- `globals: true` (no need to import `describe`/`it`/`expect` per file)
- `setupFiles: ['./src/test/setup.ts']`
- `resolve.alias`: `@` → `./src` (mirrors existing Vite config)

### Global Test Setup (`src/test/setup.ts`)

- Import `@testing-library/jest-dom` for extended matchers
- `beforeEach`: reset `localStorage` mock via `localStorage.clear()`

### Test Provider Wrapper (`src/test/utils.tsx`)

`renderWithProviders(ui, options?)` wraps the component under test with:

| Provider | Config |
|---|---|
| Jotai `Provider` | Fresh `createStore()` per call — prevents atom state bleed between tests |
| `QueryClientProvider` | Fresh `QueryClient` per call — `retry: false`, `gcTime: 0` |
| `I18nextProvider` | Minimal i18next instance initialized synchronously with EN strings |
| `MemoryRouter` | For components that use `useNavigate` or `Link` — accepts optional `initialEntries` |

The function returns the same object as `@testing-library/react`'s `render`, plus the Jotai store and QueryClient for direct manipulation in tests.

### TypeScript Configuration

If needed, extend `tsconfig.app.json` to include Vitest global types so `describe`, `it`, `expect` etc. are recognized without imports. Alternatively, add a `src/test/vitest.d.ts` reference file.

## Out of Scope

- Writing any actual test cases (T11 and T12)
- Playwright setup (T13)
- CI pipeline (T14)

## Acceptance Criteria

- [ ] `npm run test` executes Vitest with zero errors (no tests yet, but the runner starts and exits cleanly)
- [ ] `npm run test:watch` starts Vitest in watch mode
- [ ] `vitest.config.ts` uses `jsdom` environment and resolves the `@` alias
- [ ] `src/test/setup.ts` imports `@testing-library/jest-dom` and clears localStorage before each test
- [ ] `src/test/utils.tsx` exports a `renderWithProviders` function that composes Jotai, QueryClient, i18next, and MemoryRouter
- [ ] A trivial smoke test (e.g., `expect(true).toBe(true)`) passes when run via `npm run test` to confirm the pipeline works end-to-end
- [ ] No lint or type-check regressions introduced

## References

- `Epic_Brief_—_Quality_Foundation_(Testing_+_CI_CD).md`
- `Tech_Plan_—_Quality_Foundation_(Testing_+_CI_CD).md` — Vitest Configuration section, Test Provider Wrapper section
