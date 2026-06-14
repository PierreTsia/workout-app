import { test, expect } from "@playwright/test"

/**
 * A block is one navigable slot in the session sequence (#351): it shows in the
 * carousel, opens an inline card, and launches the round-by-round runner.
 * Relies on the "E2E Circuit" block seeded on Vendredi by global-setup.
 */
test.describe("Block session — circuit in the sequence", () => {
  test.describe.configure({ timeout: 90_000 })

  async function dismissNotif(page: import("@playwright/test").Page) {
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
  }

  test("navigate to a block slot, run every round, complete it", async ({
    page,
  }) => {
    await page.goto("/")
    await dismissNotif(page)

    // Hop to Vendredi (3rd day) — the one carrying the seeded block.
    const dayCards = page
      .locator("h3")
      .filter({ hasText: /Lundi|Mercredi|Vendredi/ })
    await expect(dayCards.first()).toBeVisible({ timeout: 30_000 })
    const dots = page.getByRole("button", { name: /^(aller à|go to)\s/i })
    await expect(dots).toHaveCount(3, { timeout: 5_000 })
    await dots.nth(2).click()
    await expect(
      page.locator("h3").filter({ hasText: /Vendredi/ }),
    ).toBeVisible({ timeout: 5_000 })

    // Gate on pre-session hydration, then start.
    const exerciseRowMenu = page
      .getByRole("button", { name: "Exercise actions" })
      .first()
    await expect(exerciseRowMenu).toBeVisible({ timeout: 20_000 })
    await expect(exerciseRowMenu).toBeEnabled({ timeout: 20_000 })

    await page.getByRole("button", { name: /start workout/i }).click()
    await expect(page.getByTestId("session-timer-chip")).toBeVisible({
      timeout: 5_000,
    })

    // The block appears as a slot in the carousel — select it.
    const blockChip = page.getByTestId("strip-block-item")
    await expect(blockChip).toBeVisible({ timeout: 15_000 })
    await blockChip.click()

    // Inline block card → launch the runner. Scope to the heading: the label
    // also renders in the carousel chip, so a bare getByText is ambiguous.
    await expect(
      page.getByRole("heading", { name: "E2E Circuit" }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Start" }).click()

    // Runner is up: round progress reads 1/2.
    await expect(page.getByTestId("block-round-count")).toHaveText("1/2", {
      timeout: 5_000,
    })

    // 2 exercises × 2 rounds, zero rest/transition → 4 logs to completion.
    const logButton = page.getByRole("button", { name: "Log", exact: true })
    for (let i = 0; i < 4; i++) {
      await expect(logButton).toBeVisible()
      await logButton.click()
    }

    await expect(page.getByText(/circuit complete/i)).toBeVisible({
      timeout: 5_000,
    })

    // Exit back to the session — the block card now reads as completed.
    await page.getByRole("button", { name: /back to session/i }).click()
    await expect(
      page.getByRole("heading", { name: "E2E Circuit" }),
    ).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/completed/i)).toBeVisible({ timeout: 5_000 })
    await expect(
      page.getByRole("button", { name: /restart/i }),
    ).toBeVisible()
  })
})
