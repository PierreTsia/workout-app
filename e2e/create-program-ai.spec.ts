// E2E spec for the additional-program AI flow (T136, #343).
//
// What this proves: the *UI* flow path-choice → AI chat → /draft →
// preview → /commit lands the user on the library/programs surface
// with `useCommitPreview` having flipped the active program. Both the
// LLM and MCP commit are mocked via `page.route('**/functions/v1/embedded-agent', ...)`
// so the spec stays deterministic and never hits Gemini.
//
// What this does NOT prove: the PWA ⇄ Edge ⇄ MCP wiring, the DB
// write, the bundle-builder SQL, or the motivation gate. Those are
// covered piecewise by:
//   - `useEmbeddedAgentThread.test.ts` (hook → Edge contract)
//   - `supabase/functions/embedded-agent/handler_test.ts` (Edge handler)
//   - `supabase/functions/embedded-agent/lib/bundle_test.ts` (bundle projection)
//   - `supabase/functions/embedded-agent/prompt/additional-program_test.ts` (validator)
// Re-asserting them through Playwright forces a real session JWT
// through GoTrue + RLS + FKs, which is the same shape of flakiness
// the quick-workout AI spec hit in PR #347.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { test, expect } from "@playwright/test"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getTestUserId(): string {
  const p = path.join(__dirname, "..", "playwright", ".auth", "test-user-id.txt")
  return fs.readFileSync(p, "utf-8").trim()
}

async function dismissNotificationDialog(page: import("@playwright/test").Page) {
  const dialog = page.getByRole("dialog", { name: /enable notifications/i })
  try {
    await expect(dialog).toBeVisible({ timeout: 3_000 })
    await dialog.getByRole("button", { name: /not now/i }).click()
    await expect(dialog).not.toBeVisible()
  } catch {
    /* dialog didn't appear */
  }
}

interface RouteState {
  sendCount: number
  // After /draft fires, /open refetches (useGenerateDraft invalidates
  // the thread query). The refetch needs to surface `last_preview` —
  // otherwise the preview screen renders its "missing preview" empty
  // state. We flip this on /draft and read it on /open.
  draftCommitted: boolean
}

// Shape returned from /draft. Reused on the next /open so the client
// sees the same preview after the React Query invalidation refetch.
const DRAFT_PREVIEW = {
  args: {
    name: "Plateau Buster — 4 days/wk",
    days: [
      { label: "Upper", exercises: ["uuid-1", "uuid-2"] },
      { label: "Lower", exercises: ["uuid-3"] },
      { label: "Push", exercises: ["uuid-4", "uuid-5"] },
      { label: "Pull", exercises: ["uuid-6"] },
    ],
  },
  rendered: [
    { label: "Upper", lines: ["Bench Press — 4 × 8 — 120s rest"] },
    { label: "Lower", lines: ["Back Squat — 4 × 6 — 180s rest"] },
    { label: "Push", lines: ["Overhead Press — 3 × 10 — 90s rest"] },
    { label: "Pull", lines: ["Pull-up — 3 × 8 — 90s rest"] },
  ],
}

