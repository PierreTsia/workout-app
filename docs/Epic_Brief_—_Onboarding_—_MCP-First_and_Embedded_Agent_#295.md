# Epic Brief — Onboarding — MCP-first backend and Embedded Agent

## Summary

Unify first-party program persistence with the **MCP** tool surface (`create_program`), then replace the onboarding **AI path** one-shot with a **short Embedded Agent chat** (after the existing questionnaire) that proposes a program preview and persists **only** after explicit user confirmation. **Phase A (foundation)** is invisible to users: server-side callers invoke the same MCP contract as **External MCP Clients**. **Phase B** delivers the conversational onboarding experience, **online-only**, with **server-side quota**, **durable threads**, and **privacy-conscious retention**. Shared vocabulary and locked decisions live in **`docs/CONTEXT.md`** (GymLogic ubiquitous language). Parent issue: **GitHub #295**; strategic MCP context: **#258**; connectors work remains **#296**.

---

## Context & Problem

**Who is affected:** New users who choose the **AI program** path during onboarding, and the maintainers paying for **hosted LLM** inference and **MCP** consistency.

**Current state:**

- Onboarding flow: `Welcome → Questionnaire → PathChoice (AI / Template / Blank) → generation` — see `file:src/pages/OnboardingPage.tsx`.
- AI path uses a **closed-loop** edge function + client hook (`AIGeneratingStep`, `useGenerateProgram`) that does **not** share the same integration shape as **MCP** `create_program`.
- **Quick Workout** has a separate LLM path (`QuickWorkoutAIGeneratingStep` → `generate-workout`); this epic **prioritizes onboarding** first for funnel ROI; Quick Workout may reuse the same architectural lessons later (**not** in scope for v1 delivery of this brief unless explicitly pulled in).

**Pain points:**

| Pain | Impact |
|------|--------|
| Duplicate “program write” logic | Drift between MCP and PWA; higher bug and review cost |
| One-shot AI onboarding | Misses qualitative nuance (injuries, fuzzy goals) without a real conversation |
| Client-trusted rate limits | Abuse risk and runaway cost when using a **GymLogic-hosted** API key |
| Fragile wizard state | In-memory steps don’t support multi-tab resume or quota accounting |

**Related artifacts:**

- **`docs/CONTEXT.md`** — **Embedded Agent**, **Program draft step**, **Onboarding program commit gate**, thread lifecycle, retention, product rules.
- **`file:supabase/functions/mcp/tools/createProgram.ts`** — canonical **`create_program`** tool (incl. `dry_run`).
- **`file:supabase/functions/generate-program/index.ts`** — stack to reuse for **Program draft step** (internal to **Embedded Agent**, **not** a new MCP tool in v1).
- **`file:supabase/functions/_shared/aiQuota.ts`** — today only **`program`** and **`workout`** sources; **Embedded Agent** chat/draft metering must extend this model (Tech Plan).

---

## Phase A → Phase B cutover (strangler) — v1 proposal

This is the highest-risk coordination point; the brief locks **intent**, the Tech Plan locks **mechanics**.

| Phase | User-visible behavior | Implementation sketch |
|-------|------------------------|------------------------|
| **A shipped, B off** | Onboarding **AI path** unchanged vs today (`useGenerateProgram` / `generate-program` closed loop). | **MCP `create_program` callable from server** (tests or internal caller) proves the pipe; legacy path still primary for real users. |
| **B behind flag** | Staff / beta: **Embedded Agent** UI + thread + draft + MCP persist. | **`VITE_*` or remote flag** (e.g. PostgREST config row) — **default off** in production until criteria met. |
| **B default on** | All users on **AI path** get chat + commit gate + MCP. | Remove or flip flag; **delete or dead-code** legacy onboarding AI glue after soak. |

**Who flips the flag:** product + maintainer (not automatic). **Suggested go-live criteria (Tech Plan can refine):** Phase A merged + MCP integration tests green; Phase B E2E happy path on staging; **Privacy Policy** + in-app disclosure updated (see below); quota behavior verified.

**Explicitly not assumed:** big-bang cutover without a flag — too risky for funnel.

---

## Embedded Agent thread — brief-level schema (v1)

