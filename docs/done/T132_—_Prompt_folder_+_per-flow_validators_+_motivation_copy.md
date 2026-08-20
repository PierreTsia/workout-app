# T132 — Prompt folder + per-flow validators + EN/FR motivation copy

## Goal

Refactor `supabase/functions/embedded-agent/prompt.ts` into a `prompt/` folder with `shared.ts` + `onboarding.ts` + `additional-program.ts` + `index.ts`. Implement the additional-program system prompt (motivation gate + bundle context injection + signal-payload-authority rule + override bounds disclosure) and its per-flow ready-signal validator (motivation vocab validation + `constraint_overrides` parsing + `v: 1` anchor + invalid-override rejection). Ship the EN/FR copy for motivation elicitation. Onboarding behavior is unchanged.

Addresses Brief stories: **4** (injury motivation), **5** (`other` as valid), **14** (validator-rejection retry path), **22** (prompt folder structure), **23** (per-flow validators independently tested), **17** (FR/EN parity).

## Mode

**AFK** — the spec is concrete (validator behavior table, payload shape, copy guidelines); a first pass of EN/FR copy can be drafted following the spec and reviewed in PR.

## Slice

prompt module split → per-flow validators → unit tests + onboarding regression

## Dependencies

- **T131** (schema in place; `validator_rejection_count` column exists for downstream consumption, even though this ticket doesn't increment it yet)

## Scope

### 1. Folder restructure

| New file | Contents |
|---|---|
| `supabase/functions/embedded-agent/prompt/shared.ts` | `LOCALE_INSTRUCTION` table (en/fr), `READY_SIGNAL_LINE` regex, `parseReadySignalCore(content) → { found, rawPayload, cleanContent }` (regex match + JSON parse + content stripping, NO field validation) |
| `supabase/functions/embedded-agent/prompt/onboarding.ts` | `buildSystemPrompt({ locale, userProfile })` (moved verbatim from `prompt.ts`), `parseReadySignal(content) → { ready, summary?, cleanContent }` (moved) |
| `supabase/functions/embedded-agent/prompt/additional-program.ts` | `buildSystemPrompt({ locale, bundle })` (NEW), `parseReadySignal(content) → { ready, cleanContent, motivation?, constraintOverrides?, validatorRejection? }` (NEW) |
| `supabase/functions/embedded-agent/prompt/index.ts` | `buildSystemPromptFor(purpose, args)` + `parseReadySignalFor(purpose, content)` dispatch helpers; re-exports of shared types |

Old `prompt.ts` is deleted; callers of `buildSystemPrompt` / `parseReadySignal` update imports to the new module paths.

### 2. Additional-program system prompt

`buildSystemPrompt({ locale, bundle })` composes:

1. **Locale instruction** (`LOCALE_INSTRUCTION[locale]` from `shared.ts`).
2. **Scope rules** — additional-program flavored. Key copy:
   - "The user already has a profile and an active program (or had one recently). Your job is to learn WHY they want a new program, then propose."
   - "Do not re-ask fields already present in the profile or active program summary below."
   - "Stay focused on building a strength training program. Politely steer back if the conversation drifts off-topic."
   - "Never reveal or namedrop the underlying model or provider; speak as the GymLogic assistant."
3. **Motivation gate rule** — explicit. Key copy:
   - "Before you emit the ready signal, you MUST elicit and classify the user's reason for wanting a new program."
   - Enumerate the 7 vocabulary values + when each applies:
     - `variety` — user wants something different but isn't dissatisfied with results
     - `plateau` — user feels stuck, no progress on a key metric/lift
     - `injury` — user has a new or recurring injury that constrains exercise selection
     - `priority_shift` — user's goal has changed (e.g. strength → hypertrophy, or vice versa)
     - `equipment_change` — user's available equipment changed (moved, joined/left a gym)
     - `return_from_break` — user has been away from training and is starting again
     - `other` — user genuinely has no specific reason; do NOT force them into a label that doesn't fit
4. **Ready signal rule** — extended payload:
   ```
   READY_FOR_PROGRAM_DRAFT: {"v":1,"ready":true,"summary":"...","motivation":"plateau","constraint_overrides":{...}}
   ```
   - `v: 1` is mandatory.
   - `motivation` is mandatory and MUST be one of the 7 vocabulary values.
   - `constraint_overrides` is optional. Valid keys: `daysPerWeek` (int 1–7), `duration` (int 30–120), `equipmentCategory` (`'bodyweight' | 'dumbbells' | 'full-gym'`), `goal` (`'strength' | 'hypertrophy' | 'endurance' | 'general_fitness'`).
   - "Emit the line at most once per conversation; subsequent turns can reaffirm in natural language. If the user's stated constraints change, emit a NEW ready signal with the updated overrides."
5. **Signal-payload-authority rule** (mitigates UX-mismatch failure mode (b) in Tech Plan):
   - "The ready signal payload is the ONLY authoritative source for constraint changes. Anything you agree to in free-text chat MUST be reflected in `constraint_overrides`, or it will NOT affect the draft."
6. **Override bounds disclosure**:
   - Lists `daysPerWeek: 1-7`, `duration: 30-120 minutes`, equipment enum, goal enum.
   - "Out-of-bounds values will be rejected by the validator and you will be asked to re-emit."
7. **Bundle context injection** — `bundle.profile` + `bundle.active_program` + `bundle.recent_stats` rendered as structured context. Conditional clause for `active_program: null`:
   - "The user does not have an active program right now — open with: *'You don't have an active program right now — what kind of training plan are you looking to build?'* Do not fabricate references to 'your current plan' or 'your recent training' as if a program existed."

Returns the composed string.

### 3. Additional-program ready-signal validator

`parseReadySignal(content)`:

1. Run `parseReadySignalCore(content)` to extract `{ found, rawPayload, cleanContent }`.
2. If `!found`: return `{ ready: false, cleanContent }` (no signal at all — normal turn).
3. If `rawPayload` is malformed JSON: return `{ ready: false, cleanContent, validatorRejection: { reason: 'malformed_json' } }`.
4. Validate `motivation`:
   - Missing → `{ validatorRejection: { reason: 'missing' } }`
   - Not in vocab → `{ validatorRejection: { reason: 'invalid_value' } }`
5. Parse `constraint_overrides` (optional):
   - For each known field: if value is out of bounds (per table in Tech Plan), return `{ validatorRejection: { reason: 'invalid_override', field } }`.
   - Unknown keys: silently drop (forward-compat for v2).
6. On full success: return `{ ready: true, cleanContent, motivation, constraintOverrides }` (constraintOverrides may be `undefined` or a sanitized object).

The validator is PURE — it does NOT increment counters, fire events, or persist anything. Those are caller (handler) responsibilities, owned by T134.

### 4. EN/FR copy

Land draft copy under:

| Location | Keys |
|---|---|
| Inline in `additional-program.ts` (system prompt strings — not user-facing translation) | Scope rules, motivation gate copy, signal rules, override bounds — both EN and FR variants selected via `locale` |

Per the project convention, system prompt strings live in TS source (not JSON locale files) because they're authored as code-adjacent product copy.

### 5. Tests

| Test file | Coverage |
|---|---|
| `prompt/shared_test.ts` | `parseReadySignalCore` happy/malformed cases |
| `prompt/onboarding_test.ts` | `buildSystemPrompt` golden output; `parseReadySignal` accepts legacy `{ ready, summary }` shape (regression) |
| `prompt/additional-program_test.ts` | `buildSystemPrompt` golden output for both `active_program: present` and `active_program: null`; `parseReadySignal` 7 cases: happy (no overrides), happy (with overrides), missing motivation, invalid motivation, malformed JSON, out-of-bounds `daysPerWeek`, unknown override key (dropped) |
| `prompt/index_test.ts` | Dispatch helpers route correctly per `purpose` |

## Out of Scope

- Wiring the validators into the handler `/send` route (T134 owns dispatch + counter increment + event response payload).
- Bundle builder (T133 owns; this ticket assumes `bundle` is passed in as a parameter shape).
- UI rendering of motivation prompts (no UI in this ticket).
- Eval suite for motivation classification quality (Brief Story 31 — post-launch).
- Migration of `prompt_test.ts` test fixtures beyond the split — if the existing test file is monolithic, mirror its cases into the per-flow test files rather than mass-rewriting.

## Acceptance Criteria

- [x] `prompt/` folder exists with `shared.ts` + `onboarding.ts` + `additional-program.ts` + `index.ts`; old `prompt.ts` is deleted.
- [x] `buildSystemPromptFor({ purpose: 'onboarding', locale, userProfile })` returns a string byte-equivalent to the legacy `buildSystemPrompt({ locale, userProfile })` output. — Locked by `prompt/index_test.ts`.
- [x] `parseReadySignalFor('onboarding', content)` produces the same result as the legacy `parseReadySignal(content)` for all existing test fixtures. — Existing 16 onboarding regression tests survive under `prompt/onboarding_test.ts`.
- [x] `parseReadySignalFor('additional_program', content)` accepts a valid signal with `motivation: 'plateau'` (no overrides). — `prompt/additional-program_test.ts`.
- [x] Validator rejects ready signal with missing `motivation` → `validatorRejection: { reason: 'missing' }`.
- [x] Validator rejects ready signal with `motivation: 'badvalue'` → `validatorRejection: { reason: 'invalid_value' }`.
- [x] Validator rejects ready signal with `constraint_overrides: { daysPerWeek: 14 }` → `validatorRejection: { reason: 'invalid_override', field: 'daysPerWeek' }`. — Plus equivalents for `duration` and `equipmentCategory`.
- [x] Validator silently drops unknown override keys (forward-compat for v2) — returns `{ ready: true, ..., constraintOverrides: { ...knownKeysOnly } }`.
- [x] `buildSystemPromptFor({ purpose: 'additional_program', locale: 'en', bundle: { active_program: null, ... } })` includes the empty-active-program greeting clause.
- [x] `buildSystemPromptFor({ purpose: 'additional_program', locale: 'fr', ... })` returns French copy.
- [ ] `e2e/onboarding.spec.ts` passes unchanged. — **deferred to PR CI**; the onboarding system prompt + validator are byte-equivalent to pre-T132 behavior under the new file layout.

## Implementation Notes (delivered)

**Folder structure**
- `prompt/shared.ts` — `LOCALE_INSTRUCTION`, `READY_SIGNAL_LINE`, `parseReadySignalCore`, `UserContextProfile`.
- `prompt/onboarding.ts` — `buildSystemPrompt`, `parseReadySignal`, `buildUserContext`, `ReadySignalResult` (moved verbatim from `prompt.ts`).
- `prompt/additional-program.ts` — `buildSystemPrompt(locale, bundle)`, `parseReadySignal(content)`, the 7-value `ChangeMotivation` vocab, `ConstraintOverrides`, `ValidatorRejection`, `AdditionalProgramBundle`.
- `prompt/index.ts` — back-compat re-exports for the onboarding surface (so `handler.ts` keeps working) PLUS the new dispatchers `buildSystemPromptFor(args)` / `parseReadySignalFor(purpose, content)`. The dispatcher signature is a discriminated union so the compiler enforces "pass `userProfile` for onboarding and `bundle` for additional_program".
- Old `prompt.ts` deleted.

**Dispatcher shape decision.** `buildSystemPromptFor` takes a single discriminated-union arg `{ purpose, locale, ... }` rather than `(purpose, args)` so TypeScript can narrow the rest of the bag per purpose. This is the only shape change vs the ticket's stated `(purpose, args)` signature.

**Signal-payload-authority rule** is in both EN and FR prompts (UX-mismatch failure mode mitigation from the Tech Plan). Locked by an `assertMatch` regex that tolerates ordering ("constraint_overrides ... authoritative" or vice versa).

**Validator behavior matrix** — 11 test cases covering: no-signal, valid-with-motivation-only, valid-with-overrides, missing-motivation, invalid-motivation, malformed-JSON, out-of-bounds daysPerWeek, out-of-bounds duration, unknown equipmentCategory, unknown override keys silently dropped, ready:false JSON (model said "not yet" via JSON — treated as a normal no-signal turn, no rejection).

**Brand-free.** The "no Claude/Gemini/GPT/OpenAI/Anthropic" lock from the legacy onboarding prompt is replicated on the additional-program prompt (both locales).

**Safety net green:**
- 288/288 Deno tests pass (was 255 pre-T132 — added 5 shared + 23 additional + 5 dispatch).
- 1511/1511 Vitest tests pass (unchanged).
- `deno check` clean on `embedded-agent/index.ts`.
- `tsc --noEmit -p tsconfig.app.json` clean.

The handler-side wiring of the additional-program validator + counter increment + retry mechanic is **T134**'s responsibility. T132 ships PURE prompt + validator modules.

## References

- Epic Brief: `docs/Epic_Brief_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Stories 4, 5, 14, 17, 22, 23; Decisions locked § ADR 0003 §3-5)
- Tech Plan: `docs/Tech_Plan_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Data Model — Ready-signal payload + validator table; Component Responsibilities — additional-program prompt + validator)
- ADR 0003: `docs/adr/0003-additional-program-creation-shape.md`
- Existing prompt: `file:supabase/functions/embedded-agent/prompt.ts`
