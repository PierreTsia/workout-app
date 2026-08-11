/**
 * HITL helper: capture a subset of Tour shots from the Prime Mover session.
 *
 * Prerequisites:
 *   1. npm run seed:prime-mover
 *   2. PRIME_MOVER_PASSWORD set → npx tsx scripts/capture-tour-auth.ts
 *   3. App running against **hosted** Supabase at CAPTURE_APP_ORIGIN:
 *        npm run dev:hosted
 *      (plain `npm run dev` often uses `.env.local` → loopback and ignores
 *      the Prime Mover session token)
 *
 * Writes PNGs under playwright/.auth/tour-captures/ (gitignored).
 * After framing approval, copy/convert into web/src/assets/screenshots/tour/.
 *
 * Does NOT claim visual closeout — human must approve framing (T182).
 *
 *   npx tsx scripts/capture-tour-screens.ts
 */

import "./load-env.js"
import fs from "node:fs"
import path from "node:path"
import { chromium } from "@playwright/test"
import {
  OUT_DIR,
  assertAuthReady,
  assertAuthenticated,
  desktopContextOptions,
  dismissNoise,
  phoneContextOptions,
  resolveAppOrigin,
} from "./capture-tour-shared.js"

type Shot = {
  id: string
  path: string
  viewport: "phone" | "desktop"
  goto: string
  /** Optional post-nav action before screenshot. */
  prepare?: (page: import("@playwright/test").Page) => Promise<void>
}

const SHOTS: Shot[] = [
  {
    id: "06a-movement-list",
    path: "/library/exercises",
    viewport: "phone",
    goto: "/library/exercises",
    prepare: async (page) => {
      const search = page
        .getByRole("searchbox", { name: /search exercises/i })
        .or(page.getByPlaceholder(/search exercises/i))
      await search.waitFor({ state: "visible", timeout: 15_000 })
      await search.fill("press")
      await page.getByRole("button", { name: /^filters$/i }).click()
      await page.waitForTimeout(500)
      const shoulders = page.getByRole("button", { name: /^shoulders$/i })
      if (await shoulders.first().isVisible().catch(() => false)) {
        await shoulders.first().click()
        await page.waitForTimeout(600)
      }
    },
  },
  {
    id: "07a-history-heatmap",
    path: "/history",
    viewport: "phone",
    goto: "/history",
  },
  {
    id: "07b-history-balance",
    path: "/history",
    viewport: "phone",
    goto: "/history",
    prepare: async (page) => {
      // Bail early if session injection failed (login / marketing shell).
      const balanceTab = page.getByRole("tab", { name: /^balance$/i })
      await balanceTab.waitFor({ state: "visible", timeout: 15_000 })
      await balanceTab.click()
      await page
        .getByText(/needs attention|balanced|skewed|imbalanced/i)
        .or(page.getByText(/last 30 days/i))
        .first()
        .waitFor({ state: "visible", timeout: 15_000 })
      await page.waitForTimeout(600)
    },
  },
  {
    id: "07b-history-balance-detail",
    path: "/history",
    viewport: "phone",
    goto: "/history",
    prepare: async (page) => {
      const balanceTab = page.getByRole("tab", { name: /^balance$/i })
      await balanceTab.waitFor({ state: "visible", timeout: 15_000 })
      await balanceTab.click()
      const insights = page.getByText("Insights", { exact: true })
      await insights.waitFor({ state: "visible", timeout: 15_000 })
      // History scrolls on the document — wheel beats overflow-y queries.
      await insights.scrollIntoViewIfNeeded()
      await page.mouse.wheel(0, 280)
      const breakdownBtn = page.getByRole("button", {
        name: /per-muscle breakdown/i,
      })
      if (await breakdownBtn.isVisible().catch(() => false)) {
        const expanded = await breakdownBtn.getAttribute("aria-expanded")
        if (expanded === "false") await breakdownBtn.click()
      }
      await page.waitForTimeout(400)
    },
  },
  {
    id: "07c-achievements-tracks",
    path: "/achievements",
    viewport: "phone",
    goto: "/achievements",
    prepare: async (page) => {
      await page.getByRole("heading", { name: /^achievements$/i }).waitFor({
        state: "visible",
        timeout: 15_000,
      })
      // Ensure in-progress tracks are expanded so all tier steps show.
      await page.getByText(/^Consistency$/i).waitFor({ state: "visible", timeout: 10_000 })
      await page.waitForTimeout(600)
    },
  },
  {
    id: "07c-history-achievements",
    path: "/achievements",
    viewport: "phone",
    goto: "/achievements",
    prepare: async (page) => {
      await page.getByRole("heading", { name: /^achievements$/i }).waitFor({
        state: "visible",
        timeout: 15_000,
      })
      await page.getByText(/^Volume$/i).waitFor({ state: "visible", timeout: 10_000 })
      await page.waitForTimeout(500)

      // Volume is Silver in the Prime Mover seed — open that unlocked step's detail.
      // AccordionTrigger is also a <button>; only click the tier row inside content.
      const volumeCard = page
        .locator(".rounded-xl.border")
        .filter({ hasText: /Volume/i })
        .first()
      await volumeCard.scrollIntoViewIfNeeded()
      const tierRow = volumeCard.locator(".flex.justify-center.gap-3")
      await tierRow.waitFor({ state: "visible", timeout: 8_000 })
      const tierBtns = tierRow.locator("button")
      const count = await tierBtns.count()
      await tierBtns.nth(count >= 2 ? 1 : 0).click() // Silver when seeded
      await page
        .getByRole("button", { name: /equip title|unequip title/i })
        .waitFor({ state: "visible", timeout: 8_000 })
      await page.waitForTimeout(400)
    },
  },
  {
    id: "05c-agent-result",
    path: "/library/programs",
    viewport: "desktop",
    goto: "/library/programs",
  },
]

async function main() {
  assertAuthReady()
  const appOrigin = await resolveAppOrigin()
  console.log(`[capture] origin=${appOrigin}`)
  console.log(
    `[capture] phone viewport=${phoneContextOptions().viewport?.width}×${phoneContextOptions().viewport?.height}`,
  )

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const browser = await chromium.launch({ headless: true })

  for (const shotSpec of SHOTS) {
    const context = await browser.newContext(
      shotSpec.viewport === "phone" ? phoneContextOptions() : desktopContextOptions(),
    )
    const page = await context.newPage()
    const url = new URL(shotSpec.goto, appOrigin).toString()
    console.log(`[capture] ${shotSpec.id} ← ${url}`)
    await page.goto(url, { waitUntil: "networkidle" })
    await assertAuthenticated(page)
    await dismissNoise(page)
    if (shotSpec.prepare) await shotSpec.prepare(page)
    await page.waitForTimeout(500)
    const out = path.join(OUT_DIR, `${shotSpec.id}.png`)
    await page.screenshot({ path: out, fullPage: false })
    console.log(`  → ${out}`)
    await context.close()
  }

  await browser.close()
  console.log(
    `[capture] Wrote ${SHOTS.length} drafts under ${OUT_DIR}\n` +
      "Review framing, then replace web/src/assets/screenshots/tour/ (HITL / T182).",
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
