// E2E spec for Quick Workout AI happy path (T128, #342).
//
// Mandatory per Tech Plan: locks the constraints → AI generate → preview
// → Start flow now that AI Start writes through MCP (`commit-quick-workout`
// → `create_workout_day` tool).
//
// Token-burn discipline: the spec MUST never call the real Gemini API.
// `page.route` intercepts `/functions/v1/generate-quick-workout` and
// returns a fixed payload using real seeded catalog ids. The commit
// path runs for real against the local stack so the MCP boundary is
// actually exercised — that's the whole point of T128.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = "http://127.0.0.1:54321"
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

function getTestUserId(): string {
  const p = path.join(__dirname, "..", "playwright", ".auth", "test-user-id.txt")
  return fs.readFileSync(p, "utf-8").trim()
}

function getAdmin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

interface SeededExercise {
  id: string
  name: string
  muscle_group: string | null
  equipment: string | null
  measurement_type: string | null
}

async function getSeededExerciseIds(count: number): Promise<SeededExercise[]> {
  // Quick Workout AI defaults to "full-gym" / "full-body" so we don't need
  // to filter by equipment — any seeded exercises will pass the catalog
  // filter on the server side.
  const admin = getAdmin()
  const { data, error } = await admin
    .from("exercises")
    .select("id, name, muscle_group, equipment, measurement_type")
    .limit(count)
  if (error) throw new Error(`Failed to fetch seeded exercises: ${error.message}`)
  if (!data || data.length === 0) {
    throw new Error("No exercises seeded — global-setup is broken")
  }
  return data as SeededExercise[]
}

async function clearAdHocDays(userId: string) {
  // Quick Workout creates `program_id IS NULL` rows. We don't touch the
  // program-bound seed so subsequent specs in the same run still see the
  // 3 seeded program days.
  const admin = getAdmin()
  await admin.from("workout_days").delete().is("program_id", null).eq("user_id", userId)
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

test.describe("Quick Workout AI", () => {
  test("AI generate → preview → Start commits via MCP and lands on the active session", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const userId = getTestUserId()

    await clearAdHocDays(userId)

    const seeded = await getSeededExerciseIds(4)
    const aiExerciseIds = seeded.map((e) => e.id)

    // CRITICAL: mock the LLM. We never call generativelanguage.googleapis.com
    // from CI. The Edge function's job (auth / quota / catalog filter / prompt
    // build / validate) is covered by the Deno handler tests; here we only
    // need a believable preview payload.
    let geminiCallObserved = false
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

    // Belt-and-braces: if anything tries to reach the real Gemini endpoint
    // (a regression in routing, an env leak), abort the request and flag
    // the test. CI cost discipline matters more than a soft warning.
    await page.route("**/generativelanguage.googleapis.com/**", (route) => {
      geminiCallObserved = true
      void route.abort()
    })

    await page.goto("/")
    await dismissNotificationDialog(page)
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

    // Successful commit returns to the home page with an active session.
    // The session UI variations are covered by other specs; here we only
    // assert the post-commit landing.
    await expect(page).toHaveURL("/", { timeout: 30_000 })

    // Real MCP commit ran → workout_days row exists with program_id=null
    // and is owned by the test user. This is the assertion the Tech Plan
    // requires (manual smoke ideal made deterministic).
    const admin = getAdmin()
    const { data: rows, error } = await admin
      .from("workout_days")
      .select("id, program_id, user_id, label, emoji")
      .eq("user_id", userId)
      .is("program_id", null)
    expect(error).toBeNull()
    expect(rows?.length ?? 0).toBeGreaterThan(0)
    const created = rows![0]
    expect(created.program_id).toBeNull()

    // Active program must remain active — `create_workout_day` is
    // non-destructive (destructiveHint: false locked decision).
    const { data: programs } = await admin
      .from("programs")
      .select("id, is_active")
      .eq("user_id", userId)
    expect(programs?.some((p) => p.is_active)).toBe(true)

    // Token-burn check: nothing must have hit the real Gemini endpoint.
    expect(geminiCallObserved).toBe(false)
  })
})
