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

- [ ] Files moved via `git mv` (history preserved); test files moved alongside.
- [ ] `rg "src/components/onboarding/EmbeddedAgent" src/` returns empty (or only matches in deleted-test fixtures).
- [ ] `rg "src/components/embedded-agent/EmbeddedAgent" src/` returns the new component paths.
- [ ] Each relocated component accepts `purpose: 'onboarding' | 'additional_program'` + `i18nNamespace: 'onboarding' | 'create-program'` as required props.
- [ ] `OnboardingPage.tsx` imports from `@/components/embedded-agent/*` and passes `purpose='onboarding'` + `i18nNamespace='onboarding'` to every consumer.
- [ ] Relocated component unit tests pass (existing tests + the props are mock-injected with onboarding values).
- [ ] `e2e/onboarding.spec.ts` passes unchanged — non-negotiable regression gate.
- [ ] `npx tsc --noEmit` produces no errors.

## References

- Epic Brief: `docs/Epic_Brief_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Stories 18, 27; Decisions locked § "Component reuse strategy")
- Tech Plan: `docs/Tech_Plan_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Component Architecture — relocated component responsibilities; Component prop API decision)
- ADR 0003: `docs/adr/0003-additional-program-creation-shape.md`
- Existing files: `file:src/components/onboarding/EmbeddedAgentChatStep.tsx`, `file:src/components/onboarding/EmbeddedAgentPreviewStep.tsx`, `file:src/components/onboarding/EmbeddedAgentGeneratingStep.tsx`
- `file:src/pages/OnboardingPage.tsx`
