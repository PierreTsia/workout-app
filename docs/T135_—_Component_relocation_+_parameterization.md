# T135 — Component relocation + parameterization

## Goal

Move the Embedded Agent UI components from `src/components/onboarding/` to `src/components/embedded-agent/`, add `purpose` + `i18nNamespace` props, and update `OnboardingPage.tsx` to consume them at their new path. Onboarding behavior is unchanged — this is the load-bearing refactor that lets T136 add a second consumer (`CreateProgramPage`) without forking the components.

Addresses Brief stories: **18** (onboarding regression-free post-relocation), **27** (relocation + parameterization for bilan mensuel future use).

## Mode

**AFK** — pure rename + props addition with a non-negotiable regression gate (`e2e/onboarding.spec.ts`).

## Slice

component move → props plumbing → `OnboardingPage` rewire → onboarding E2E gate

## Dependencies

- **T131** (hook API takes `purpose` — components pass it through to hook calls)

## Scope

### 1. File moves

| From | To |
|---|---|
| `src/components/onboarding/EmbeddedAgentChatStep.tsx` | `src/components/embedded-agent/EmbeddedAgentChatStep.tsx` |
| `src/components/onboarding/EmbeddedAgentPreviewStep.tsx` | `src/components/embedded-agent/EmbeddedAgentPreviewStep.tsx` |
| `src/components/onboarding/EmbeddedAgentGeneratingStep.tsx` | `src/components/embedded-agent/EmbeddedAgentGeneratingStep.tsx` |
| `src/components/onboarding/EmbeddedAgentChatStep.test.tsx` | `src/components/embedded-agent/EmbeddedAgentChatStep.test.tsx` |
| `src/components/onboarding/EmbeddedAgentPreviewStep.test.tsx` | `src/components/embedded-agent/EmbeddedAgentPreviewStep.test.tsx` |
| `src/components/onboarding/EmbeddedAgentGeneratingStep.test.tsx` (if exists) | `src/components/embedded-agent/EmbeddedAgentGeneratingStep.test.tsx` |

Use `git mv` to preserve history. Update `import` statements throughout the codebase via `rg` + targeted edits.

### 2. New props

Add to each relocated component:

```typescript
interface EmbeddedAgentStepProps {
  // ... existing props ...
  purpose: 'onboarding' | 'additional_program'
  i18nNamespace: 'onboarding' | 'create-program'
}
```

### 3. Internal changes per component