Working table name: **`embedded_agent_threads`** (rename only if migration naming convention differs). **RLS** on `user_id = auth.uid()`. **Partial unique:** at most one row per user with `status` ∈ (`open`, `preview_ready`).

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK |
| `user_id` | uuid | Owner |
| `status` | text / enum | `open`, `preview_ready`, `committed`, `abandoned` |
| `messages` | jsonb | Transcript |
| `locale` | text | Optional snapshot `en` \| `fr` at thread creation |
| `last_preview` | jsonb | Nullable; `create_program` `dry_run` payload or subset |
| `program_id` | uuid | Nullable until **committed** |
| `created_at`, `updated_at` | timestamptz | `updated_at` drives **7-day** lazy staleness check |
| `committed_at`, `abandoned_at` | timestamptz | Nullable |

**Staleness:** **server-side only** — on each **Edge** load/process of the thread, if `updated_at` < now − 7 days → set **`abandoned`**. **No Supabase cron required for v1.**

---

## Program draft triggers — precision

**Whichever comes first:**

1. **(A) Model-ready:** the assistant response includes a **machine-readable** signal (e.g. JSON field `ready_for_program_draft: true` or provider tool/function output) that **Edge parses and validates**. Free-text alone (“I have enough info”) is **not** sufficient — avoids ambiguity and flaky parsing.
2. **(B) User-turn cap:** count of **user** messages in the thread reaches **`N`**. **`N = 6` is a v1 heuristic**, not backed by user research — **label as post-launch tunable** (analytics, cost, drop-off).
3. **(C)** User taps **Generate my plan**.

**(B)** and **(C)** are **backstops** so UX never blocks on the model “deciding” to emit **(A)**.

---

## Quota — today vs Embedded Agent

**Existing code** (`file:supabase/functions/_shared/aiQuota.ts`): **`program`** and **`workout`** sources; **5** generations per **30 days** (regular users), **5** per **24 h** (whitelisted emails). Counted via **`ai_generation_log`**.

**This epic:** **Embedded Agent** adds **chat turns** (cheap) and **Program draft step** (expensive, `generate-program`-class). The brief does **not** lock final numbers — **Tech Plan must**:

- Either extend **`AIGenerationSource`** (e.g. `embedded_chat`, `embedded_draft`) with explicit caps, **or**
- Define how chat turns relate to **`program`** quota (risky if one chat burns the monthly program allowance).

**Recommendation for Tech Plan:** separate **per-hour / per-day caps on chat assistant turns** (abuse) from **draft + `create_program`** (align **`program`**-class quota with today’s **5/30d** unless product revises).

---

## Locale and provider prompt

Each **Embedded Agent** **Edge** request body includes **`locale`: `en` | `fr`** (from PWA **`localeAtom` / `i18n`**). The **system prompt** instructs the model (e.g. Gemini) to **respond in that language** for all assistant-visible content and for any **structured JSON** (including **ready-for-draft** flags). **Server validates** `locale` against the allowlist.

---

## Privacy & GDPR (ship blocker)

Onboarding chat can collect **health-adjacent** data (injuries, goals). **Not optional polish:** before enabling **Phase B** for general users, deliver **Privacy Policy** update + **in-app** disclosure (where data goes, retention **90d** message bodies, account deletion). Legal review if available. List remaining copy work in Tech Plan tickets.

---

## User Stories

1. As a **new user** who completed the **onboarding questionnaire** and chose the **AI program** path, I want a **short chat** that asks about injuries, nuance, and fuzzy goals, so that my **first program** reflects context the form cannot capture well.

2. As an **impatient new user** who already filled the form, I want a **“Generate my plan”** (or equivalent) control during chat, so that I can **bail out of waiting** for the assistant to declare “ready” without losing my structured answers.

3. As a **new user**, I want the chat and generated copy to follow my **app language** (FR/EN from the same source as the rest of the PWA), so that onboarding feels consistent with **GymLogic**.

4. As a **new user**, I want **GymLogic-native** copy with **no external model or assistant brand names** in the UI, so that I’m not confused by infrastructure branding.

5. As a **new user** who reaches a program preview, I want to see a **clear preview** of what will be created, so that I understand what I’m about to activate.

6. As a **new user**, I want to **explicitly confirm** before any program is persisted and activated, so that I never get a **surprise program swap** from the model alone.

7. As a **new user** who **rejects** a preview, I want to **continue in the same conversation** and try again, so that I don’t lose context or spawn confusing duplicate attempts.

8. As a **new user** on the **AI path** without network, I want a **clear online-only** message on the chat step, so that I’m not stuck on a broken spinner (**v1**: no offline Embedded Agent).

