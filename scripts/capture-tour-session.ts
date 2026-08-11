/**
 * HITL: capture in-session Tour shots (scene 02) for Prime Mover.
 *
 *   02c-train-last   — “Last time: …” before logging
 *   02b-train-rir    — RIR drawer open
 *   02-rest-timer    — rest timer drawer (extra draft)
 *   02a-train-sets   — mid-session: some sets done, reps visible, progression popover open
 *
 * Prerequisites: seed + auth + `npm run dev:hosted`
 *
 *   CAPTURE_APP_ORIGIN=http://localhost:5174 npx tsx scripts/capture-tour-session.ts
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

async function ensurePushDay(page: Page) {
  const pushHeading = page.locator("h3").filter({ hasText: /^Push$/i })
  if (await pushHeading.isVisible().catch(() => false)) return

  const pushChip = page.getByText(/^Push$/i).first()
  if (await pushChip.isVisible().catch(() => false)) {
    await pushChip.click()
    return
  }

  for (let i = 0; i < 5; i++) {
    if (await pushHeading.isVisible().catch(() => false)) return
    await page.keyboard.press("ArrowRight")
    await page.waitForTimeout(400)
  }
}

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

async function completeOneSet(page: Page) {
  await page.locator("[role='checkbox'][data-state='unchecked']").first().click()
  const rirConfirm = page.getByRole("button", { name: /confirm/i })
  await rirConfirm.waitFor({ state: "visible", timeout: 5_000 })
  await rirConfirm.click()
  const restPill = page.getByRole("button", { name: /open rest timer/i })
  try {
    await restPill.waitFor({ state: "visible", timeout: 4_000 })
    await restPill.click()
    const dialog = page.getByRole("dialog")
    await dialog.waitFor({ state: "visible", timeout: 3_000 })
    await dialog.getByRole("button", { name: /skip/i }).click()
    await restPill.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => undefined)
  } catch {
    /* rest pill may not appear */
  }
  await page.waitForTimeout(400)
}

async function startWorkout(page: Page) {
  await ensurePushDay(page)
  await discardActiveSession(page)

  const abandonCta = page.getByRole("button", { name: /restart cycle/i })
  if (await abandonCta.isVisible().catch(() => false)) {
    await abandonCta.click()
    await page.getByRole("button", { name: /close and restart/i }).click()
    await page.waitForTimeout(800)
  }

  const start = page.getByRole("button", { name: /start workout/i })
  await start.waitFor({ state: "visible", timeout: 20_000 })
  await start.click()

  await page
    .locator(".font-mono.tabular-nums.text-primary")
    .or(page.getByTestId("session-timer-chip"))
    .first()
    .waitFor({ state: "visible", timeout: 15_000 })

  await page.getByRole("checkbox").first().waitFor({ state: "visible", timeout: 15_000 })
  await page.waitForTimeout(1200)

  // Tour lead: OHP (Weight-up staged there), not bench.
  const ohp = page.getByText(/seated dumbbell overhead press|overhead press/i).first()
  await ohp.waitFor({ state: "visible", timeout: 10_000 })
  await ohp.click()
  await page.waitForTimeout(800)
}

async function openProgressionPopover(page: Page) {
  // Pill labels like "Weight up +2.5 kg" / "Hold" / "Reps up …"
  const pill = page
    .getByRole("button", { name: /weight up|reps up|hold|plateau|sets up|duration up/i })
    .or(page.locator('[class*="cursor-pointer"]').filter({ hasText: /weight up|reps up|hold/i }))
    .first()

  // Badge-as-trigger may not expose button role — click by text.
  const byText = page.getByText(/weight up|reps up|\bhold\b|plateau|sets up/i).first()
  if (await byText.isVisible().catch(() => false)) {
    await byText.click()
  } else {
    await pill.click()
  }

  // Popover body: detail copy under the reason.
  await page
    .locator('[data-slot="popover-content"], [role="dialog"], [data-radix-popper-content-wrapper]')
    .filter({ hasText: /last time|keeping|adding|suggest|auto|kg|rep/i })
    .first()
    .waitFor({ state: "visible", timeout: 5_000 })
    .catch(async () => {
      // Radix popover content — any visible popover panel
      await page.locator("[data-state='open']").last().waitFor({ state: "visible", timeout: 3_000 })
    })
  await page.waitForTimeout(300)
}

async function main() {
  assertAuthReady()
  const appOrigin = await resolveAppOrigin()
  console.log(`[capture-session] origin=${appOrigin}`)
  console.log(`[capture-session] out=${OUT_DIR}`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext(phoneContextOptions())
  const page = await context.newPage()

  await page.goto(new URL("/", appOrigin).toString(), { waitUntil: "networkidle" })
  await assertAuthenticated(page)
  await dismissNoise(page)

  console.log("[capture-session] starting Push workout…")
  await startWorkout(page)

  console.log("[capture-session] 02c-train-last (BodyMap hero frame)")
  await page.getByText(/last time:/i).waitFor({ state: "visible", timeout: 15_000 })
  // Frame title + last-time + BodyMap (scroll past the exercise rail).
  await page.evaluate(() => {
    const title = Array.from(document.querySelectorAll("h2, h3, p")).find((el) =>
      /seated dumbbell overhead press/i.test(el.textContent ?? ""),
    )
    const scrollRoot = document.querySelector(".overflow-y-auto") ?? document.scrollingElement
    if (!title || !scrollRoot) return
    const delta = title.getBoundingClientRect().top - 72
    scrollRoot.scrollBy({ top: delta, behavior: "instant" as ScrollBehavior })
  })
  await page.waitForTimeout(400)
  await shot(page, "02c-train-last")
  await shot(page, "02-bodymap-ohp")

  console.log("[capture-session] 02b-train-rir")
  await page.locator("[role='checkbox'][data-state='unchecked']").first().click()
  const rirConfirm = page.getByRole("button", { name: /confirm/i })
  await rirConfirm.waitFor({ state: "visible", timeout: 5_000 })
  await shot(page, "02b-train-rir")

  console.log("[capture-session] 02-rest-timer")
  await rirConfirm.click()
  const restPill = page.getByRole("button", { name: /open rest timer/i })
  await restPill.waitFor({ state: "visible", timeout: 5_000 })
  await restPill.click()
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5_000 })
  await shot(page, "02-rest-timer")
  await page.getByRole("dialog").getByRole("button", { name: /skip/i }).click()
  await page.waitForTimeout(500)

  // One more set done → 2/3 checked (if 3 sets), still not finished.
  console.log("[capture-session] completing second set for partial progress…")
  await completeOneSet(page)

  console.log("[capture-session] 02a-train-sets (partial + progression popover)")
  await openProgressionPopover(page)
  await shot(page, "02a-train-sets")

  await page.keyboard.press("Escape").catch(() => undefined)
  await discardActiveSession(page)

  await browser.close()
  console.log(
    "[capture-session] Done. Review drafts under playwright/.auth/tour-captures/\n" +
      "  02a = mid-sets + progression popover (the money shot you asked for)",
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
