import { test, expect } from "@playwright/test"

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
        .locator("button")
        .filter({ hasText: /Lundi|Mercredi|Vendredi/ })
        .first(),
    ).toBeVisible({ timeout: 60_000 })

    // Navigate to builder
    await page.goto("/builder")

    // Dialog may reappear after full-page navigation (AuthGuard re-mounts)
    try {
      await expect(notifDialog).toBeVisible({ timeout: 5_000 })
      await notifDialog.getByRole("button", { name: /not now/i }).click()
      await expect(notifDialog).not.toBeVisible()
    } catch {
      /* dialog didn't appear */
    }

    // Wait for existing day cards to render
    const dayLabels = page.locator("p.font-semibold")
    await expect(dayLabels.first()).toBeVisible({ timeout: 10_000 })
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
    const initialCount = await allItems.count()

    // --- Verify search filters the list ---
    const searchInput = pickerDialog.locator("[cmdk-input]")
    await searchInput.fill("Développé")
    const filteredItems = pickerDialog.locator("[cmdk-item]")
    const filteredCount = await filteredItems.count()
    expect(filteredCount).toBeLessThan(initialCount)
    await expect(
      filteredItems.first().locator("span").last(),
    ).toContainText("Développé", { timeout: 3_000 })
    await searchInput.fill("")

    const exerciseOption = allItems.first()
    const exerciseName = await exerciseOption
      .locator("span")
      .last()
      .textContent()
    await exerciseOption.click()

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
})