9. As a **new user** who **hits server-side chat or draft limits**, I want an **understandable message** (not raw API errors), so that I know what happened and what I can do next.

10. As a **new user** who **returns** to the AI onboarding chat (refresh or later session) while still in progress, I want my **thread to resume** when allowed, so that I don’t repeat the whole chat.

11. As a **new user** who goes **back to PathChoice** and picks **Template** or **Blank**, I want my **in-progress AI thread** to be **abandoned**, so that I don’t have **zombie** chat state (**v1**: no separate **Cancel chat** button required).

12. As a **new user** who ends up with a **program created outside** this AI thread (e.g. another tab or path), I want the app to **reconcile** and **abandon** a stray active thread, so that quotas and UI stay correct.

13. As a **new user** who **ghosts** the chat, I want stale sessions to **expire lazily** on the **server** (no immortal `open` thread), so that the system doesn’t accumulate dead state (**v1: 7-day** `updated_at` check on **Edge** thread load — **no cron**, not PWA-only — see **`docs/CONTEXT.md`**).

14. As a **new user** who hits **preview / dry-run** errors, I want **friendly** messaging and a **retry / regenerate** path, so that I’m not shown **raw MCP** or validation dumps.

15. As a **new user** who still fails after **two** consecutive preview-generation failures, I want an **escape** to **Template** or **Blank**, so that I’m **not trapped** on a broken AI path.

16. As a **Template** or **Blank** path user, I want **no Embedded Agent chat**, so that scope stays simple and I’m not forced into LLM steps I didn’t choose.

17. As a **privacy-conscious user**, I want **onboarding chat message bodies** removed after **90 days** post-commit or abandon (metadata may remain longer per policy), so that health-related text doesn’t live forever without a future **opt-in coaching memory** epic.

18. As a **user deleting my account**, I want **Embedded Agent** thread rows **removed immediately**, so that **account erasure** is not delayed by retention windows.

19. As an **operator**, I want **structured server-side logs** and **Sentry**-class signals (where applicable) on failures, with **technical detail** for debugging, so that we can fix issues without exposing internals in the UI.

20. As a **maintainer**, I want **in-app server-side** flows to call **`create_program`** over **MCP** at the **MCP Edge Function URL** with the user’s **session JWT**, so that **first-party** and **third-party** clients share **one write contract** (Phase A may ship without UI change, but the wiring must exist before Phase B completion).

21. As a **maintainer**, I want **Program draft step** logic to stay **internal** to the **Embedded Agent** (shared module with **`generate-program`** internals), **without** changing the **External MCP Client** tool registry in v1, so that we don’t expand MCP surface area before we need to.

22. As a **privacy-conscious user**, I want **Privacy Policy** and **in-app** text to describe **Embedded Agent** data (chat, retention, deletion) before the feature is broadly enabled, so that health-adjacent collection is **not** shipped on silence alone (**ship blocker** for Phase B GA).

### Success measures

| Story # | Measure |
|---------|---------|
| 5–7 | Qualitative: preview + confirm flow reviewed in UX; no auto-commit without explicit user action |
| 9 | Server returns friendly copy on quota; 429/limit path covered in tests or manual runbook |
| 10 | Same-tab refresh resumes thread; multi-tab behavior documented (single active `open` / `preview_ready` row) |
| 19 | At least one error path emits structured log fields (tool name, thread id, error kind) in Edge |
| 22 | Privacy Policy + in-app disclosure published before Phase B flag default-on for all users |

---

## Scope

**In scope:**

1. **Phase A — MCP-first foundation (Track 3)**  
   - Server-side integration so **Embedded Agent** (or its orchestration layer) calls **`create_program`** via **MCP** at **`MCP Edge Function URL`** with **`Authorization: Bearer <user JWT>`** — see **`docs/CONTEXT.md`**.  
   - **No user-visible change** required to close Phase A for end users; legacy **`generate-program`** onboarding may remain default until **Phase B** flag — see **Phase A → Phase B cutover** above.  
   - **Do not** add a second program **write** tool; **`create_program`** remains the only MCP write for program creation.