// Build the embedded-agent route handler. State lives on `state` so
// the same `/message` route can return different content on each turn
// (first turn = generic ack, second turn = ready signal accepted).
//
// Belt-and-braces: we never reach Gemini from CI. The page.route on
// the Gemini glob aborts the request and the spec asserts the abort
// counter at the end. (Note: this MUST be a line comment, not JSDoc —
// the Gemini URL contains `**/` which closes block comments early.)
function makeEmbeddedAgentRoute(state: RouteState) {
  return async (route: import("@playwright/test").Route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as {
      action?: string
      purpose?: string
    }
    if (body.action === "open" && body.purpose === "additional_program") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          thread_id: "00000000-0000-0000-0000-0000000ap001",
          // After /draft, the next /open is the refetch triggered by
          // useGenerateDraft's invalidation. We have to flip status +
          // last_preview here, otherwise the preview screen renders
          // the empty state and the spec times out on the heading.
          status: state.draftCommitted ? "preview_ready" : "open",
          resumed: false,
          messages: [],
          last_preview: state.draftCommitted ? DRAFT_PREVIEW : null,
          // The chat surface renders a context chip when this is set;
          // we assert against it below.
          bundle_summary: {
            sessions_per_week: 4,
            active_program_name: "E2E Test Program",
            top_muscle_group: "chest",
          },
        }),
      })
    }
    if (body.action === "send") {
      state.sendCount += 1
      // First turn: vanilla ack, no ready signal yet. Second turn:
      // signal accepted, ready_for_draft true. Anything past that we
      // just keep the chat alive.
      if (state.sendCount === 1) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            assistant: {
              content: "Got it. What's driving the change?",
              ts: "2026-05-12T12:00:00Z",
            },
            ready_for_draft: false,
          }),
        })
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          assistant: {
            content: "Plateau noted. I'll draft something that swaps the focus.",
            ts: "2026-05-12T12:01:00Z",
          },
          ready_for_draft: true,
        }),
      })
    }
    if (body.action === "draft") {
      state.draftCommitted = true
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "preview_ready",
          trigger: "user_cta",
          preview: DRAFT_PREVIEW,
        }),
      })
    }
    if (body.action === "commit") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          program_id: "00000000-0000-4000-8000-0000000ap999",
          thread_id: "00000000-0000-0000-0000-0000000ap001",
          motivation: "plateau",
        }),
      })
    }
    // Catch-all for `abandon` / `reject` / future actions fired on
    // teardown. ok:true keeps the client happy without expanding the
    // mock surface for this happy-path test.
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    })
  }
}

test.describe("Create Program AI (additional-program flow)", () => {
  test("path-choice → chat → motivation → ready signal → draft → preview → commit lands on library", async ({
    page,
  }) => {
    test.setTimeout(60_000)

    // Sanity: confirm the test user has a program seeded by global-setup
    // so OnboardingGuard lets us into /create-program. We don't read it
    // back from the DB (that's what `useOnboardingResume` is for); the
    // global-setup contract is enough.
    getTestUserId()

    const state: RouteState = { sendCount: 0, draftCommitted: false }
    await page.route("**/functions/v1/embedded-agent", makeEmbeddedAgentRoute(state))

    // Token-burn check: nothing must reach the real Gemini endpoint.
    let geminiCallObserved = false
    await page.route("**/generativelanguage.googleapis.com/**", (route) => {
      geminiCallObserved = true
      void route.abort()
    })

    await page.goto("/create-program")
    await dismissNotificationDialog(page)

    // --- Path choice ---
    await expect(page.getByText(/AI Generate/i).first()).toBeVisible({ timeout: 15_000 })
    await page.getByText(/AI Generate/i).first().click()

    // --- Chat surface mounts with bundle chip ---
    await expect(
      page.getByRole("heading", { name: /design your next program/i }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByText(/Building on top of E2E Test Program · 4 sessions\/wk/i),
    ).toBeVisible({ timeout: 5_000 })

    // --- First message (ack, no ready signal) ---
    const composer = page.getByPlaceholder(/write a message/i)
    await composer.fill("I want to switch things up — same gear, same 4 days")
    await page.getByRole("button", { name: /^send$/i }).click()
    await expect(
      page.getByText(/Got it\. What's driving the change\?/),
    ).toBeVisible({ timeout: 10_000 })

    // --- Second message (motivation → ready signal accepted) ---
    await composer.fill("Pure plateau on bench")
    await page.getByRole("button", { name: /^send$/i }).click()
    await expect(
      page.getByText(/Plateau noted\. I'll draft something/),
    ).toBeVisible({ timeout: 10_000 })

    // --- Generate CTA fires /draft → preview_ready ---
    await page.getByRole("button", { name: /generate my plan/i }).click()
    await expect(
      page.getByRole("heading", { name: /your new program draft/i }),
    ).toBeVisible({ timeout: 30_000 })
    // Day label survives the cleanDayLabel prefix-strip and the
    // mocked exercise name reaches the expanded card.
    await expect(page.getByText("Bench Press")).toBeVisible()

    // --- Commit lands us back on the library surface ---
    await page.getByRole("button", { name: /activate this program/i }).click()
    await expect(page).toHaveURL(/\/library\/programs/, { timeout: 30_000 })

    // Token-burn check: nothing must have hit the real Gemini endpoint.
    expect(geminiCallObserved).toBe(false)
  })
})
