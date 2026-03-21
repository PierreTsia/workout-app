import { expect, test, type Page } from "@playwright/test"

/** Tighter caps so failures surface quickly; bump if local Supabase is very slow. */
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

async function gotoWorkoutHomeReady(page: Page) {
  await page.goto("/")
  await dismissNotificationPrompt(page)
  await expect(
    page.locator("h3").filter({ hasText: /Lundi|Mercredi|Vendredi/ }).first(),
  ).toBeVisible({ timeout: T.page })
  const rowMenu = page.getByRole("button", { name: "Exercise actions" }).first()
  await expect(rowMenu).toBeVisible({ timeout: T.picker })
  await expect(rowMenu).toBeEnabled({ timeout: T.picker })
}

async function waitPickerLoaded(dialog: ReturnType<Page["getByRole"]>) {
  await expect(dialog.locator(".animate-spin")).toHaveCount(0, {
    timeout: T.picker,
  })
}

test.describe("Pre-session exercise editing", () => {
  test.describe.configure({ timeout: 70_000 })

  test("session-only add: picker → scope → extra row", async ({ page }) => {
    await gotoWorkoutHomeReady(page)

    const rowActionTriggers = page.getByRole("button", {
      name: "Exercise actions",
    })
    await expect(rowActionTriggers).toHaveCount(1)

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
    await expect(rowActionTriggers).toHaveCount(2, { timeout: T.short })
  })

  test("session-only swap (full library) → start workout", async ({ page }) => {
    await gotoWorkoutHomeReady(page)

    const nameHeading = page.locator(".text-sm.font-medium.text-foreground")
    const nameBefore = await nameHeading.first().innerText()

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

    await expect(nameHeading.first()).not.toHaveText(nameBefore, {
      timeout: T.short,
    })

    await page.getByRole("button", { name: /start workout/i }).click()

    await expect(
      page.locator(".font-mono.tabular-nums.text-primary"),
    ).toBeVisible({ timeout: T.dialog })
  })
})
