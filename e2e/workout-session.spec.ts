import { test, expect } from "@playwright/test"

test.describe("Workout session — full flow", () => {
  test.describe.configure({ timeout: 90_000 })

  test("carousel renders, start session, log sets, finish, summary", async ({
    page,
  }) => {
    await page.goto("/")

    const notifDialog = page.getByRole("dialog", {
      name: /enable notifications/i,
    })
    try {
      await expect(notifDialog).toBeVisible({ timeout: 2_500 })
      await notifDialog.getByRole("button", { name: /not now/i }).click()
      await expect(notifDialog).not.toBeVisible()
    } catch {
      /* dialog didn't appear — permission already granted */
    }

    // Carousel card should render with a day label
    const dayCard = page.locator("h3").filter({ hasText: /Lundi|Mercredi|Vendredi/ }).first()
    await expect(dayCard).toBeVisible({ timeout: 30_000 })

    // PreSessionExerciseList: row menu (do not match on gap-* — layout classes change)
    const exerciseRowMenu = page
      .getByRole("button", { name: "Exercise actions" })
      .first()
    await expect(exerciseRowMenu).toBeVisible({ timeout: 20_000 })
    await expect(exerciseRowMenu).toBeEnabled({ timeout: 20_000 })

    // Start the workout session
    const startButton = page.getByRole("button", { name: /start workout/i })
    await expect(startButton).toBeVisible({ timeout: 5_000 })
    await startButton.click()

    // Session timer chip should appear in the header
    const timerChip = page.locator(".font-mono.tabular-nums.text-primary")
    await expect(timerChip).toBeVisible({ timeout: 5_000 })

    // Exercise strip should now be visible (active session view)
    const exerciseChips = page.locator(
      "div.flex.overflow-x-auto > button",
    )
    await expect(exerciseChips.first()).toBeVisible({ timeout: 15_000 })

    // --- Log set 1 ---
    const checkboxes = page.getByRole("checkbox")
    await expect(checkboxes.first()).toBeVisible()
    await checkboxes.first().click()

    // RIR Drawer opens — confirm with default RIR
    const rirConfirmButton = page.getByRole("button", { name: /confirm/i })
    await expect(rirConfirmButton).toBeVisible({ timeout: 3_000 })
    await rirConfirmButton.click()

    // Row should be marked as done
    const firstSetRow = page
      .locator("div.grid.items-center")
      .filter({ has: page.getByRole("checkbox").first() })
      .first()
    await expect(firstSetRow).toHaveClass(/bg-primary/, { timeout: 5_000 })

    // Rest timer pill should appear in header
    const restTimerPill = page.getByRole("button", { name: /open rest timer/i })
    await expect(restTimerPill).toBeVisible({ timeout: 3_000 })

    // Click pill to open drawer and skip
    await restTimerPill.click()
    const restDrawer = page.getByRole("dialog")
    await expect(restDrawer).toBeVisible({ timeout: 3_000 })
    await restDrawer.getByRole("button", { name: /skip/i }).click()
    await expect(restTimerPill).not.toBeVisible()

    // --- Log set 2 ---
    const secondCheckbox = page
      .locator("[role='checkbox'][data-state='unchecked']")
      .first()
    await expect(secondCheckbox).toBeVisible()
    await secondCheckbox.click()

    // RIR Drawer opens again — confirm
    await expect(rirConfirmButton).toBeVisible({ timeout: 3_000 })
    await rirConfirmButton.click()

    // Rest timer pill appears again — skip it
    await expect(restTimerPill).toBeVisible({ timeout: 3_000 })
    await restTimerPill.click()
    await expect(restDrawer).toBeVisible({ timeout: 3_000 })
    await restDrawer.getByRole("button", { name: /skip/i }).click()
    await expect(restTimerPill).not.toBeVisible()

    // --- Navigate to last exercise and finish ---
    const lastChip = exerciseChips.last()
    await lastChip.click()

    // The "Next" button becomes "Finish" on the last exercise
    const finishButton = page.getByRole("button", { name: /finish/i })
    await expect(finishButton).toBeVisible()
    await finishButton.click()

    // Confirm dialog for skipped sets
    const confirmDialog = page.getByRole("dialog")
    await expect(confirmDialog).toBeVisible({ timeout: 3_000 })
    await confirmDialog.getByRole("button", { name: /finish/i }).click()

    // --- Session summary ---
    await expect(
      page.getByText(/session complete/i),
    ).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/duration/i)).toBeVisible()
    await expect(page.getByText(/sets done/i)).toBeVisible()
    await expect(page.getByText(/exercises completed/i)).toBeVisible()
  })

  test("carousel dot indicators allow day navigation", async ({ page }) => {
    await page.goto("/")

    const notifDialog = page.getByRole("dialog", {
      name: /enable notifications/i,
    })
    try {
      await expect(notifDialog).toBeVisible({ timeout: 2_500 })
      await notifDialog.getByRole("button", { name: /not now/i }).click()
      await expect(notifDialog).not.toBeVisible()
    } catch {
      /* dialog didn't appear */
    }

    // Wait for first day card
    const dayCards = page.locator("h3").filter({ hasText: /Lundi|Mercredi|Vendredi/ })
    await expect(dayCards.first()).toBeVisible({ timeout: 30_000 })

    // Dot indicators — small round buttons below the carousel
    const dots = page.locator("div.flex.items-center.justify-center button.rounded-full")
    await expect(dots).toHaveCount(3, { timeout: 5_000 })

    // Click the second dot to navigate to the second day
    await dots.nth(1).click()
    await page.waitForTimeout(500)

    // The second day card should now be the active one (visible)
    const secondDayLabel = dayCards.filter({ hasText: /Mercredi/ })
    await expect(secondDayLabel).toBeVisible({ timeout: 5_000 })

    // Click the third dot
    await dots.nth(2).click()
    await page.waitForTimeout(500)

    const thirdDayLabel = dayCards.filter({ hasText: /Vendredi/ })
    await expect(thirdDayLabel).toBeVisible({ timeout: 5_000 })
  })

  test("quick workout accessible from side drawer", async ({ page }) => {
    await page.goto("/")

    const notifDialog = page.getByRole("dialog", {
      name: /enable notifications/i,
    })
    try {
      await expect(notifDialog).toBeVisible({ timeout: 2_500 })
      await notifDialog.getByRole("button", { name: /not now/i }).click()
      await expect(notifDialog).not.toBeVisible()
    } catch {
      /* dialog didn't appear */
    }

    // Wait for page to load
    const dayCard = page.locator("h3").filter({ hasText: /Lundi|Mercredi|Vendredi/ }).first()
    await expect(dayCard).toBeVisible({ timeout: 30_000 })

    // Open the side drawer
    const menuButton = page.getByRole("button", { name: /open menu/i })
    await menuButton.click()

    // Quick workout entry should be in the drawer
    const quickWorkoutButton = page.getByRole("button", { name: /quick workout/i })
    await expect(quickWorkoutButton).toBeVisible({ timeout: 3_000 })

    // Click it — should open the QuickWorkoutSheet
    await quickWorkoutButton.click()

    // The drawer for quick workout generation should appear
    const quickWorkoutDrawer = page.getByRole("dialog", { name: /quick workout/i })
    await expect(quickWorkoutDrawer).toBeVisible({ timeout: 5_000 })
  })
})
