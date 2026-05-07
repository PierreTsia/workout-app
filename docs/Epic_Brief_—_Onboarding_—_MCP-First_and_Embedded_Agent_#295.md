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

13. As a **new user** who **ghosts** the chat, I want stale sessions to **expire lazily** (no immortal `open` thread), so that the system doesn’t accumulate dead state (**v1 default: 7-day inactivity** abandonment on next touch — see **`docs/CONTEXT.md`**).

14. As a **new user** who hits **preview / dry-run** errors, I want **friendly** messaging and a **retry / regenerate** path, so that I’m not shown **raw MCP** or validation dumps.

15. As a **new user** who still fails after **two** consecutive preview-generation failures, I want an **escape** to **Template** or **Blank**, so that I’m **not trapped** on a broken AI path.

16. As a **Template** or **Blank** path user, I want **no Embedded Agent chat**, so that scope stays simple and I’m not forced into LLM steps I didn’t choose.

17. As a **privacy-conscious user**, I want **onboarding chat message bodies** removed after **90 days** post-commit or abandon (metadata may remain longer per policy), so that health-related text doesn’t live forever without a future **opt-in coaching memory** epic.

18. As a **user deleting my account**, I want **Embedded Agent** thread rows **removed immediately**, so that **account erasure** is not delayed by retention windows.

19. As an **operator**, I want **structured server-side logs** and **Sentry**-class signals (where applicable) on failures, with **technical detail** for debugging, so that we can fix issues without exposing internals in the UI.

20. As a **maintainer**, I want **in-app server-side** flows to call **`create_program`** over **MCP** at the **MCP Edge Function URL** with the user’s **session JWT**, so that **first-party** and **third-party** clients share **one write contract** (Phase A may ship without UI change, but the wiring must exist before Phase B completion).

21. As a **maintainer**, I want **Program draft step** logic to stay **internal** to the **Embedded Agent** (shared module with **`generate-program`** internals), **without** changing the **External MCP Client** tool registry in v1, so that we don’t expand MCP surface area before we need to.

### Success measures

| Story # | Measure |
|---------|---------|
| 5–7 | Qualitative: preview + confirm flow reviewed in UX; no auto-commit without explicit user action |
| 9 | Server returns friendly copy on quota; 429/limit path covered in tests or manual runbook |
| 10 | Same-tab refresh resumes thread; multi-tab behavior documented (single active `open` / `preview_ready` row) |
| 19 | At least one error path emits structured log fields (tool name, thread id, error kind) in Edge |

---

## Scope

**In scope:**

1. **Phase A — MCP-first foundation (Track 3)**  
   - Server-side integration so **Embedded Agent** (or its orchestration layer) calls **`create_program`** via **MCP** at **`MCP Edge Function URL`** with **`Authorization: Bearer <user JWT>`** — see **`docs/CONTEXT.md`**.  
   - **No user-visible change** required to close Phase A, but **regression**: existing AI onboarding path may still call legacy edge code until Phase B cutover — Tech Plan defines the strangler.  
   - **Do not** add a second program **write** tool; **`create_program`** remains the only MCP write for program creation.

2. **Phase B — Embedded Agent onboarding (Track 1)**  
   - **AI path only** after **PathChoice**; **keep** the **onboarding questionnaire**; chat is **additive** and **qualitative**.  
   - **Program draft step** runs **once** per attempt when **(A)** model ready, **(B)** **6** user turns cap, or **(C)** user taps **Generate my plan** — whichever comes first; **re-run** only on **preview reject**.  
   - **Onboarding program commit gate**: `dry_run: true` preview → user confirms → `dry_run: false`.  
   - **New Postgres table** for **Embedded Agent threads** (JSONB messages, status, RLS, **at most one** active `open`/`preview_ready` per user).  
   - **Server-side quota** enforced in Edge (thread + optional `ai_generation_log` parity); same **AI usage / fairness family** as existing in-app AI generation.  
   - **Error UX**, **observability**, **retention** (90d message bodies; immediate delete on account deletion), **lifecycle** rules per **`docs/CONTEXT.md`**.  
   - **i18n**: FR/EN for new strings; locale from **`localeAtom` / `i18n`**.

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
- **Qualitative:** **Phase A** complete when engineering can demonstrate **server-side MCP** `create_program` calls with user JWT (tests or scripted demo); **Phase B** complete when the PWA AI onboarding path uses **Embedded Agent** + **Program draft step** + **MCP** persist.  
- **Numeric (engineering):** RLS policies on the new thread table; partial unique constraint (or equivalent) for **one** active onboarding thread per user.

---

## Decisions already locked (see `docs/CONTEXT.md`)

Ubiquitous-language entries **`Embedded Agent`**, **`Embedded Agent onboarding (v1)`**, **`Embedded Agent onboarding product (v1)`**, **`Embedded Agent thread`**, **`Embedded Agent thread lifecycle`**, **`Embedded Agent thread retention`**, **`Embedded Agent quota`**, **`Onboarding program commit gate`**, **`Program draft step`**, **`Embedded Agent error handling (v1)`** — these should not be re-litigated in tickets except via explicit ADR or glossary update.

---

## Open points for Tech Plan (not blocking this brief)

- Exact table name and column list; size strategy for storing **`dry_run`** preview payloads.  
- Edge function layout (single orchestrator vs split); MCP JSON-RPC client reuse.  
- Concrete quota numbers (messages/hour, drafts/day) aligned with **`ai_generation_log`** / `file:supabase/functions/_shared/aiQuota.ts`.  
- Model tier (Gemini vs other) per step; prompt versioning.  
- Privacy Policy / in-app copy updates for new data category.  
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
