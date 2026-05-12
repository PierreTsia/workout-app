# T136 — Cutover: `CreateProgramPage` AI branch + legacy delete + new analytics + E2E

## Goal

Make the additional-program flow visible end-to-end. Replace `CreateProgramPage`'s legacy AI branch (`ai-constraints` → `ai-generating` → `ai-preview`) with the relocated Embedded Agent components consuming `purpose='additional_program'`. Delete the legacy AI code (`useAIGenerateProgram`, `AIConstraintStep`, `AIProgramPreviewStep`, `AIGeneratingStep` under `create-program/`). Land FR + EN i18n copy for the new flow. Wire the new analytics events (`embedded_agent_preview_committed`, `embedded_agent_motivation_classification_failed`) and extend existing event payloads with `purpose`. Ship the Playwright E2E that exercises the full path.

This is the convergence ticket — the visible tracer bullet that lights up everything T130–T135 built underneath.

Addresses Brief stories: **1** (chat surface), **7** (same preview as onboarding), **8** (MCP commit gate), **9** (atomic active-program deactivation), **10** (resume), **11** (concurrent onboarding + additional-program threads), **12** (quota cap copy), **13** (offline), **17** (FR/EN parity), **19** (`purpose` payload on existing events), **20** (new `embedded_agent_preview_committed` event with `motivation`), **28** (i18n keys under `create-program` namespace), **30** (legacy delete).

## Mode

**AFK** — final UI copy can be drafted from the spec; user reviews at PR time.

## Slice

page wiring → component swap → hook calls → handler → MCP → analytics → E2E

## Dependencies

- **T134** (server-side flow complete for additional-program)
- **T135** (components relocated + parameterized)

## Scope

### 1. `CreateProgramPage.tsx` AI branch swap

Replace the step type union and the AI step renders:

```diff
- type Step = 'path-choice' | 'ai-constraints' | 'ai-generating' | 'ai-preview' | 'template-choice' | 'blank'
+ type Step = 'path-choice' | 'ai-chat' | 'ai-generating' | 'ai-preview' | 'template-choice' | 'blank'
```

```diff
- {step === 'ai-constraints' && <AIConstraintStep ... />}
- {step === 'ai-generating' && <AIGeneratingStep ... />}
- {step === 'ai-preview' && <AIProgramPreviewStep ... />}
+ {step === 'ai-chat' && (
+   <EmbeddedAgentChatStep
+     purpose="additional_program"
+     i18nNamespace="create-program"
+     onReadyForDraft={() => setStep('ai-generating')}
+     onAbandon={() => setStep('path-choice')}
+   />
+ )}
+ {step === 'ai-generating' && (
+   <EmbeddedAgentGeneratingStep
+     purpose="additional_program"
+     i18nNamespace="create-program"
+     onDraftReady={() => setStep('ai-preview')}
+     onError={() => setStep('ai-chat')}
+   />
+ )}
+ {step === 'ai-preview' && (
+   <EmbeddedAgentPreviewStep
+     purpose="additional_program"
+     i18nNamespace="create-program"
+     onCommit={(programId) => navigate('/library/programs')}
+     onReject={() => setStep('ai-chat')}
+   />
+ )}
```

Step progression: `path-choice` → (user picks AI) → `ai-chat` → (`useGenerateDraft` fires + status flips to `preview_ready`) → `ai-generating` (transient) → `ai-preview` → (commit) → navigate to `/library/programs`.

Thread `.status` drives chat ↔ preview transitions; `ai-generating` is a transient UI state during the `/draft` mutation, not a thread status.

### 2. Legacy code deletion

Delete:

| File | Verification |
|---|---|
| `src/hooks/useAIGenerateProgram.ts` | `rg "useAIGenerateProgram" src/` returns empty |
| `src/components/create-program/AIConstraintStep.tsx` | `rg "AIConstraintStep" src/` returns empty |
| `src/components/create-program/AIProgramPreviewStep.tsx` | `rg "AIProgramPreviewStep" src/` returns empty |
| `src/components/create-program/AIGeneratingStep.tsx` | `rg "AIGeneratingStep" src/` returns empty (or only matches in `embedded-agent/EmbeddedAgentGeneratingStep` which is the relocated/renamed component — verify no conflict) |
| Sibling test files | Deleted alongside their source |

