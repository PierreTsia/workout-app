// E2E spec for Quick Workout AI happy path (T128, #342).
//
// What this proves: the *UI* flow constraints → AI generate → preview →
// Start lands the user on an active session. Both network sinks
// (`generate-quick-workout` and `commit-quick-workout`) are mocked so
// the spec is deterministic and never hits Gemini or PostgREST.
//
// What this does NOT prove: the PWA ⇄ Edge ⇄ MCP wiring, the DB write,
// the `program_id: null` shape, or the non-destructive contract. Those
// are covered piecewise by:
//   - `useCommitQuickWorkout.test.tsx` (hook → Edge contract)
//   - `commit-quick-workout/handler_test.ts` (Edge → MCP contract)
//   - `createWorkoutDay_test.ts` (MCP → DB shape + rollback)
// Re-asserting them through Playwright forced a real session JWT through
// GoTrue + RLS + FKs, which was the source of all flakiness on this spec
// (see PR #347 discussion).

import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "http://127.0.0.1:54321"
// Anon key works here — `exercises` is the seeded public catalog (readable
// by anon role). We use the typed client just so the e2e doesn't repeat the
// same fetch shape every spec.
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

async function getSeededExerciseIds(count: number): Promise<string[]> {
  // PreviewStep hydrates the AI's `exerciseIds` against the local exercise
  // pool (or falls back to a DB lookup). Fake UUIDs render an empty preview
  // and disable Start Workout — so we resolve real seeded ids once up front.
  // This is the only DB read the spec does; it stays a read-only catalog
  // query, not an assertion target, so it doesn't reintroduce the flakiness
  // that motivated dropping the workout_days assertion.
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await client.from("exercises").select("id").limit(count)
  if (error) throw new Error(`Failed to read seeded exercises: ${error.message}`)
  if (!data || data.length === 0) {
    throw new Error("No exercises seeded — global-setup is broken")
  }
  return data.map((row) => row.id as string)
}

test.describe("Quick Workout AI", () => {
  test("AI generate → preview → Start lands on an active session", async ({
    page,
  }) => {
    test.setTimeout(60_000)

    const aiExerciseIds = await getSeededExerciseIds(4)

    // CRITICAL: mock the LLM. We never call generativelanguage.googleapis.com
    // from CI. The Edge function's job (auth / quota / catalog filter / prompt
    // build / validate) is covered by the Deno handler tests; here we just
    // hand the PWA a believable preview so the UI can move forward.
    await page.route("**/functions/v1/generate-quick-workout", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          exerciseIds: aiExerciseIds,
          rationale: "Solid full-body session balanced across pull/push.",
          repaired: false,
        }),
      })
    })

    // Mock the commit too. The Edge → MCP → DB path is covered by Deno
    // tests; here we just need the hook to resolve with a workoutDayId so
    // `handleQuickWorkoutStart` fires and the session UI renders.
    await page.route("**/functions/v1/commit-quick-workout", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          workout_day_id: "00000000-0000-4000-8000-0000000000aa",
        }),
      })
    })

    // Belt-and-braces: if anything tries to reach the real Gemini endpoint
    // (a regression in routing, an env leak), abort the request and flag
    // the test. CI cost discipline matters more than a soft warning.
    let geminiCallObserved = false
    await page.route("**/generativelanguage.googleapis.com/**", (route) => {
      geminiCallObserved = true
      void route.abort()
    })

    await page.goto("/")
    // Notifications opt-in dialog can appear on first paint — dismiss if so.
    const notifDialog = page.getByRole("dialog", { name: /enable notifications/i })
    try {
      await expect(notifDialog).toBeVisible({ timeout: 3_000 })
      await notifDialog.getByRole("button", { name: /not now/i }).click()
      await expect(notifDialog).not.toBeVisible()
    } catch {
      /* dialog didn't appear */
    }
    await expect(page).toHaveURL("/", { timeout: 15_000 })

    // The Quick Workout entry lives in the side drawer. Open it via the
    // hamburger / menu trigger, then click "Quick Workout".
    await page.getByRole("button", { name: /open menu/i }).click()
    await page.getByRole("button", { name: /^Quick Workout$/ }).click()

    // Drawer for the sheet renders with constraints step active. Defaults
    // (30min / full-gym / full-body) are fine — go straight to AI Generate.
    // Scope to the heading because the side drawer's "Quick Workout" button
    // stays in the DOM after the click, so a plain getByText is ambiguous.
    await expect(
      page.getByRole("heading", { name: /^Quick Workout$/ }),
    ).toBeVisible({ timeout: 10_000 })
    await page.getByRole("button", { name: /AI Generate/ }).click()

    // QuickWorkoutAIGeneratingStep auto-fires the mutation on mount and the
    // mocked Edge response transitions us to PreviewStep. The preview's
    // Start button is the canonical way to leave this step on the AI path.
    await expect(page.getByRole("button", { name: /Start Workout/ })).toBeVisible({
      timeout: 30_000,
    })
    await page.getByRole("button", { name: /Start Workout/ }).click()

    // Successful commit → `handleQuickWorkoutStart` → `startSession` →
    // SessionTimerChip mounts in the AppShell header. That chip's
    // visibility is the canonical UI proof that a session is running;
    // it only renders when `session.startedAt && session.isActive`.
    await expect(page.getByTestId("session-timer-chip")).toBeVisible({
      timeout: 10_000,
    })

    // Token-burn check: nothing must have hit the real Gemini endpoint.
    expect(geminiCallObserved).toBe(false)
  })
})
