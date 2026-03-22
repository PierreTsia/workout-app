import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "http://127.0.0.1:54321"
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function getActiveProgramId(): Promise<string> {
  const { data } = await admin
    .from("programs")
    .select("id")
    .eq("is_active", true)
    .limit(1)
    .single()
  return data!.id
}

test.describe("Builder — CRUD", () => {
  test("create day, add exercise, edit sets/reps, delete exercise, delete day", async ({
    page,
  }) => {
    test.setTimeout(120_000)

    // Visit / first so bootstrap seeds system exercises into the DB
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
        .filter({ hasText: /Lundi|Mercredi|Vendredi/ })
        .first(),
    ).toBeVisible({ timeout: 60_000 })

    const programId = await getActiveProgramId()
    await page.goto(`/builder/${programId}`)

    // Dialog may reappear after full-page navigation (AuthGuard re-mounts)
    try {
      await expect(notifDialog).toBeVisible({ timeout: 5_000 })
      await notifDialog.getByRole("button", { name: /not now/i }).click()
      await expect(notifDialog).not.toBeVisible()
    } catch {
      /* dialog didn't appear */
    }

    // Day list titles live in Card > flex-1 > p (avoid matching unrelated .font-semibold)
    await expect(page.getByRole("button", { name: /new day/i })).toBeVisible({
      timeout: 15_000,
    })
    const dayLabels = page.locator("div.flex-1 > p.font-semibold")
    await expect(dayLabels.first()).toBeVisible({ timeout: 15_000 })
    const initialCount = await dayLabels.count()

    // --- Create a new day ---
    const newDayButton = page.getByRole("button", { name: /new day/i })
    await newDayButton.click()

    await expect(dayLabels).toHaveCount(initialCount + 1, { timeout: 10_000 })
    const newDayLabel = dayLabels.nth(initialCount)
    const dayLabelText = await newDayLabel.textContent()

    // --- Open the new day editor ---
    await newDayLabel.click()

    const addExerciseButton = page.getByRole("button", {
      name: /add exercise/i,
    })
    await expect(addExerciseButton).toBeVisible({ timeout: 5_000 })

    // --- Add exercise from library ---
    await addExerciseButton.click()

    const pickerDialog = page.getByRole("dialog")
    await expect(pickerDialog).toBeVisible({ timeout: 5_000 })

    const allItems = pickerDialog.locator("[cmdk-item]")
    await expect(allItems.first()).toBeVisible({ timeout: 10_000 })
    const libraryItemCount = await allItems.count()

    // --- Verify search filters the list ---
    const searchInput = pickerDialog.getByRole("searchbox")
    await searchInput.fill("Développé")
    const filteredItems = pickerDialog.locator("[cmdk-item]")
    await expect(async () => {
      const count = await filteredItems.count()
      expect(count).toBeGreaterThan(0)
      expect(count).toBeLessThan(libraryItemCount)
    }).toPass({ timeout: 10_000 })
    await expect(
      filteredItems.first().locator("span.truncate"),
    ).toContainText("Développé", { timeout: 3_000 })
    await searchInput.fill("")
    await expect(allItems).toHaveCount(libraryItemCount, { timeout: 10_000 })

    // --- Select exercise via checkbox + Apply ---
    const exerciseOption = allItems.first()
    const exerciseName = await exerciseOption
      .locator("span.truncate")
      .textContent()
    await exerciseOption.getByRole("checkbox").click()
    await pickerDialog
      .getByRole("button", { name: /apply changes|appliquer/i })
      .click()

    await expect(pickerDialog).not.toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(exerciseName!)).toBeVisible({ timeout: 5_000 })

    // --- Open exercise detail editor ---
    await page.getByText(exerciseName!).first().click()

    const setsInput = page.locator("input[type='number']").first()
    await expect(setsInput).toBeVisible({ timeout: 5_000 })

    // --- Edit sets ---
    await setsInput.fill("5")
    await page.waitForTimeout(1_000)
    await expect(setsInput).toHaveValue("5")

    // --- Navigate back to day editor ---
    const backButton = page.locator("button:has(.lucide-arrow-left)")
    await backButton.click()

    // --- Delete the exercise ---
    const exerciseRow = page
      .locator("div.flex.items-center.gap-2.rounded-lg")
      .filter({ hasText: exerciseName! })
    await expect(exerciseRow).toBeVisible({ timeout: 5_000 })

    await exerciseRow
      .locator("button")
      .filter({ has: page.locator("svg.lucide-trash-2") })
      .click()

    const deleteExDialog = page.getByRole("dialog")
    await expect(deleteExDialog).toBeVisible()
    await deleteExDialog.getByRole("button", { name: /remove/i }).click()
    await expect(exerciseRow).not.toBeVisible({ timeout: 5_000 })

    // --- Navigate back to day list ---
    await backButton.click()

    // --- Delete the created day ---
    const dayCard = page
      .locator("[class*='cursor-pointer']")
      .filter({ hasText: dayLabelText! })
    await expect(dayCard).toBeVisible({ timeout: 5_000 })

    await dayCard
      .locator("button")
      .filter({ has: page.locator("svg.lucide-trash-2") })
      .click()

    const dayDeleteDialog = page.getByRole("dialog")
    await expect(dayDeleteDialog).toBeVisible()
    await dayDeleteDialog.getByRole("button", { name: /delete/i }).click()
    await expect(dayCard).not.toBeVisible({ timeout: 5_000 })
  })

  test("exercise picker shows filter button at mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })

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

    const programId = await getActiveProgramId()
    await page.goto(`/builder/${programId}`)
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
    await addExerciseButton.click()

    const pickerDialog = page.getByRole("dialog")
    await expect(pickerDialog).toBeVisible({ timeout: 5_000 })

    const filterButton = pickerDialog.getByRole("button", {
      name: /filters|filtres/i,
    })
    await expect(filterButton).toBeVisible()

    await filterButton.click()
    await expect(
      pickerDialog.getByRole("button", { name: /filters|filtres/i }),
    ).toBeVisible()
  })
})
