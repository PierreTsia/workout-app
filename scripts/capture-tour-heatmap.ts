/**
 * HITL: Activity 100-day heatmap for Tour 07a (and optional By-Exercise draft).
 *
 *   CAPTURE_APP_ORIGIN=http://localhost:5174 npx tsx scripts/capture-tour-heatmap.ts
 */

import "./load-env.js"
import { chromium } from "@playwright/test"
import {
  AUTH_STATE,
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
  console.log(`[capture-heatmap] origin=${appOrigin} out=${OUT_DIR}`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext(phoneContextOptions())
  const page = await context.newPage()

  await page.goto(new URL("/history", appOrigin).toString(), {
    waitUntil: "networkidle",
  })
  await assertAuthenticated(page)
  await dismissNoise(page)

  await page.getByRole("tab", { name: /^activity$/i }).click()
  const heatmapTrigger = page.getByRole("button", { name: /100-day overview/i })
  await heatmapTrigger.waitFor({ state: "visible", timeout: 15_000 })
  if ((await heatmapTrigger.getAttribute("aria-expanded")) !== "true") {
    await heatmapTrigger.click()
  }
  await page.getByText(/^less$/i).or(page.getByText(/less/i)).first().waitFor({
    state: "visible",
    timeout: 15_000,
  })
  await heatmapTrigger.scrollIntoViewIfNeeded()
  await page.mouse.wheel(0, 60)
  await page.waitForTimeout(700)
  await shot(page, "07a-history-heatmap")

  // Bank denser alternative: OHP exercise history chart.
  await page.getByRole("tab", { name: /by exercise/i }).click()
  await page.getByRole("combobox").click()
  const ohp = page.getByRole("option", {
    name: /seated dumbbell overhead press|overhead press/i,
  })
  if (await ohp.first().isVisible().catch(() => false)) {
    await ohp.first().click()
  } else {
    await page.getByText(/overhead press/i).first().click()
  }
  await page.waitForTimeout(1500)
  await shot(page, "07a-history-exercise-chart")

  await browser.close()
  console.log("[capture-heatmap] Done — 07a heatmap + exercise-chart draft")
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
