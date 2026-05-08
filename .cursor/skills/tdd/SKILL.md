---
name: tdd
description: >
  Test-driven development with a strict red-green-refactor loop, using Vitest
  for units and hooks, React Testing Library for components, and Playwright
  for end-to-end flows. Forces vertical slicing (one test → one implementation
  → repeat) and behavior-first testing through public interfaces. Trigger on
  phrases like "tdd", "red green refactor", "test first", "write a test for",
  "let's TDD this", "approche TDD".
---

# Test-Driven Development

Build features and fix bugs with a strict red-green-refactor loop. The point is not "tests existing" — it's that **the tests drive the design** and survive refactors because they bind to behavior, not implementation.

---

## Philosophy

### What good tests look like (in this repo)

Good tests verify **observable behavior through public interfaces**:

- **Pure logic** (`src/lib/*.test.ts`): exercise the function via its exported signature. Use a `make*()` factory for inputs (see `file:src/lib/progression.test.ts` for the pattern). Cover meaningful branches, not lines.
- **Hooks** (`src/hooks/*.test.ts`): use `renderHookWithProviders` from `file:src/test/utils.tsx` so Jotai store, React Query client, i18n, and router are wired. Assert on the returned values and any side effects through public mutations.
- **Components** (`src/components/.../*.test.tsx`): use `renderWithProviders` from `file:src/test/utils.tsx`. Find elements by **role + accessible name** (`getByRole("button", { name: /finish/i })`). Drive interactions with `userEvent`. Assert on what the user sees, not on internal state.
- **End-to-end** (`e2e/*.spec.ts`): Playwright on the running PWA. Same role-first selectors. One spec per user-facing flow (see `file:e2e/workout-session.spec.ts`).

### What bad tests look like

- Mocking internal collaborators ("`vi.mock` on a sibling file") — change something inside, test breaks even though behavior is identical.
- Asserting on Jotai atom internals or React Query cache shape directly.
- `getByTestId` everywhere — bypasses accessibility and brittles up on refactors.
- Snapshot tests of large component trees — they pass-through every change, providing no signal.
- Testing private helpers because "they're hard to reach from the public API". If a helper is hard to test through the interface, the **interface is the bug**, not the helper. Deepen the module instead (see the `deepen-architecture` skill).

### Anti-pattern: horizontal slicing

**DO NOT write all tests first, then all implementation.** This produces tests that bind to *imagined* behavior — they pass when behavior breaks and break when behavior is fine.

```
WRONG (horizontal):                 RIGHT (vertical, tracer bullets):
  RED:   test1, test2, test3, t4      RED→GREEN: test1 → impl1
  GREEN: impl1, impl2, impl3, i4      RED→GREEN: test2 → impl2
                                      RED→GREEN: test3 → impl3
```

Each cycle responds to what you learned from the previous one. You write the next test because the *previous* implementation revealed where the system actually bends.

---

## Workflow

### Phase 1 — Plan (no code yet)

Before writing any test:

1. **Confirm the public interface**: what is the exported function / hook / component the user (or another module) calls? If the interface is fuzzy, design it now. Aim for a small interface hiding rich implementation (deep module).
2. **List behaviors to test**, not implementation steps. A behavior is a sentence: *"PR is detected when computed 1RM exceeds the previous best"*. An implementation step is *"call epley() then compare to prevMax"* — that's not a behavior.
3. **Pick the test layer** for each behavior. Cheapest wins:
   - Pure transform → unit (Vitest in `src/lib/`)
   - State + lifecycle → hook (`renderHookWithProviders`)
   - User-facing UI → component (`renderWithProviders`)
   - Full flow across pages and persistence → e2e (Playwright)
4. **Get user approval** on the behaviors-to-test list. You can't test everything; agree on what matters.

Use `AskQuestion` if the priorities aren't obvious. Skip the question if the user has already greenlit the plan in this conversation.

### Phase 2 — Tracer bullet

Write **ONE** test for the **most important behavior**. The point is to prove the path works end-to-end.

```
RED:    write the test → run `npm test -- <file>` → verify it FAILS for the right reason
GREEN:  write the minimum code to pass → re-run → green
REFACTOR: clean it up under the green test (see Phase 4)
```

