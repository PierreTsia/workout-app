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

    // --- SESSION 2: same Exercise Slot (Lundi), new cycle — #463 / ADR 0012 ---
    // Last Performance is slot-scoped. A Mercredi row with the same catalog
    // exercise_id is a different slot and must NOT inherit this history.
    const newSessionButton = page.getByRole("button", { name: /new session/i })
    await expect(newSessionButton).toBeVisible()
    await newSessionButton.click()

    // Carousel may land on the next incomplete day; force Lundi.
    await expect(lundiCard).toBeVisible({ timeout: 15_000 })
    const dots = page.getByRole("button", { name: /^(aller à|go to)\s/i })
    await expect(dots).toHaveCount(3, { timeout: 5_000 })
    await dots.nth(0).click()
    await expect(lundiCard).toBeVisible({ timeout: 5_000 })

    // Completed days hide Start — restart the cycle to redo the same slot.
    await expect(
      page.getByRole("button", { name: /start workout/i }),
    ).not.toBeVisible()
    const restartCta = page.getByRole("button", {
      name: /restart cycle to do it again/i,
    })
    await expect(restartCta).toBeVisible({ timeout: 5_000 })
    await restartCta.click()

    const confirmDialog = page.getByRole("alertdialog", {
      name: /start a new cycle\?/i,
    })
    await expect(confirmDialog).toBeVisible({ timeout: 3_000 })
    await confirmDialog
      .getByRole("button", { name: /close and restart/i })
      .click()
    await expect(confirmDialog).not.toBeVisible({ timeout: 5_000 })

    const startButton2 = page.getByRole("button", { name: /start workout/i })
    await expect(startButton2).toBeVisible({ timeout: 10_000 })
    await startButton2.click()

    await expect(
      page.locator(".font-mono.tabular-nums.text-primary"),
    ).toBeVisible({ timeout: 5_000 })

    // --- VERIFY: progression pill should be visible with "Reps up" ---
    const progressionPill = page.getByText(/Reps up/i)
    await expect(progressionPill).toBeVisible({ timeout: 10_000 })

    // The auto-applied reps should be 11 (was 10, REPS_UP +1)
    const repsInputs = page.locator("input[inputmode='numeric']").first()
    await expect(repsInputs).toBeVisible({ timeout: 5_000 })
    await expect(repsInputs).toHaveValue("11")
  })
})

