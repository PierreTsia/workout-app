import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = "http://127.0.0.1:54321"
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
const TEST_EMAIL = "e2e-test@example.com"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function getTestUserId(): string {
  return fs
    .readFileSync(path.join(__dirname, "..", "playwright", ".auth", "test-user-id.txt"), "utf-8")
    .trim()
}

test.describe("Feedback — happy path", () => {
  test.afterAll(async () => {
    await admin
      .from("exercise_content_feedback")
      .delete()
      .eq("user_email", TEST_EMAIL)
  })

  test("submit feedback from builder exercise detail", async ({ page }) => {
    test.setTimeout(120_000)

    await page.goto("/")

    const notifDialog = page.getByRole("dialog", {
      name: /enable notifications/i,
    })
    try {
      await expect(notifDialog).toBeVisible({ timeout: 5_000 })
      await notifDialog.getByRole("button", { name: /not now/i }).click()
      await expect(notifDialog).not.toBeVisible()
    } catch {
      /* dialog didn't appear */
    }

    await expect(
      page
        .locator("h3")
        .filter({ hasText: /Lundi|Mercredi|Vendredi|Monday|Wednesday|Friday/ })
        .first(),
    ).toBeVisible({ timeout: 60_000 })

    const { data: activeProgram } = await admin
      .from("programs")
      .select("id")
      .eq("user_id", getTestUserId())
      .eq("is_active", true)
      .limit(1)
      .single()
    await page.goto(`/builder/${activeProgram!.id}`)

    try {
      await expect(notifDialog).toBeVisible({ timeout: 5_000 })
      await notifDialog.getByRole("button", { name: /not now/i }).click()
      await expect(notifDialog).not.toBeVisible()
    } catch {
      /* dialog didn't appear */
    }

    await expect(page.getByRole("button", { name: /new day/i })).toBeVisible({
      timeout: 15_000,
    })
    const dayLabels = page.locator("div.flex-1 > p.font-semibold")
    await expect(dayLabels.first()).toBeVisible({ timeout: 15_000 })

    await dayLabels.first().click()

    const addExerciseButton = page.getByRole("button", {
      name: /add exercise/i,
    })
    await expect(addExerciseButton).toBeVisible({ timeout: 5_000 })

    const exerciseRows = page.locator("div.flex.items-center.gap-2.rounded-lg")
    const hasExistingExercise = (await exerciseRows.count()) > 0

    if (!hasExistingExercise) {
      await addExerciseButton.click()
      const pickerDialog = page.getByRole("dialog")
      await expect(pickerDialog).toBeVisible({ timeout: 5_000 })
      const allItems = pickerDialog.locator("[cmdk-item]")
      await expect(allItems.first()).toBeVisible({ timeout: 10_000 })
      await allItems.first().getByRole("checkbox").click()
      await pickerDialog
        .getByRole("button", { name: /apply changes|appliquer/i })
        .click()
      await expect(pickerDialog).not.toBeVisible({ timeout: 5_000 })
    }

    await exerciseRows.first().click()
    await page.waitForTimeout(1_000)

    const feedbackTrigger = page.getByRole("button", {
      name: /send feedback/i,
    })
    await expect(feedbackTrigger).toBeVisible({ timeout: 5_000 })
    await feedbackTrigger.click()

    const sheet = page.locator("[role='dialog']").filter({
      has: page.getByText("Send feedback"),
    })
    await expect(sheet).toBeVisible({ timeout: 5_000 })

    await expect(
      sheet.getByText(new RegExp(`Reporting as.*${TEST_EMAIL}`, "i")),
    ).toBeVisible()

    const illustrationPill = sheet.getByRole("button", {
      name: /illustration/i,
    })
    await illustrationPill.click()

    const step2 = sheet.getByText(/how is it wrong/i)
    await expect(step2).toBeVisible({ timeout: 3_000 })

    const illustrationSelect = sheet.getByRole("combobox").first()
    await illustrationSelect.click()

    const wrongExerciseOption = page.getByText(/shows wrong exercise/i)
    await expect(wrongExerciseOption).toBeVisible({ timeout: 3_000 })
    await wrongExerciseOption.click()

    const commentTextarea = sheet.getByPlaceholder(
      /additional comment/i,
    )
    await commentTextarea.fill("E2E test feedback")

    await sheet.getByRole("button", { name: /submit feedback/i }).click()

    // Success animation may complete instantly in CI (no GPU / reduced motion),
    // so we only assert the meaningful outcome: the sheet closes.
    await expect(sheet).not.toBeVisible({ timeout: 15_000 })

    const { data: rows, error } = await admin
      .from("exercise_content_feedback")
      .select("*")
      .eq("user_email", TEST_EMAIL)
      .order("created_at", { ascending: false })
      .limit(1)

    expect(error).toBeNull()
    expect(rows).toHaveLength(1)

    const row = rows![0]
    expect(row.fields_reported).toContain("illustration")
    expect(row.error_details.illustration).toContain("wrong_exercise")
    expect(row.comment).toBe("E2E test feedback")
  })
})