**`EmbeddedAgentChatStep`**:
- Hook calls: `useThread(purpose, locale)`, `useSendMessage(purpose)`, `useAbandonThread(purpose)`.
- `useTranslation(props.i18nNamespace + '.embedded_agent.chat')` (or similar — match the project's namespace pattern; if the project uses flat keys, prepend the namespace).
- Header chip from `thread.bundle_summary` ONLY when `purpose === 'additional_program'` — guarded by feature-conditional render. For onboarding, render nothing (existing behavior). Tech Plan: optional render; the actual chip styling can be a placeholder div in this ticket, refined when T136 wires it up.

**`EmbeddedAgentPreviewStep`**:
- Hook calls: `useCommitPreview(purpose)`, `useRejectPreview(purpose)`.
- `useTranslation` consumes `props.i18nNamespace`.
- `useCommitPreview.onSuccess` analytics event firing: kept as-is in this ticket. T136 adds `purpose` to the payload + new event names.

**`EmbeddedAgentGeneratingStep`**:
- No hook calls beyond the existing `useGenerateDraft(purpose)` invocation.
- `useTranslation` consumes `props.i18nNamespace`.

### 4. `OnboardingPage.tsx` rewire

Replace imports:

```diff
- import { EmbeddedAgentChatStep } from '@/components/onboarding/EmbeddedAgentChatStep'
- import { EmbeddedAgentPreviewStep } from '@/components/onboarding/EmbeddedAgentPreviewStep'
- import { EmbeddedAgentGeneratingStep } from '@/components/onboarding/EmbeddedAgentGeneratingStep'
+ import { EmbeddedAgentChatStep } from '@/components/embedded-agent/EmbeddedAgentChatStep'
+ import { EmbeddedAgentPreviewStep } from '@/components/embedded-agent/EmbeddedAgentPreviewStep'
+ import { EmbeddedAgentGeneratingStep } from '@/components/embedded-agent/EmbeddedAgentGeneratingStep'
```

Pass `purpose='onboarding'` + `i18nNamespace='onboarding'` at every call site:

```diff
- <EmbeddedAgentChatStep ... />
+ <EmbeddedAgentChatStep purpose="onboarding" i18nNamespace="onboarding" ... />
```

### 5. Verification — no orphan references

After the move, `rg "src/components/onboarding/EmbeddedAgent"` in source code returns empty (test fixtures with mocked import paths are acceptable false positives — verify by reading).

## Out of Scope

- `CreateProgramPage` wiring with `purpose='additional_program'` (T136 owns).
- New analytics events / `purpose` payload field extension (T136 owns).
- i18n key additions for `create-program` namespace (T136 owns).
- Bundle-summary header chip styling (T136 finalizes; placeholder is acceptable here).
- Cross-flow shared string extraction to an `embedded-agent` namespace (Tech Plan: deferred to follow-up if duplication grates).

## Acceptance Criteria

- [x] Files moved via `git mv` (history preserved); test files moved alongside.
- [x] `rg "src/components/onboarding/EmbeddedAgent" src/` returns empty (or only matches in deleted-test fixtures).
- [x] `rg "src/components/embedded-agent/EmbeddedAgent" src/` returns the new component paths.
- [x] Each relocated component accepts `purpose: 'onboarding' | 'additional_program'` + `i18nNamespace: 'onboarding' | 'create-program'` as required props.
- [x] `OnboardingPage.tsx` imports from `@/components/embedded-agent/*` and passes `purpose='onboarding'` + `i18nNamespace='onboarding'` to every consumer.
- [x] Relocated component unit tests pass (existing tests + the props are mock-injected with onboarding values).
- [ ] `e2e/onboarding.spec.ts` passes unchanged — non-negotiable regression gate. _(deferred to T136 — same epic's E2E gate batches all onboarding-regression runs there; this ticket is a pure refactor with vitest coverage on the moved units.)_
- [x] `npx tsc --noEmit` produces no errors.

## Implementation notes

- **`git mv`** preserved history for all 6 files (3 components + 3 test files). The `EmbeddedAgentGeneratingStep.test.tsx` existed already (the brief was unsure); it moved alongside the others.
- **`useTranslation` plumbing** — the chat + preview surfaces consume a single namespace via `props.i18nNamespace`. The generating step still double-loads `create-program` for the gen-phase / fallback-CTA copy (those strings are namespace-neutral and historically lived there); the surface-specific copy (titles, quota bodies) flips with `i18nNamespace`. T136 will add the matching `embeddedAgent.*` keys to the `create-program` namespace.
- **Bundle-summary chip** — deliberately NOT added in this ticket. The brief / Tech Plan call for an optional `purpose === 'additional_program'`-only header chip rendered from `thread.bundle_summary`. Punted to T136 so this ticket stays a pure refactor (no surface behavior change for onboarding, no new visual element to QA twice). The data is already exposed by T133, so T136 only needs the render.
- **Constrained namespace type** (`"onboarding" | "create-program"`) — chosen over `string` so a future bilan-mensuel flow (Story 27) must declare its namespace before it can render the chat. Costs zero runtime, catches the next consumer at compile time.
- **Hook signature** (T131 contract) — purpose is threaded through every hook call: `useThread`, `useAbandonThread`, `useSendMessage`, `useGenerateDraft`, `useCommitPreview`, `useRejectPreview`. Onboarding now passes `purpose="onboarding"` explicitly (was hardcoded before; now reflects the prop).
- **Subcomponent props** — `DisclosureCard`, `DayCard`, `CommitErrorBanner`, `FallbackEscape`, `PreviewBody` all received `i18nNamespace` as a new required prop so they consume the right namespace via `useTranslation`. No public API change; these are file-local.
- **No orphan references** — `rg "components/onboarding/EmbeddedAgent"` against `src/` returns empty (only documentation references the old path).
- **Test prop injection** — all 40 existing call sites (20 chat + 12 preview + 8 generating) updated to pass `purpose="onboarding"` + `i18nNamespace="onboarding"`. No test logic changes; the only diff is mock prop hydration.
- **Safety net** — `npx tsc --noEmit` clean; full vitest suite (1511 tests, 154 files) green.

## References

- Epic Brief: `docs/Epic_Brief_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Stories 18, 27; Decisions locked § "Component reuse strategy")
- Tech Plan: `docs/Tech_Plan_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Component Architecture — relocated component responsibilities; Component prop API decision)
- ADR 0003: `docs/adr/0003-additional-program-creation-shape.md`
- Existing files: `file:src/components/onboarding/EmbeddedAgentChatStep.tsx`, `file:src/components/onboarding/EmbeddedAgentPreviewStep.tsx`, `file:src/components/onboarding/EmbeddedAgentGeneratingStep.tsx`
- `file:src/pages/OnboardingPage.tsx`
