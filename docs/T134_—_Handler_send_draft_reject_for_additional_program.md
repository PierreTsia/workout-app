# T134 — Handler `/send` + `/draft` + `/reject` for `additional_program` + observability

## Goal

Complete the server-side end-to-end flow for additional-program: extend `/send` to dispatch per-flow context loading + prompt builder + validator and persist `pending_constraint_overrides` + `change_motivation`; extend `/draft` to read + consume overrides and pass to `runProgramDraftStep`; extend `/reject` to clear pending overrides; bump observability via `purpose` log tag. After this ticket, the full additional-program server flow is reachable via curl — UI ships in T136.

Addresses Brief stories: **4** (injury motivation honored in draft), **6** (ready signal triggers draft), **8** (commit gate via MCP), **9** (atomic active-program deactivation via MCP), **14** (validator-rejection retry), **21** (`change_motivation` queryable from logs).

## Mode

**AFK** — spec is fully concrete; integration tests verify the contract.

## Slice

handler → prompt dispatch → validator → draft step (overrides) → MCP → integration tests

## Dependencies

- **T132** (per-flow validators + prompt dispatch helpers)
- **T133** (bundle builder + `/open` route persists `bundle_context`)

## Scope

### 1. `handler.ts::handleSend` — per-flow dispatch + override persistence

Replace the current onboarding-only path with a per-purpose branch:

```typescript
// Load prompt context per purpose
const promptContext = purpose === 'onboarding'
  ? await deps.loadProfile(userId)            // existing
  : active.bundle_context                      // additional-program reads stored bundle

if (purpose === 'additional_program' && !promptContext) {
  // Defensive: bundle should be there post-/open. Surface as wrong_status equivalent.
  logWarn('bundle_missing', active.id)
  return Response.json({ error: 'bundle_missing' }, { status: 409 })
}

const systemPrompt = buildSystemPromptFor(purpose, { locale, ...promptContextFields })

// ... model call ...

// Per-flow validator
const signal = parseReadySignalFor(purpose, modelOutput.content)

if (signal.validatorRejection) {
  await deps.incrementValidatorRejection(active)
  await deps.appendMessage(afterUser, 'assistant', signal.cleanContent)
  return Response.json({
    assistant: { content: signal.cleanContent, ts: new Date().toISOString() },
    ready_for_draft: false,
    validator_rejection: signal.validatorRejection,  // { reason, field? }
  })
}

// Accepted ready signal
if (purpose === 'additional_program' && signal.ready) {
  // First-accept-only for change_motivation (the first classification is canonical)
  if (!active.change_motivation && signal.motivation) {
    await deps.setChangeMotivation(active, signal.motivation)
  }
  // Always overwrite pending_constraint_overrides with the latest accepted signal
  // (latest accepted wins; if no overrides in this signal, clear any stale value)
  await deps.setPendingConstraintOverrides(active, signal.constraintOverrides ?? null)
}

await deps.appendMessage(afterUser, 'assistant', signal.cleanContent)
return Response.json({
  assistant: { content: signal.cleanContent, ts: new Date().toISOString() },
  ready_for_draft: signal.ready,
})
```

### 2. `handler.ts::handleDraft` — consume pending overrides

```typescript
// ... existing quota / profile checks ...

const constraintOverrides = purpose === 'additional_program'
  ? active.pending_constraint_overrides ?? undefined
  : undefined

const draftResult = await deps.runDraftStep({
  userId,
  locale,
  thread: active,
  profile,
  constraintOverrides,   // NEW arg
})

// ... existing failure handling ...

// On runDraftStep success, BEFORE MCP call: consume the overrides.
// Idempotent — if MCP fails and user retries, draft uses profile defaults
// (agent must re-emit overrides to re-apply).
if (purpose === 'additional_program' && constraintOverrides) {
  await deps.consumePendingOverrides(active)
}

// ... existing MCP dry_run + last_preview + status flip ...
```