**You must actually observe and quote the failing output before writing any implementation.** Paste the failing assertion (or the "module not found" line if the symbol doesn't exist yet) into the conversation. No green code without a visible red. A test that fails because of a typo or missing import is not red, it's broken — fix the test, then verify it fails for the *right* reason.

### Phase 3 — Incremental loop

For each remaining behavior on the approved list:

```
RED:      add the next test, run it, see it fail for the right reason → quote the failure
GREEN:    minimum code to pass, re-run, see it pass
REFACTOR: improve the code under the green safety net (see Phase 4)
```

Rules of the loop:

- **One test at a time.** No batches.
- **Only enough code to pass the current test.** Don't anticipate.
- **Don't refactor while RED.** Get to green first.
- **Don't stop at green.** Green means the code *works*; refactor turns it into code you'd be proud to merge.
- **If a behavior wasn't on the approved list, stop and re-confirm** with the user before adding it.

### Phase 4 — REFACTOR — from working code to code you'd be proud of

**Refactor is not optional.** Green just means the test passes. It does not mean the code is good. Every cycle ends with an explicit refactor pass — even if the conclusion is "nothing to clean up here, and here's why".

Run this pass **after each green**, not just at the end of the ticket. The tests are your safety net; use them.

What to look for:

- **Names**: do variables, functions, and types describe intent? (`extractToolText` > `getText`, `nextId` mutable counter > unclear scope.)
- **Duplication**: same shape repeated → extract.
- **Deepen modules** — move complexity behind a smaller interface (see `deepen-architecture` skill). If the test is hard to write, the module is too shallow.
- **Functional style** per `prefer-functional-style` rule — `filter`/`map`/`reduce` instead of `for` + `push`. All intermediates `const`.
- **shadcn primitives** per `prefer-shadcn-components` rule for UI.
- **Avoid unnecessary effects** per `react-no-unnecessary-effects` rule.
- **Type safety**: replace `any` and unguarded `as` casts with type guards or zod parsing.
- **Hidden state**: module-level mutable counters, singletons, implicit globals — make dependencies explicit.
- **Comments**: if a comment explains *what* the code does, rename / restructure until the code says it itself.

Process:

1. Re-read your own diff with fresh eyes.
2. List candidate refactors out loud (in the conversation). Even if the list is empty, say so.
3. Apply one refactor at a time. Re-run the test suite **after each step**.
4. If a test breaks during a "pure refactor", either the refactor changed behavior (revert) or the test was binding to implementation (fix the test).
5. Stop when there's nothing left that would make a reviewer say "this could be cleaner".

---

## Repo-specific cheat sheet

### Run a single test

```bash
npm test -- src/lib/progression.test.ts          # one file
npm test -- -t "PR detection"                    # by test name
npm run test:watch                               # watch mode while iterating
npm run test:e2e -- workout-session              # one Playwright spec
```

### Test file conventions

| Layer | Location | Helper |
|---|---|---|
| Pure logic | `src/lib/{name}.test.ts` next to the source | none |
| Hook | `src/hooks/{useThing}.test.ts(x)` | `renderHookWithProviders` |
| Component | `src/components/.../{Thing}.test.tsx` next to the source | `renderWithProviders` |
| E2E flow | `e2e/{flow}.spec.ts` | `@playwright/test` |
| Edge function | `supabase/functions/.../{name}.test.ts` | Deno test runner |

### Factories

For non-trivial input shapes, write a `make{Thing}(overrides)` factory at the top of the test file. Reference: `file:src/lib/progression.test.ts` (`makeVolume`, `makePrescription`) and `file:src/components/workout/SessionNav.test.tsx` (`makeExercise`).

### Selecting elements (component tests)

Order of preference:

1. `getByRole("button", { name: /finish/i })` — accessible role + name
2. `getByLabelText(...)`, `getByPlaceholderText(...)` — form fields
3. `getByText(...)` — visible copy
4. `getByTestId(...)` — last resort, only when no semantic anchor exists

### Mocking

- **Network**: prefer wiring through React Query with a real `QueryClient` (already done by `renderWithProviders`). Mock at the boundary (Supabase client, fetch) only when necessary.
- **Time**: `vi.useFakeTimers()` + `vi.setSystemTime(...)`. Always `vi.useRealTimers()` in `afterEach`.
- **i18n**: already initialized in `createTestI18n()`. Use English keys (`en` bundle) for assertions.
- **Atoms**: read/write via `store.get(atom)` / `store.set(atom, ...)` exposed by `renderWithProviders` — never reach inside Jotai internals.

### When the test is hard to write

That's a signal, not a bug. Common causes and the right fix:

| Symptom | Likely cause | Fix |
|---|---|---|
| Need to mock 5 modules | Shallow modules glued together | Deepen the module — push the orchestration behind one interface |
| Test depends on render order | Effect doing work that should be derived state | Apply `react-no-unnecessary-effects` |
| Need to reach into a private helper | Public interface is too thin / wrong | Redesign the interface; the helper is the real concept |
| Long async setup | Implicit dependencies on global state | Inject the dependency via props / atom / hook arg |

If you find yourself writing a complex test, **stop and consider refactoring the code under test** before continuing. Surface the friction to the user.

---

## Per-cycle checklist

```
[ ] Test names a BEHAVIOR, not a function call
[ ] Test exercises the PUBLIC interface only
[ ] Test would survive renaming an internal helper
[ ] Test ran red BEFORE the implementation, and the failing output was OBSERVED (quoted in chat)
[ ] Implementation is minimal for THIS test
[ ] No speculative code added "while we're here"
[ ] Refactored to code I'm proud of — OR explicitly noted "no refactor needed because <reason>"
```

---

## Stop conditions

- All approved-list behaviors have a passing test **and have been through a refactor pass**.
- The user wants to ship — print a recap of what's covered and what's deliberately not, then stop.
- A behavior you discovered mid-loop changes the design materially — pause, surface it, get approval, then resume (or replan).

**Do not stop after green.** Only stop after the refactor pass is done (or you've explicitly justified skipping it for this cycle). Green is the halfway point, not the finish line.

Do **not** keep adding tests beyond the approved list "for coverage". Coverage is a downstream metric of doing TDD right, not a goal.
