import { test, expect, type Page } from "@playwright/test"

/**
 * QA pass for PR #691 (b138dd1) — throwaway, deleted after the run.
 *
 * Verifies: the four sync dot SHAPES still differ (offline ring / syncing pulse /
 * synced circle / failed square), the wrapper adds no width, the 360px session
 * header fits with and without RestTimerPill, and the Finish icon flow still works.
 */

test.describe.configure({ timeout: 120_000 })

const DIR = "/tmp/qa-691"

const shapeOf = (page: Page) =>
  page.getByTestId("sync-status-dot").locator("span[aria-hidden='true']")

async function headerOverflow(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector("header")
    return {
      page: document.documentElement.scrollWidth - window.innerWidth,
      header: header ? header.scrollWidth - header.clientWidth : -1,
    }
  })
}

async function assertInViewport(page: Page, locator: ReturnType<Page["locator"]>) {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(360)
}

test.describe("QA #691 — compact session header + sync dot shapes", () => {
  test("sync states, 360px header, finish icon flow", async ({
    page,
    context,
  }) => {
    const consoleErrors: string[] = []
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text())
    })
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`))

    await page.setViewportSize({ width: 360, height: 800 })
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

    const dot = page.getByTestId("sync-status-dot")
    const shape = shapeOf(page)

    // --- idle + online: indicator must render nothing -----------------------
    await expect(dot).toHaveCount(0)

    // --- start a session (Finish icon + timer chip live in the header) ------
    const startButton = page.getByRole("button", { name: /start workout/i })
    await expect(startButton).toBeVisible({ timeout: 30_000 })
    await startButton.click()
    await expect(page.getByTestId("session-timer-chip")).toBeVisible({
      timeout: 5_000,
    })
    const finishButton = page
      .locator("header")
      .getByRole("button", { name: "Finish" })
    await expect(finishButton).toBeVisible()
    await expect(finishButton.locator("svg")).toBeVisible()

    // =========================================================================
    // State 1 — offline (hollow ring), NO rest pill yet
    // =========================================================================
    await context.setOffline(true)
    await expect(dot).toBeVisible({ timeout: 10_000 })
    await expect(dot).toHaveAttribute("role", "status")
    await expect(dot.locator(".sr-only")).toHaveText(/offline/i)
    await expect(shape).toHaveClass(/rounded-full/)
    await expect(shape).toHaveClass(/border-muted-foreground/)
    await expect(shape).not.toHaveClass(/bg-green-500/)
    // wrapper adds no meaningful width over its 10px dot
    const dotBox0 = await dot.boundingBox()
    const shapeBox0 = await shape.boundingBox()
    expect(Math.abs((dotBox0?.width ?? 0) - (shapeBox0?.width ?? 0))).toBeLessThanOrEqual(1)
    expect(dotBox0?.width ?? 99).toBeLessThanOrEqual(14)
    await page.screenshot({ path: `${DIR}/01-offline-dot-no-pill.png` })

    // 360px header WITHOUT RestTimerPill
    const noPillOverflow = await headerOverflow(page)
    expect(noPillOverflow.page).toBeLessThanOrEqual(1)
    expect(noPillOverflow.header).toBeLessThanOrEqual(1)
    await assertInViewport(page, finishButton)
    await assertInViewport(page, dot)

    // =========================================================================
    // State 2 — OFFline + RestTimerPill (max header pressure), log a set offline
    // =========================================================================
    const checkbox = page.getByRole("checkbox").first()
    await expect(checkbox).toBeVisible()
    await checkbox.click()
    const rirConfirm = page.getByRole("button", { name: /confirm/i })
    await expect(rirConfirm).toBeVisible({ timeout: 3_000 })
    await rirConfirm.click()
    await expect(
      page.getByRole("button", { name: /open rest timer/i }),
    ).toBeVisible({ timeout: 3_000 })

    const withPillOverflow = await headerOverflow(page)
    expect(withPillOverflow.page).toBeLessThanOrEqual(1)
    expect(withPillOverflow.header).toBeLessThanOrEqual(1)
    await assertInViewport(page, finishButton)
    await assertInViewport(page, dot)
    await page.screenshot({ path: `${DIR}/02-360px-offline-dot-rest-pill.png` })

    // =========================================================================
    // State 3 — failed (red square, rounded-[2px])
    // =========================================================================
    await page.route("**/rest/v1/**", (route) => route.abort())
    await context.setOffline(false)
    await expect(shape).toHaveClass(/rounded-\[2px\]/, { timeout: 20_000 })
    await expect(shape).toHaveClass(/bg-destructive/)
    await expect(shape).not.toHaveClass(/rounded-full/)
    await expect(dot.locator(".sr-only")).toHaveText(/sync failed/i)
    await page.screenshot({ path: `${DIR}/03-failed-square-dot.png` })
    await page.unroute("**/rest/v1/**")

    // =========================================================================
    // State 4 — syncing (amber pulse) then synced (green circle)
    // =========================================================================
    let delayed = false
    await page.route("**/rest/v1/**", async (route) => {
      if (!delayed) {
        delayed = true
        await new Promise((r) => setTimeout(r, 4_000))
      }
      await route.continue()
    })
    // Re-arm the drain: offline → online transition fires the `online` event.
    await context.setOffline(true)
    await page.waitForTimeout(200)
    await context.setOffline(false)
    await expect(shape).toHaveClass(/animate-pulse/, { timeout: 12_000 })
    await expect(shape).toHaveClass(/bg-amber-500/)
    await expect(dot.locator(".sr-only")).toHaveText(/syncing/i)
    await page.screenshot({ path: `${DIR}/04-syncing-pulse-dot.png` })

    await expect(shape).toHaveClass(/bg-green-500/, { timeout: 20_000 })
    await expect(shape).toHaveClass(/rounded-full/)
    await expect(dot.locator(".sr-only")).toHaveText(/synced/i)
    await page.screenshot({ path: `${DIR}/05-synced-circle-dot.png` })

    // =========================================================================
    // Finish icon flow after the shape checks
    // =========================================================================
    await expect(finishButton).toBeVisible()
    expect(await finishButton.getAttribute("aria-label")).toBe("Finish")
    await finishButton.click()
    const confirmDialog = page.getByRole("dialog")
    await expect(confirmDialog).toBeVisible({ timeout: 3_000 })
    await confirmDialog.getByRole("button", { name: /finish/i }).click()
    await expect(page.getByText(/session complete/i)).toBeVisible({
      timeout: 8_000,
    })
    await page.screenshot({ path: `${DIR}/06-finish-summary.png` })

    console.log(`QA_CONSOLE_ERRORS=${JSON.stringify(consoleErrors)}`)
  })
})