### 3. `handler.ts::handleReject` — clear pending overrides

```typescript
await deps.resetForReject(active)
// NEW: clear pending overrides — rejected attempt's overrides are stale
if (purpose === 'additional_program') {
  await deps.setPendingConstraintOverrides(active, null)
}
```

Alternatively, `resetForReject` itself gains a "clear overrides too" responsibility — implementation detail.

### 4. `draft.ts::runProgramDraftStep` — accept `constraintOverrides`

```typescript
export interface DraftInput {
  userId: string
  locale: 'en' | 'fr'
  thread: Thread
  profile: UserContextProfile
  constraintOverrides?: {       // NEW (optional)
    daysPerWeek?: number
    duration?: number
    equipmentCategory?: string
    goal?: string
  }
}

export async function runProgramDraftStep(
  input: DraftInput,
  deps: DraftDeps,
): Promise<DraftResult> {
  const baseConstraints: ProgramConstraints = {
    daysPerWeek: input.profile.training_days_per_week,
    duration: input.profile.session_duration_minutes,
    equipmentCategory: profileEquipmentToCategory(input.profile.equipment),
    goal: input.profile.goal,
    experience: input.profile.experience,
    locale: input.locale,
  }
  // Overrides win; profile fills the gaps
  const constraints: ProgramConstraints = {
    ...baseConstraints,
    ...(input.constraintOverrides ?? {}),
  }
  // ... rest unchanged ...
}
```

`getEquipmentValues` + `getExerciseBounds` use the merged constraints. No new failure modes — `no_catalog` / `empty_program` fire as today (extra risk if an aggressive override shrinks the catalog past the bounds; documented in Tech Plan failure-mode table).

### 5. Observability — `log.ts` + handler log lines

```typescript
// log.ts
export interface LogEvent {
  // ... existing fields ...
  purpose?: 'onboarding' | 'additional_program'
}
```

Every `deps.log(...)` call in `handler.ts` includes `purpose` when it's resolved (i.e. after the `purpose` defaulting step at the top of the handler).

### 6. Integration tests

| Test | Coverage |
|---|---|
| Validator-rejection happy path | Mock chatModel returns ready signal with missing `motivation`; assert: `validator_rejection_count` increments, response carries `validator_rejection: { reason: 'missing' }`, no `change_motivation` persisted, conversation continues (another /send call works) |
| Validator-rejection — invalid override | Mock returns `motivation: 'plateau', constraint_overrides: { daysPerWeek: 14 }`; assert: rejection with `reason: 'invalid_override', field: 'daysPerWeek'`; counter increments |
| First-accept-only motivation | Two successive accepted signals with different motivations; assert `change_motivation` stays at the FIRST value |
| Pending overrides write | Accepted signal with `constraint_overrides: { daysPerWeek: 3 }`; assert `pending_constraint_overrides` is written |
| Pending overrides consumed at /draft | Set up thread with `pending_constraint_overrides: { daysPerWeek: 3 }`; call `/draft`; assert `runProgramDraftStep` received the override AND `pending_constraint_overrides` was cleared post-success |
| Pending overrides cleared at /reject | Set up `preview_ready` thread with overrides; call `/reject`; assert overrides cleared |
| Onboarding handler regression | Existing `/send` + `/draft` + `/reject` handler tests pass unchanged for `purpose='onboarding'` |
| Server-side end-to-end happy path | Open → send (ready signal accepted with motivation+overrides) → draft → MCP dry_run mock returns preview → status flips to `preview_ready` |

## Out of Scope

- Client-side analytics event dispatch for `embedded_agent_motivation_classification_failed` (T136 fires it from `useSendMessage.onSuccess` when `validator_rejection` is in the response).
- UI for the new flow (T136).
- `embedded_agent_quota_exhausted` event (Brief flagged as deferred — not adding in v1).
- Bundle refresh mechanism (Tech Plan: documented constraint, no implementation).
- Eval suite (Brief Story 31 — post-launch).

