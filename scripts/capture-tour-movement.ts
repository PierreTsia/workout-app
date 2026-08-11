/**
 * HITL: capture “Know the movement” Tour shots (06a / 06b / 06c).
 *
 * 06a = search + filters open (catalog story).
 * 06b/06c = Bench Press detail / video on hosted catalog.
 *
 *   CAPTURE_APP_ORIGIN=http://localhost:5174 npx tsx scripts/capture-tour-movement.ts
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

/** Hosted `Développé couché` / Bench Press — has instructions_en + youtube_url. */
const BENCH_PRESS_ID = "dbfb1939-bdcb-4d25-873c-f4f03c6b44f2"

async function scrollIntoView(page: Page, locator: ReturnType<Page["locator"]>) {
  const el = locator.first()
  await el.waitFor({ state: "visible", timeout: 15_000 })
  await el.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
}

async function main() {
  assertAuthReady()
  const appOrigin = await resolveAppOrigin()
  console.log(`[capture-movement] origin=${appOrigin}`)
  console.log(`[capture-movement] out=${OUT_DIR}`)
  console.log(`[capture-movement] exercise=${BENCH_PRESS_ID} (Bench Press)`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext(phoneContextOptions())
  const page = await context.newPage()

  // ── 06a: searchable catalog + filters ─────────────────────────────
  console.log("[capture-movement] 06a-movement-list (search + filters)")
  await page.goto(new URL("/library/exercises", appOrigin).toString(), {
    waitUntil: "networkidle",
  })
  await assertAuthenticated(page)
  await dismissNoise(page)

  const search = page.getByRole("searchbox", { name: /search exercises/i }).or(
    page.getByPlaceholder(/search exercises/i),
  )
  await search.waitFor({ state: "visible", timeout: 15_000 })
  await search.fill("press")
  await page.getByRole("button", { name: /^filters$/i }).click()
  await page.waitForTimeout(500)
  // Pick a muscle chip if the panel exposes one (Shoulders sells OHP story).
  const shoulders = page.getByRole("button", { name: /^shoulders$/i }).or(
    page.getByText(/^shoulders$/i),
  )
  if (await shoulders.first().isVisible().catch(() => false)) {
    await shoulders.first().click()
    await page.waitForTimeout(600)
  }
  await shot(page, "06a-movement-list")
  await shot(page, "06-movement-search-filters")

  const detailUrl = new URL(
    `/library/exercises/${BENCH_PRESS_ID}`,
    appOrigin,
  ).toString()

  await page.goto(detailUrl, { waitUntil: "networkidle" })
  await assertAuthenticated(page)
  await dismissNoise(page)

  await page.getByRole("heading", { name: /bench press/i }).waitFor({
    state: "visible",
    timeout: 20_000,
  })

  // Instructions start expanded on the library detail page.
  const howTo = page.getByText(/how to perform/i)
  await howTo.waitFor({ state: "visible", timeout: 15_000 })
  await scrollIntoView(page, page.getByText(/setup/i))
  // Prefer a movement/setup bullet visible for a rich instructions frame.
  await page.getByText(/setup/i).first().waitFor({ state: "visible" })

  console.log("[capture-movement] 06b-movement-detail")
  await shot(page, "06b-movement-detail")

  // Video: scroll to YouTube block, show thumbnail then click play for embed.
  const watchLink = page.getByRole("link", { name: /watch on youtube/i })
  await scrollIntoView(page, watchLink)
  // Click the play overlay (thumbnail button above the link).
  const playBtn = page.locator("button").filter({ has: page.locator("svg") }).last()
  // More reliable: the aspect-video play button near Watch on YouTube
  const videoRegion = watchLink.locator("xpath=preceding-sibling::div[1]")
  const playOverlay = videoRegion.locator("button").first()
  if (await playOverlay.isVisible().catch(() => false)) {
    await playOverlay.click()
    await page.waitForTimeout(1200)
  } else if (await playBtn.isVisible().catch(() => false)) {
    await playBtn.click()
    await page.waitForTimeout(1200)
  }

  console.log("[capture-movement] 06c-movement-video")
  await scrollIntoView(page, watchLink)
  await shot(page, "06c-movement-video")

  await browser.close()
  console.log(
    "[capture-movement] Done. Review:\n" +
      "  06a-movement-list.png (+ 06-movement-search-filters draft)\n" +
      "  06b-movement-detail.png\n" +
      "  06c-movement-video.png",
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
