/**
 * HITL: achievements Tour shot — tracks overview + unlocked step detail.
 *
 *   CAPTURE_APP_ORIGIN=http://localhost:5174 npx tsx scripts/capture-tour-achievements.ts
 */

import "./load-env.js"
import { chromium } from "@playwright/test"
import {
  OUT_DIR,
  assertAuthReady,
  assertAuthenticated,
  dismissNoise,
  phoneContextOptions,
  resolveAppOrigin,
  shot,
} from "./capture-tour-shared.js"

async function main() {
  assertAuthReady()
  const appOrigin = await resolveAppOrigin()
  console.log(`[capture-achievements] origin=${appOrigin} out=${OUT_DIR}`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext(phoneContextOptions())
  const page = await context.newPage()

  await page.goto(new URL("/achievements", appOrigin).toString(), {
    waitUntil: "networkidle",
  })
  await assertAuthenticated(page)
  await dismissNoise(page)
  await page.getByRole("heading", { name: /^achievements$/i }).waitFor({
    state: "visible",
    timeout: 15_000,
  })
  await page.getByText(/^Volume$/i).waitFor({ state: "visible", timeout: 10_000 })
  await page.waitForTimeout(600)

  await shot(page, "07c-achievements-tracks")

  const volumeCard = page
    .locator(".rounded-xl.border")
    .filter({ hasText: /Volume/i })
    .first()
  await volumeCard.scrollIntoViewIfNeeded()
  const tierRow = volumeCard.locator(".flex.justify-center.gap-3")
  await tierRow.waitFor({ state: "visible", timeout: 8_000 })
  const tierBtns = tierRow.locator("button")
  const count = await tierBtns.count()
  await tierBtns.nth(count >= 2 ? 1 : 0).click()
  await page
    .getByRole("button", { name: /equip title|unequip title/i })
    .waitFor({ state: "visible", timeout: 8_000 })
  await page.waitForTimeout(400)

  await shot(page, "07c-history-achievements")

  await browser.close()
  console.log("[capture-achievements] Done — tracks overview + Volume Silver detail")
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