**Verify before each deletion**: `rg "<symbol>" src/` returns no callers. If anything outside this epic still imports them, surface and decide (likely a sloppy import to clean up).

**NOT deleted in this epic**: `supabase/functions/generate-program/` (sequenced with #342 per Brief).

### 3. i18n keys — `src/locales/{en,fr}/create-program.json`

Add under a new `embedded_agent` sub-namespace:

| Key | EN draft | FR draft |
|---|---|---|
| `embedded_agent.chat.input_placeholder` | "Tell me why you want a new program…" | "Dites-moi pourquoi vous voulez un nouveau programme…" |
| `embedded_agent.chat.send_button` | "Send" | "Envoyer" |
| `embedded_agent.chat.generate_button` | "Generate my plan" | "Générer mon plan" |
| `embedded_agent.chat.abandon_link` | "Cancel and start over" | "Annuler et recommencer" |
| `embedded_agent.chat.quota_turn_exceeded` | "You've reached the chat limit for today. Try again tomorrow or pick a template." | "Vous avez atteint la limite de chat pour aujourd'hui. Réessayez demain ou choisissez un modèle." |
| `embedded_agent.generating.heading` | "Building your program…" | "Construction de votre programme…" |
| `embedded_agent.generating.quota_draft_exceeded` | "Daily generation limit reached. Try again tomorrow." | "Limite quotidienne de génération atteinte. Réessayez demain." |
| `embedded_agent.generating.quota_program_exceeded` | "Monthly program limit reached." | "Limite mensuelle de programmes atteinte." |
| `embedded_agent.preview.heading` | "Review your program" | "Vérifiez votre programme" |
| `embedded_agent.preview.confirm_button` | "Create program" | "Créer le programme" |
| `embedded_agent.preview.regenerate_button` | "Regenerate" | "Régénérer" |
| `embedded_agent.preview.commit_failed` | "Couldn't save your program. Try again." | "Impossible d'enregistrer votre programme. Réessayez." |
| `embedded_agent.bundle_summary.active_chip` | "Currently on {{program_name}} · {{sessions_per_week}} sessions/wk" | "Programme actuel : {{program_name}} · {{sessions_per_week}} séances/sem." |

Final copy is reviewed in PR — defaults above ship if no edits requested.

### 4. Analytics — existing event payload extension

In `EmbeddedAgentChatStep` (`useSendMessage`), `EmbeddedAgentGeneratingStep` (`useGenerateDraft`), `EmbeddedAgentPreviewStep` (`useRejectPreview`):

Existing `trackEvent.mutate({ event: 'embedded_agent_*', payload: { ... } })` calls extend their payload with:

```typescript
purpose: 'onboarding' | 'additional_program'
```

Pass `purpose` from props (component already has it from T135's prop addition).

### 5. Analytics — NEW events

**`embedded_agent_preview_committed`** — fired from `useCommitPreview.onSuccess`:

```typescript
trackEvent.mutate({
  event: 'embedded_agent_preview_committed',
  payload: {
    thread_id: data.thread_id,        // surfaced from /commit response (may need handler tweak if not already)
    program_id: data.program_id,
    purpose,
    motivation: data.motivation ?? undefined,  // only set for additional_program
    locale,
  },
})
```

If `/commit` response doesn't already carry `thread_id` + `motivation`, extend it in this ticket's handler patch (small diff).

**`embedded_agent_motivation_classification_failed`** — fired from `useSendMessage.onSuccess` when response carries `validator_rejection`:

```typescript
onSuccess: (data) => {
  // ... existing message append ...
  if (data.validator_rejection) {
    trackEvent.mutate({
      event: 'embedded_agent_motivation_classification_failed',
      payload: {
        thread_id: thread.thread_id,
        purpose,
        rejection_reason: data.validator_rejection.reason,
        field: data.validator_rejection.field,  // only set for invalid_override
        locale,
      },
    })
  }
}
```

### 6. New Playwright E2E — `e2e/create-program-ai.spec.ts`

Mirror `e2e/quick-workout-ai.spec.ts` structure. Mock the `embedded-agent` endpoint with `page.route('**/embedded-agent', ...)` and hand-code thread transitions:

1. Seed a user with profile + active program + 4w training history.
2. Navigate to `/library/programs/create`.
3. Pick AI path.
4. Verify chat surface renders with `bundle_summary` chip (active program name + sessions/wk).
5. Send user message → mocked Edge returns assistant content (no ready signal yet).
6. Send second user message → mocked Edge returns assistant content with valid ready signal (`motivation: 'plateau'`).
7. Click "Generate my plan" → mocked `/draft` returns `preview_ready` + `last_preview`.
8. Verify preview screen renders the draft.
9. Click "Create program" → mocked `/commit` returns `program_id`.
10. Verify navigation to `/library/programs` AND the home shell shows the new active program.

Gemini and MCP are mocked end-to-end. No real provider calls.

### 7. `OnboardingPage.tsx` — extend existing event payloads

Update existing `useSendMessage` / `useGenerateDraft` / `useRejectPreview` consumers in onboarding to pass `purpose='onboarding'` (already done in T131 hook API; verify the analytics event payloads also include `purpose: 'onboarding'`).

`onboarding`'s existing `program_created` event keeps firing — no change. Additional-program does NOT fire `program_created` (it uses the new `embedded_agent_preview_committed`).

## Out of Scope

- Deletion of `supabase/functions/generate-program/` (sequenced with #342 per Brief).
- Ops runbook (T137 owns).
- `embedded_agent_quota_exhausted` event (Brief flagged as deferred).
- Bundle-summary chip pixel-perfect styling — placeholder from T135 is upgraded to match design but no Figma round-trip in scope.
- Cap-hit dashboards / monitoring queries (T137 includes documented SQL snippets; no dashboard tooling).
- `create_program_step_completed` event family for funnel parity with onboarding (Brief default: no for v1).

## Acceptance Criteria

- [ ] `CreateProgramPage.tsx` step types: `'path-choice' | 'ai-chat' | 'ai-generating' | 'ai-preview' | 'template-choice' | 'blank'`. The legacy `'ai-constraints'` step type is removed.
- [ ] AI branch renders relocated `EmbeddedAgent*Step` components with `purpose='additional_program'` + `i18nNamespace='create-program'`.
- [ ] Template + Blank branches are unchanged.
- [ ] Deleted files (verified with `rg`): `src/hooks/useAIGenerateProgram.ts`, `src/components/create-program/AIConstraintStep.tsx`, `src/components/create-program/AIProgramPreviewStep.tsx`, `src/components/create-program/AIGeneratingStep.tsx`, + their test files.
- [ ] `src/locales/{en,fr}/create-program.json` includes `embedded_agent.*` keys per the table above.
- [ ] Existing `embedded_agent_message_sent`, `embedded_agent_draft_triggered`, `embedded_agent_preview_rejected` events carry `purpose` in their payloads (both onboarding and additional-program firings).
- [ ] NEW event `embedded_agent_preview_committed` fires from `useCommitPreview.onSuccess` with `{ thread_id, program_id, purpose, motivation?, locale }`.
- [ ] NEW event `embedded_agent_motivation_classification_failed` fires from `useSendMessage.onSuccess` when the response payload carries `validator_rejection`, with `{ thread_id, purpose, rejection_reason, field?, locale }`.
- [ ] `e2e/create-program-ai.spec.ts` passes (full path-choice → AI → chat → motivation → ready → draft → preview → commit happy path, mocked Gemini + MCP).
- [ ] `e2e/onboarding.spec.ts` passes unchanged (regression).
- [ ] Post-commit, the home shell shows the new active program (`useCommitPreview.onSuccess` cache invalidations work for additional-program just as for onboarding).
- [ ] `npx tsc --noEmit` produces no errors.

## References

- Epic Brief: `docs/Epic_Brief_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Stories 1, 7-13, 17, 19, 20, 28, 30; Scope §7-11)
- Tech Plan: `docs/Tech_Plan_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Component Architecture — `CreateProgramPage.tsx`; Analytics events table; Deleted Files; E2E mock strategy)
- ADR 0003: `docs/adr/0003-additional-program-creation-shape.md`
- Existing wizard: `file:src/pages/CreateProgramPage.tsx`
- Existing legacy AI hook: `file:src/hooks/useAIGenerateProgram.ts`
- Existing legacy AI components: `file:src/components/create-program/AIConstraintStep.tsx`, `file:src/components/create-program/AIProgramPreviewStep.tsx`, `file:src/components/create-program/AIGeneratingStep.tsx`
- Companion E2E pattern: `file:e2e/quick-workout-ai.spec.ts`
- Regression gate E2E: `file:e2e/onboarding.spec.ts`
