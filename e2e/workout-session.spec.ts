import { test, expect } from "@playwright/test"

test.describe("Workout session — full flow", () => {
  test("select day, log 2 sets, rest timer, skip, finish, summary", async ({
    page,
  }) => {
    test.setTimeout(120_000)

    await page.goto("/")

    // AuthGuard shows a notification permission dialog (aria-modal blocks getByRole)
    const notifDialog = page.getByRole("dialog", {
      name: /enable notifications/i,
    })
    try {
      await expect(notifDialog).toBeVisible({ timeout: 5_000 })
      await notifDialog.getByRole("button", { name: /not now/i }).click()
      await expect(notifDialog).not.toBeVisible()
    } catch {
      /* dialog didn't appear — permission already granted */
    }

    // Bootstrap creates days with French labels — wait for any day button
    const dayButton = page
      .locator("button")
      .filter({ hasText: /Lundi|Mercredi|Vendredi/ })
      .first()
    await expect(dayButton).toBeVisible({ timeout: 60_000 })

    // Exercise strip should render once a day is selected (auto-selected on load)
    const exerciseChips = page.locator(
      "div.flex.overflow-x-auto > button",
    )
    await expect(exerciseChips.first()).toBeVisible({ timeout: 15_000 })

    // Start the workout session
    const startButton = page.getByRole("button", {
      name: /start workout/i,
    })
    await expect(startButton).toBeVisible({ timeout: 5_000 })
    await startButton.click()

    // Session timer chip should appear in the header
    const timerChip = page.locator(".font-mono.tabular-nums.text-primary")
    await expect(timerChip).toBeVisible({ timeout: 5_000 })

    // --- Log set 1 ---
    const checkboxes = page.getByRole("checkbox")
    await expect(checkboxes.first()).toBeVisible()
    await checkboxes.first().click()

    // RIR Drawer opens — confirm with default RIR
    const rirConfirmButton = page.getByRole("button", { name: /confirm/i })
    await expect(rirConfirmButton).toBeVisible({ timeout: 3_000 })
    await rirConfirmButton.click()

    // Row should be marked as done (bg-primary/10 class)
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
    // Click the last exercise chip in the strip to jump there
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

  test("allows day navigation but locks editing on non-active day", async ({
    page,
  }) => {
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
      /* dialog didn't appear — permission already granted */
    }

    const dayButtons = page
      .locator("button")
      .filter({ hasText: /Lundi|Mercredi|Vendredi/ })
    await expect(dayButtons.first()).toBeVisible({ timeout: 60_000 })
    await expect(dayButtons.nth(1)).toBeVisible({ timeout: 5_000 })

    const activeDayLabel =
      (await dayButtons.first().locator("span").last().textContent())?.trim() ??
      "Lundi"

    await page.getByRole("button", { name: /start workout/i }).click()
    await dayButtons.nth(1).click()

    await expect(
      page.getByText(/Session in progress on another day/i),
    ).toBeVisible()
    await expect(
      page.getByText(`Return to ${activeDayLabel} to continue or finish your active session.`),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: /add set/i }),
    ).toBeDisabled()

    await dayButtons.first().click()
    await expect(
      page.getByText(/Session in progress on another day/i),
    ).not.toBeVisible()
    await expect(
      page.getByRole("button", { name: /add set/i }),
    ).toBeEnabled()
  })
})
