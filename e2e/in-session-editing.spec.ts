import { expect, test, type Page } from "@playwright/test"

const T = {
  page: 25_000,
  picker: 18_000,
  dialog: 8_000,
  short: 4_000,
  notif: 2_500,
} as const

async function dismissNotificationPrompt(page: Page) {
  const notifDialog = page.getByRole("dialog", {
    name: /enable notifications/i,
  })
  try {
    await expect(notifDialog).toBeVisible({ timeout: T.notif })
    await notifDialog.getByRole("button", { name: /not now/i }).click()
    await expect(notifDialog).not.toBeVisible({ timeout: T.short })
  } catch {
    /* permission already set or dialog skipped */
  }
}

async function waitPickerLoaded(dialog: ReturnType<Page["getByRole"]>) {
  await expect(dialog.locator(".animate-spin")).toHaveCount(0, {
    timeout: T.picker,
  })
}

test.describe("In-session exercise editing", () => {
  test.describe.configure({ timeout: 70_000 })

  test("session-only add during active workout → extra strip chip", async ({
    page,
  }) => {
    await page.goto("/")
    await dismissNotificationPrompt(page)

    await expect(
      page.locator("h3").filter({ hasText: /Lundi|Mercredi|Vendredi/ }).first(),
    ).toBeVisible({ timeout: T.page })

    const startButton = page.getByRole("button", { name: /start workout/i })
    await expect(startButton).toBeVisible({ timeout: 5_000 })
    await startButton.click()

    await expect(
      page.locator(".font-mono.tabular-nums.text-primary"),
    ).toBeVisible({ timeout: T.dialog })

    const stripButtons = page.locator("div.flex.overflow-x-auto > button")
    await expect(stripButtons.first()).toBeVisible({ timeout: 15_000 })
    const countBefore = await stripButtons.count()

    await page.getByRole("button", { name: /add exercise/i }).click()

    const picker = page.getByRole("dialog", { name: /^add exercise$/i })
    await expect(picker).toBeVisible({ timeout: T.dialog })
    await waitPickerLoaded(picker)

    await picker.locator("button.min-w-0.flex-1").first().click({
      timeout: T.picker,
    })

    const scope = page.getByRole("dialog", { name: /add exercise how\?/i })
    await expect(scope).toBeVisible({ timeout: T.dialog })
    await scope.getByRole("button", { name: /just this session/i }).click()
    await expect(scope).not.toBeVisible({ timeout: T.short })

    await expect(stripButtons).toHaveCount(countBefore + 1, { timeout: T.short })
  })

  test("session-only swap during active workout → detail title changes", async ({
    page,
  }) => {
    await page.goto("/")
    await dismissNotificationPrompt(page)

    await expect(
      page.locator("h3").filter({ hasText: /Lundi|Mercredi|Vendredi/ }).first(),
    ).toBeVisible({ timeout: T.page })

    await page.getByRole("button", { name: /start workout/i }).click()
    await expect(
      page.locator(".font-mono.tabular-nums.text-primary"),
    ).toBeVisible({ timeout: T.dialog })

    await expect(
      page.locator("div.flex.overflow-x-auto > button").first(),
    ).toBeVisible({ timeout: 15_000 })

    const title = page.locator("h2.text-xl.font-bold")
    const nameBefore = await title.innerText()

    await page.getByRole("button", { name: "Exercise actions" }).click()
    await page.getByRole("menuitem", { name: /swap exercise/i }).click()

    await page.getByRole("tab", { name: /all exercises/i }).click()
    await page.getByRole("button", { name: /browse full library/i }).click()

    const swapSheet = page.getByRole("dialog", { name: /choose replacement/i })
    await expect(swapSheet).toBeVisible({ timeout: T.dialog })
    await waitPickerLoaded(swapSheet)

    await swapSheet.locator("button.min-w-0.flex-1").first().click({
      timeout: T.picker,
    })

    const scope = page.getByRole("dialog", { name: /apply swap how\?/i })
    await expect(scope).toBeVisible({ timeout: T.dialog })
    await scope.getByRole("button", { name: /just this session/i }).click()
    await expect(scope).not.toBeVisible({ timeout: T.short })

    await expect(title).not.toHaveText(nameBefore, { timeout: T.short })
  })
})
