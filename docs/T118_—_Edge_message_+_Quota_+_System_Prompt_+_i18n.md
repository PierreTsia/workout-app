# T118 — Edge `/message` + Quota + System Prompt + i18n

## Goal

Make the chat real. Add the `/message` Edge route, the **`quota.ts`** module that enforces **40 assistant turns / hour** and **log_everything** to `ai_generation_log`, the **`prompt.ts`** module that owns the locale-aware system prompt and the ready-signal schema spec, and the chat surface (input + bubbles + typing state) inside `EmbeddedAgentChatStep`. Each user message round-trips through the model and persists in the thread; quota and locale validation are server-trusted.

Addresses Epic Brief stories: **#1**, **#3**, **#4**, **#9**, **#13**, **#19** (logging foundation).

## Mode

**AFK** — caps and prompt shape are locked in `file:docs/CONTEXT.md` and the Tech Plan.

## Slice

`edge embedded-agent (/message) → quota.ts → prompt.ts → EmbeddedAgentChatStep input/bubbles → Deno + RTL`

## Dependencies

`T117`

## Scope

### `file:supabase/functions/embedded-agent/quota.ts`

- Const `EMBEDDED_TURNS_PER_HOUR = 40`.
- `enforceTurnQuota(supabase, userId)` — counts `ai_generation_log` rows where `source = 'embedded_chat'` and `created_at >= now − 1h`. Returns `{ allowed: boolean, limit, used }`. Whitelisted users from `ai_whitelisted_users` get a higher cap (constant — propose `100/h`, confirm during impl; no runtime decision pending — falls back to `40` if unsure).
- `logBillableCall(supabase, userId, source: 'embedded_chat' | 'embedded_draft')` — single `insert into ai_generation_log` row. **Called even on model failure** (the `log_everything` rule), per `file:docs/CONTEXT.md` `Embedded Agent quota`.
- Pure-ish module — accepts the user-scoped Supabase client; no fallthrough to service client for quota reads.

### `file:supabase/functions/embedded-agent/prompt.ts`

- `buildSystemPrompt({ locale, userProfile, recentSignals })` returns the system message:
  - Locale instruction: "respond in `{locale}` for all assistant text and structured JSON".
  - GymLogic-native voice rules: no external model/assistant brand names (Story 4).
  - Scope rules: chat is for qualitative gaps (injuries / nuance / fuzzy goals) — do NOT re-ask structured fields already collected.
  - **Ready-signal schema** spec (referenced literally; T119 parses it):
    ```
    When you have enough context to draft a program, append a single line:
    READY_FOR_PROGRAM_DRAFT: {"ready":true,"summary":"<one-sentence>"}
    Free-text "I'm ready" alone is NOT sufficient.
    ```
- `buildUserContext(profile)` — flattens the questionnaire profile into a compact context block.

### `file:supabase/functions/embedded-agent/index.ts` — `/message` route

- `POST /message { content: string, locale: 'en'|'fr' }`.
- Auth via `supabase.auth.getUser()`; resolve the user's active thread (`status ∈ {open, preview_ready}`); reject 409 if `committed`/`abandoned`/missing.
- Step order:
  1. `appendMessage(thread.id, 'user', content)` — persist immediately so abandoned attempts still leave evidence.
  2. `enforceTurnQuota(userId)` — if not allowed, return 429 with friendly body `{ error: 'turn_quota_exceeded', retry_at }` (no raw message).
  3. Build prompt: `buildSystemPrompt(...)` + thread transcript (raw while `messages` is non-null).
  4. Call provider (reuse `file:supabase/functions/generate-program/gemini.ts` patterns; thin `chatGemini` wrapper if helpful — keeps the model swap surface small).
  5. **Always** `logBillableCall(userId, 'embedded_chat')` — success or failure.
  6. On failure: structured log with `error_kind`, return 502 + friendly copy.
  7. On success: `appendMessage(thread.id, 'assistant', content)`; return `{ assistant: { content, ts }, ready_for_draft: false }` (T119 flips that bit when the signal is detected).

### `file:src/components/onboarding/EmbeddedAgentChatStep.tsx`

- Replace the placeholder body from T117 with a real chat surface:
  - **shadcn `ScrollArea`** with rendered messages (assistant + user bubbles).
  - **shadcn `Input` + `Button`** for compose; on submit, posts to `/message`, optimistically appends the user bubble, shows an **assistant typing skeleton** (no token streaming — Tech Plan locks this for v1).
  - On 429: replace skeleton with a `<Alert>` showing the friendly cap copy + retry timer (Story 9).
  - On 5xx/network: same pattern, with retry button.
  - Locale value sourced from `localeAtom` / `i18n.language`; resolved client-side and passed in every payload (the server validates).
- Track first user message → fire analytics `embedded_agent_message_sent`.

### React Query — extend `file:src/hooks/useEmbeddedAgentThread.ts`

- Add `useSendMessage()` mutation; on success, append the assistant message into the thread query cache (instant render).
- On 429, surface `{ kind: 'quota', retry_at }` in the error so the UI can render the right banner.

### i18n

- Extend `onboarding.embeddedAgent` in `src/locales/{en,fr}/onboarding.json`: `composePlaceholder`, `assistantTyping`, `quotaTitle`, `quotaBody`, `errorTitle`, `errorBody`, `retryCta`.

### Tests

- **Deno** — `embedded-agent/quota_test.ts`: counts only `embedded_chat` rows in window; whitelist bumps cap; window boundary is exclusive.
- **Deno** — extend `embedded-agent/index_test.ts`: `/message` 401 without bearer, 409 on no active thread, 429 when quota saturated, 200 on happy path with both messages persisted, `logBillableCall` fires on model failure too (mock failing provider).
- **Vitest** — `prompt.test.ts`: locale instruction and ready-signal schema present in system prompt for both `en` and `fr`; no external brand strings (regex deny-list).
- **RTL** — `EmbeddedAgentChatStep.test.tsx`: typing → assistant bubble appears; 429 → friendly cap card; 5xx → error card with retry; locale FR mocks → French copy.

## Out of Scope

- No ready-signal **parsing** or `/draft` triggering — T119 owns that.
- No `last_preview` or commit (T119/T120).
- No Sentry wiring or runbook (T122).
- No Privacy disclosure (T121) — but the chat shell already has the slot above the input where T121 will inject the inline card.

## Acceptance Criteria

- [ ] `POST /message` persists user msg first, then enforces 40 turns/h via `ai_generation_log` rows tagged `embedded_chat`.
- [ ] `logBillableCall` fires on **both** success and model failure (Story 19 — the `log_everything` rule).
- [ ] System prompt includes locale instruction matching the request body's `locale`; assistant replies in that language for both `en` and `fr` smoke tests.
- [ ] No external brand names (Claude / Gemini / OpenAI) appear in user-visible UI copy or in the system prompt's user-visible portion (Story 4).
- [ ] 429 quota path renders friendly UI copy in EN and FR; never raw API error (Story 9).
- [ ] Refreshing the wizard mid-conversation resumes the transcript from the persisted thread (Story 13).
- [ ] No `/draft` or `/commit` calls happen on this slice; transcript stays in `messages` JSONB.
- [ ] Tests cover: quota enforcement, log_everything on failure, transcript append/resume, locale prompt insertion.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295.md`
- Tech Plan: `file:docs/Tech_Plan_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295_Phase_B.md`
- Glossary: `file:docs/CONTEXT.md` — `Embedded Agent quota`, `Embedded Agent onboarding product (v1)`, `Program draft step` (locale)
- Existing model client to mirror: `file:supabase/functions/generate-program/gemini.ts`
