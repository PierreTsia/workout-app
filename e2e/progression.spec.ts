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

test.describe("Progression — cross-session suggestion", () => {
  test.describe.configure({ timeout: 120_000 })

  test.afterAll(async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const userId = getTestUserId()
    await admin.from("set_logs").delete().match({})
    await admin.from("sessions").delete().eq("user_id", userId)

    // Reset workout_exercises reps/weight to seed values (progression may have updated them)
    await admin
      .from("workout_exercises")
      .update({ reps: "10", weight: "0", sets: 3 })
      .match({})
  })

  test("shows progression pill on second session after completing all sets", async ({
    page,
  }) => {
    await page.goto("/")

    // Dismiss notification dialog if it appears
    try {
      const notifDialog = page.getByRole("dialog", { name: /enable notifications/i })
      await expect(notifDialog).toBeVisible({ timeout: 2_500 })
      await notifDialog.getByRole("button", { name: /not now/i }).click()
    } catch {
      /* already dismissed */
    }

    // Wait for the carousel to load — day 1 (Lundi) should be visible
    const lundiCard = page.locator("h3").filter({ hasText: "Lundi" })
    await expect(lundiCard).toBeVisible({ timeout: 30_000 })

    // --- SESSION 1: complete all 3 sets on the first exercise (Lundi) ---
    const startButton = page.getByRole("button", { name: /start workout/i })
    await expect(startButton).toBeVisible({ timeout: 5_000 })
    await startButton.click()

    // Wait for the exercise view to load (session timer appears)
    await expect(
      page.locator(".font-mono.tabular-nums.text-primary"),
    ).toBeVisible({ timeout: 5_000 })

    const rirConfirmButton = page.getByRole("button", { name: /confirm/i })
    const restTimerPill = page.getByRole("button", { name: /open rest timer/i })

    // Helper: complete one set (checkbox → RIR confirm → skip rest)
    async function completeOneSet() {
      const unchecked = page.locator("[role='checkbox'][data-state='unchecked']").first()
      await expect(unchecked).toBeVisible({ timeout: 5_000 })
      await unchecked.click()

      // RIR drawer — confirm with default RIR
      await expect(rirConfirmButton).toBeVisible({ timeout: 3_000 })
      await rirConfirmButton.click()

      // Skip rest timer if it appears
      try {
        await expect(restTimerPill).toBeVisible({ timeout: 3_000 })
        await restTimerPill.click()
        const restDrawer = page.getByRole("dialog")
        await expect(restDrawer).toBeVisible({ timeout: 3_000 })
        await restDrawer.getByRole("button", { name: /skip/i }).click()
      } catch {
        /* last set — no rest timer */
      }
    }

    // Complete all 3 sets on the first exercise
    await completeOneSet()
    await completeOneSet()
    await completeOneSet()

    // Finish the session
    const finishButton = page.getByRole("button", { name: /finish/i })
    await expect(finishButton).toBeVisible({ timeout: 5_000 })
    await finishButton.click()

    // If there's a confirm dialog for skipped sets, accept it
    try {
      const confirmDialog = page.getByRole("dialog")
      await expect(confirmDialog).toBeVisible({ timeout: 3_000 })
      await confirmDialog.getByRole("button", { name: /finish/i }).click()
    } catch {
      /* no confirm dialog */
    }

    // Session summary should appear
    await expect(page.getByText(/session complete/i)).toBeVisible({ timeout: 5_000 })

    // Wait for sync queue to flush (set_logs + session_finish → Supabase)
    await page.waitForTimeout(3_000)

    // --- SESSION 2: navigate to Mercredi (which shares the same exercise) ---
    const newSessionButton = page.getByRole("button", { name: /new session/i })
    await expect(newSessionButton).toBeVisible()
    await newSessionButton.click()

    // Back on the carousel — wait for it to load
    await expect(lundiCard).toBeVisible({ timeout: 15_000 })

    // Navigate to the Mercredi day card via dot indicators — by aria-label
    // so the selector is locale-agnostic and survives CSS refactors.
    const dots = page.getByRole("button", { name: /^(aller à|go to)\s/i })
    await expect(dots).toHaveCount(3, { timeout: 5_000 })
    await dots.nth(1).click()
    await page.waitForTimeout(500)

    const mercrediCard = page.locator("h3").filter({ hasText: "Mercredi" })
    await expect(mercrediCard).toBeVisible({ timeout: 5_000 })

    // Start workout on Mercredi
    const startButton2 = page.getByRole("button", { name: /start workout/i })
    await expect(startButton2).toBeVisible({ timeout: 10_000 })
    await startButton2.click()

    // Wait for exercise view
    await expect(
      page.locator(".font-mono.tabular-nums.text-primary"),
    ).toBeVisible({ timeout: 5_000 })

    // Navigate to the shared exercise (exercise[0] from seed — added as second exercise on Mercredi)
    // The exercise strip shows chips — click the last one (the shared exercise is sort_order: 1)
    const exerciseChips = page.locator("div.flex.overflow-x-auto > button")
    await expect(exerciseChips).toHaveCount(2, { timeout: 10_000 })
    await exerciseChips.last().click()

    // --- VERIFY: progression pill should be visible with "Reps up" ---
    const progressionPill = page.getByText(/Reps up/i)
    await expect(progressionPill).toBeVisible({ timeout: 10_000 })

    // The auto-applied reps should be 11 (was 10, REPS_UP +1)
    const repsInputs = page.locator("input[inputmode='numeric']").first()
    await expect(repsInputs).toBeVisible({ timeout: 5_000 })
    await expect(repsInputs).toHaveValue("11")
  })
})
