/**
 * HITL: full-phone in-session shot with BodyMap as the hero (OHP).
 *
 *   CAPTURE_APP_ORIGIN=http://localhost:5174 npx tsx scripts/capture-tour-bodymap.ts
 */

import "./load-env.js"
import { chromium, type Page } from "@playwright/test"
import {
  OUT_DIR,
  assertAuthReady,
  assertAuthenticated,
  dismissNoise,
  phoneContextOptions,
  resolveAppOrigin,
  shot,
} from "./capture-tour-shared.js"

async function discardActiveSession(page: Page) {
  const cancelBtn = page.getByTestId("session-cancel-button")
  if (!(await cancelBtn.isVisible().catch(() => false))) return
  await cancelBtn.click()
  await page.getByTestId("session-cancel-confirm").click()
  await page.getByRole("button", { name: /start workout/i }).waitFor({
    state: "visible",
    timeout: 10_000,
  })
}

async function frameBodyMap(page: Page) {
  // react-body-highlighter renders SVG models; prefer the session map under
  // the exercise header (not a tiny thumbnail in the rail).
  const map = page.locator("svg").nth(1)
  await map.waitFor({ state: "visible", timeout: 15_000 })

  await page.evaluate(() => {
    const title = Array.from(document.querySelectorAll("h2, h3, p")).find((el) =>
      /seated dumbbell overhead press/i.test(el.textContent ?? ""),
    )
    const svgs = Array.from(document.querySelectorAll("svg"))
    const mapEl =
      svgs.find((svg) => {
        const r = svg.getBoundingClientRect()
        return r.height > 120 && r.width > 120
      }) ?? svgs[1]
    if (!mapEl) return

    const scrollRoot =
      document.querySelector("[data-session-scroll]") ??
      document.scrollingElement ??
      document.documentElement

    const titleTop = title?.getBoundingClientRect().top ?? 0
    const mapTop = mapEl.getBoundingClientRect().top
    // Keep exercise title + last-time above the map; leave timer chrome.
    const delta = title ? titleTop - 72 : mapTop - 160
    scrollRoot.scrollBy({ top: delta, behavior: "instant" as ScrollBehavior })
  })
  await page.waitForTimeout(500)
}

async function main() {
  assertAuthReady()
  const appOrigin = await resolveAppOrigin()
  console.log(`[capture-bodymap] origin=${appOrigin}`)
  console.log(`[capture-bodymap] out=${OUT_DIR}`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext(phoneContextOptions())
  const page = await context.newPage()

  await page.goto(new URL("/", appOrigin).toString(), { waitUntil: "networkidle" })
  await assertAuthenticated(page)
  await dismissNoise(page)
  await discardActiveSession(page)

  await page.getByRole("button", { name: /go to Push/i }).click()
  await page.waitForTimeout(500)
  await page.getByRole("button", { name: /start workout/i }).click()
  await page.getByRole("checkbox").first().waitFor({ state: "visible", timeout: 15_000 })
  await page.getByText(/seated dumbbell overhead press/i).first().click()
  await page.waitForTimeout(1000)

  await page.getByText(/last time:/i).waitFor({ state: "visible", timeout: 10_000 })
  await frameBodyMap(page)

  await shot(page, "02-bodymap-ohp")
  // Same framing is the natural 02c “last performance + context” money shot.
  await shot(page, "02c-train-last")

  await discardActiveSession(page)
  await browser.close()
  console.log("[capture-bodymap] Done — 02-bodymap-ohp + 02c-train-last")
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