2. **Phase B — Embedded Agent onboarding (Track 1)**  
   - **AI path only** after **PathChoice**; **keep** the **onboarding questionnaire**; chat is **additive** and **qualitative**.  
   - **Program draft step** per **Program draft triggers — precision** (structured **(A)**, heuristic **`N=6` (B)**, **(C)** Generate my plan); **re-run** only on **preview reject**.  
   - **Onboarding program commit gate**: `dry_run: true` preview → user confirms → `dry_run: false`.  
   - **Postgres** table per **Embedded Agent thread — brief-level schema**.  
   - **Server-side quota** enforced in Edge; extend **`aiQuota` / `ai_generation_log`** model in Tech Plan (see **Quota — today vs Embedded Agent**).  
   - **Error UX**, **observability**, **retention** (90d message bodies; immediate delete on account deletion), **lifecycle** rules per **`docs/CONTEXT.md`**.  
   - **i18n**: FR/EN for new strings; **`locale`** on every Edge request + **system prompt** language instruction (see **Locale and provider prompt**).  
   - **Privacy Policy + in-app disclosure** before Phase B GA (**ship blocker**).

**Out of scope:**

- **Track 2** — post-onboarding “connect your Claude” / power-user MCP prompts (**#258** follow-ups).  
- **New MCP tool** exposing **Program draft step** to **External MCP Clients** in v1.  
- **Refactoring Quick Workout** LLM path to MCP in this epic (explicit follow-on).  
- **Offline** Embedded Agent, **continue coaching** long memory, **explicit extended transcript retention** without a separate consent epic.  
- **Replacing** Template/Blank flows with chat.

---

## Success Criteria

- **Qualitative:** A new user on the **AI path** can complete **questionnaire → chat → preview → confirm → active program** without seeing external assistant branding; **Template/Blank** users never see the chat.  
- **Qualitative:** **User** always controls persistence; no silent commits from the model.  
- **Qualitative:** **Quota** and **thread lifecycle** behavior match **`docs/CONTEXT.md`** (one active thread, explicit/implicit abandon, 7d staleness, regenerate in-place, 90d message retention, hard-delete on account deletion).  
- **Qualitative:** **Phase A** complete when engineering can demonstrate **server-side MCP** `create_program` calls with user JWT (tests or scripted demo); **Phase B** complete when the PWA AI onboarding path uses **Embedded Agent** + **Program draft step** + **MCP** persist (with **flag** strategy per cutover section).  
- **Numeric (engineering):** RLS policies on the new thread table; partial unique constraint (or equivalent) for **one** active onboarding thread per user.  
- **Compliance:** **Privacy Policy** + in-app disclosure shipped **before** Phase B enabled for all users (Story 22).

---

## Decisions already locked (see `docs/CONTEXT.md`)

Ubiquitous-language entries **`Embedded Agent`**, **`Embedded Agent onboarding (v1)`**, **`Embedded Agent onboarding product (v1)`**, **`Embedded Agent thread`**, **`Embedded Agent thread lifecycle`**, **`Embedded Agent thread retention`**, **`Embedded Agent quota`**, **`Onboarding program commit gate`**, **`Program draft step`**, **`Embedded Agent error handling (v1)`** — these should not be re-litigated in tickets except via explicit ADR or glossary update.

---

## Open points for Tech Plan

- Final migration table name (if not `embedded_agent_threads`); **size / truncation** strategy for **`last_preview`** JSONB.  
- Edge function layout (single orchestrator vs split); MCP JSON-RPC client reuse; **feature flag** implementation (`VITE_*` vs remote).  
- **Concrete caps:** assistant turns per hour/day, **Program draft step** calls per onboarding attempt, and relationship to existing **`program`** quota (**5 / 30d** regular today — see `file:supabase/functions/_shared/aiQuota.ts`).  
- Model tier (Gemini vs other) per step; **JSON schema** for **(A)** ready-for-draft signal; prompt versioning.  
- **Privacy / legal:** exact Policy paragraphs + in-app surfaces (settings vs first-run modal) — **workstream is blocking for GA**, wording is Tech Plan + legal.  
- Analytics event names for funnel and error paths.

---

## References

- GitHub **#295** (parent epic issue)  
- **`docs/CONTEXT.md`**  
- **`docs/PRD.md`**  
- **#258** (strategic MCP), **#296** (connectors directory)  
- `file:src/pages/OnboardingPage.tsx`  
- `file:supabase/functions/mcp/tools/createProgram.ts`  
- `file:supabase/functions/generate-program/index.ts`  
- `file:supabase/functions/_shared/aiQuota.ts`