## Acceptance Criteria

- [x] Validator-rejection integration test passes: malformed signal → rejection → counter +1 → response payload includes `validator_rejection: { reason }` → next `/send` call succeeds without retry logic in the handler (conversation just continues).
- [x] `pending_constraint_overrides` is persisted on `/send` when validator accepts a signal with overrides; overwritten on subsequent accepts; set to NULL when an accepted signal has no overrides.
- [x] `change_motivation` is set on the FIRST accepted signal only — subsequent accepted signals with different `motivation` do NOT overwrite.
- [x] `/draft` for `purpose='additional_program'` reads `pending_constraint_overrides`, passes them to `runProgramDraftStep`, and clears the column on success.
- [x] `/reject` for `purpose='additional_program'` clears `pending_constraint_overrides`.
- [x] `runProgramDraftStep` with `constraintOverrides: { daysPerWeek: 3 }` produces a draft with 3 days (overrides win over profile's `training_days_per_week`).
- [x] All `deps.log(...)` calls in `handler.ts` include `purpose` when the request body resolves to `'additional_program'` (already covered by T131 — all log lines emitted post-`resolvePurpose`).
- [x] All existing onboarding handler tests pass unchanged (regression).
- [x] Server-side end-to-end integration test exercises full additional-program flow open → send (with motivation+overrides) → draft → MCP mocked → preview_ready.
- [ ] `e2e/onboarding.spec.ts` passes unchanged. *(deferred to PR CI)*

## Implementation Notes (post-merge)

### Files modified

- `supabase/functions/embedded-agent/draft.ts` — added `DraftConstraintOverrides` (exported) and an optional `constraintOverrides` field on `DraftInput`. `runProgramDraftStep` merges overrides on top of profile-derived constraints (overrides win; profile fills gaps). Empty `{}` is a no-op (regression-safe). Three new unit tests cover daysPerWeek override + equipmentCategory override (changes the catalog filter) + empty-overrides parity.
- `supabase/functions/embedded-agent/prompt/additional-program.ts` — **unified `AdditionalProgramBundle` with `lib/bundle.ts`** (re-exports the canonical type). The T132 placeholder shape was a forward-declaration before T133 locked the real fields; carrying two divergent types into T134 would have been a type-system landmine. Local interface deleted.
- `supabase/functions/embedded-agent/prompt/index.ts` — exposed `ChangeMotivation`, `ConstraintOverrides`, `EquipmentCategory`, `ProgramGoal` so handler.ts can consume them without reaching into the per-purpose file.
- `supabase/functions/embedded-agent/prompt/additional-program_test.ts` + `prompt/index_test.ts` — updated `makeBundle` / fixture to the T133 wire shape (`v`, `captured_at`, `BundleProgramDay { label, exercise_count, muscle_groups }`, `BundleRecentStats { window_days, total_sessions, sessions_per_week, top_muscle_groups, avg_session_duration_minutes }`).
- `supabase/functions/embedded-agent/handler.ts` — major:
  - `EmbeddedAgentDeps` gained `incrementValidatorRejection`, `setChangeMotivation`, `setPendingConstraintOverrides`, `consumePendingOverrides`.
  - `DraftStepInput` gained `constraintOverrides?: DraftConstraintOverrides`.
  - `handleSend`: 409 `bundle_missing` guard for additional_program threads with no bundle; per-purpose system prompt composition extracted into `buildSendSystemPrompt`; `parseReadySignalFor(purpose, content)` replaces the direct `parseReadySignal` call. Accepted additional-program signals route through `persistAcceptedAdditionalProgramSignal` (first-accept-only motivation, latest-wins overrides including null on no-overrides). Validator rejections bump the counter + surface `validator_rejection: { reason, field? }` in the wire payload.
  - `handleDraft`: reads `active.pending_constraint_overrides` via `coercePendingOverrides` (runtime type guard against stale rows from older clients), forwards them to `runDraftStep`, and clears the column via `consumePendingOverrides` **after** `setStatusToPreviewReady` succeeds (so an MCP failure earlier doesn't strand the user without their overrides).
  - `handleReject`: clears `pending_constraint_overrides` unconditionally on additional_program (no-op when already null).
- `supabase/functions/embedded-agent/handler_test.ts` — added stub bundle helper + 12 new T134 tests (4 send-validator + 5 send-persistence + 3 draft + 2 reject + 1 server-side e2e).
- `supabase/functions/embedded-agent/index.ts` — wired the four new persistence hooks to `threadStore.ts`'s existing helpers (added in T131). All run through the user-scoped `threadDb` client so RLS scopes writes to the row's owner.

### Decisions made under green tests

- **`bundle_missing` is a 409, not a 5xx.** The bundle is built at /open. Hitting /send without one means the client jumped routes (stale tab, hand-rolled curl). 409 forces a re-open which is the recovery path; 500 would mask a client bug as a server one.
- **First-accept-only motivation is a handler invariant.** The DB has no `change_motivation IS NULL` constraint, only a CHECK on the enum — first-write-wins is enforced in `persistAcceptedAdditionalProgramSignal` by gating on `thread.change_motivation === null`. ADR 0003 spelled this out as "motivation is canonical: the FIRST classification sticks."
- **`pending_constraint_overrides` semantics: latest-wins, null clears.** The handler ALWAYS calls `setPendingConstraintOverrides` on an accepted signal, passing `overrides ?? null`. Subsequent accepted signals with different overrides overwrite; subsequent accepted signals with no overrides clear (the user changed their mind in the chat — we respect that). The validator at /send guarantees bounds compliance, so this row is only ever populated with valid data.
- **Consume happens AFTER `setStatusToPreviewReady`.** Race-safety: MCP failure during /draft → user still has overrides for retry. Successful preview → overrides consumed so the next /draft (after a /reject + new /send turn) starts from a clean slate.
- **`coercePendingOverrides` is defensive, not validating.** The validator in /send is the source of truth for bounds. The coercion in /draft is a type guard against stale rows written by older clients (or rows hand-edited via SQL). Wrong-type / null / empty all degrade to "no overrides" rather than throwing.
- **Bundle type unification (T132 → T133).** Found and fixed during T134 wiring: T132 had a speculative `AdditionalProgramBundle` shape (with `days_per_week`, `duration_minutes`, `sessions_completed`, `most_used_exercises`) that diverged from T133's actual wire shape. Carrying two types would have manifested as a runtime mismatch the first time the handler passed `thread.bundle_context` to `buildSystemPromptFor`. Resolution: prompt module re-exports `AdditionalProgramBundle` from `lib/bundle.ts` — single source of truth.

### Test stats

- Bundle module (T133): 11 tests passing (unchanged).
- Draft module: 20 tests passing (17 original + 3 T134 overrides).
- Handler module: 64 tests passing (47 original + 5 T133 + 12 T134).
- Prompt module: 48 tests passing (existing + bundle fixture updates).
- Deno suite total: 319 tests passing (304 pre-T134).
- Vitest: 1511 tests passing (unchanged).
- `deno check supabase/functions/embedded-agent/index.ts`: clean.
- `tsc --noEmit -p tsconfig.app.json`: clean.

## References

- Epic Brief: `docs/Epic_Brief_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Stories 4, 6, 8, 9, 14, 21; Scope §2)
- Tech Plan: `docs/Tech_Plan_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Component Responsibilities — `handleSend`, `handleDraft`, `handleReject`; Wire shapes; Failure Mode Analysis)
- ADR 0003: `docs/adr/0003-additional-program-creation-shape.md`
- Existing handler: `file:supabase/functions/embedded-agent/handler.ts`
- Existing draft step: `file:supabase/functions/embedded-agent/draft.ts`
- Existing log helper: `file:supabase/functions/embedded-agent/log.ts`
