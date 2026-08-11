/**
 * HITL: progression triad for Tour scene 3 (03a / 03b / 03c).
 *
 * Uses Prime Mover seed staging:
 *   Push → WEIGHT_UP (OHP)
 *   Pull → HOLD (pulldown)
 *   Legs → PLATEAU (squat)
 *
 *   CAPTURE_APP_ORIGIN=http://localhost:5174 npx tsx scripts/capture-tour-progression.ts
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

type DayShot = {
  day: string
  /** Jump to this exercise before opening the pill (defaults to first slot). */
  exercise?: RegExp
  pill: RegExp
  id: string
}

async function goToExercise(page: Page, exercise: RegExp) {
  // Session rail lists every exercise; click the target instead of Next-spam.
  const rail = page.getByText(exercise).first()
  if (await rail.isVisible().catch(() => false)) {
    await rail.click()
    await page.waitForTimeout(800)
    return
  }
  for (let i = 0; i < 6; i++) {
    const title = await page.locator("body").innerText()
    if (exercise.test(title)) return
    await page.getByRole("button", { name: /^next$/i }).click()
    await page.waitForTimeout(600)
  }
  throw new Error(`Could not reach exercise ${exercise}`)
}

const SHOTS: DayShot[] = [
  {
    day: "Push",
    // Tour lead: OHP Weight-up (bench is slot 0; OHP is the staged WEIGHT_UP).
    exercise: /seated dumbbell overhead press|overhead press/i,
    pill: /weight up/i,
    id: "03a-progress-suggest",
  },
  // Seed stages HOLD; RIR path may surface "Hold — near failure" instead of bare "Hold".
  { day: "Pull", pill: /^Hold/i, id: "03b-progress-hold" },
  { day: "Legs", pill: /plateau reached/i, id: "03c-progress-plateau" },
]

async function selectDay(page: Page, dayLabel: string) {
  // Dot controls use aria-label "Go to {day}" — all three h3s stay in the DOM,
  // so visibility checks cannot tell which slide is active.
  const dot = page.getByRole("button", { name: new RegExp(`go to ${dayLabel}`, "i") })
  await dot.waitFor({ state: "visible", timeout: 10_000 })
  await dot.click()
  await page.waitForTimeout(600)

  // Active card has the stronger primary border; assert Start workout is for this day
  // by checking the (mostly) visible active h3 is centered / not aria-hidden.
  const activeHeading = page.locator('[aria-roledescription="carousel"] h3').filter({
    hasText: new RegExp(`^${dayLabel}$`, "i"),
  })
  await activeHeading.first().waitFor({ state: "visible", timeout: 5_000 })
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

async function startWorkout(page: Page) {
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
  await page.waitForTimeout(1500)
}

async function openPill(page: Page, pill: RegExp) {
  const trigger = page.getByText(pill).first()
  await trigger.waitFor({ state: "visible", timeout: 20_000 })
  await trigger.click()
  await page.waitForTimeout(400)
  // Popover detail body
  await page
    .locator("[data-radix-popper-content-wrapper], [data-state='open']")
    .filter({ hasText: /kg|rep|set|hold|weight|plateau|keeping|adding/i })
    .first()
    .waitFor({ state: "visible", timeout: 5_000 })
    .catch(() => undefined)
}

async function main() {
  assertAuthReady()
  const appOrigin = await resolveAppOrigin()
  console.log(`[capture-progression] origin=${appOrigin}`)
  console.log(`[capture-progression] out=${OUT_DIR}`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext(phoneContextOptions())
  const page = await context.newPage()

  await page.goto(new URL("/", appOrigin).toString(), { waitUntil: "networkidle" })
  await assertAuthenticated(page)
  await dismissNoise(page)
  await discardActiveSession(page)

  for (const shotSpec of SHOTS) {
    console.log(`[capture-progression] ${shotSpec.id} (${shotSpec.day})`)
    await discardActiveSession(page)
    await selectDay(page, shotSpec.day)
    await startWorkout(page)
    if (shotSpec.exercise) await goToExercise(page, shotSpec.exercise)
    await openPill(page, shotSpec.pill)
    await shot(page, shotSpec.id)
    await page.keyboard.press("Escape").catch(() => undefined)
    await discardActiveSession(page)
  }

  await browser.close()
  console.log(
    "[capture-progression] Done. Review 03a / 03b / 03c under playwright/.auth/tour-captures/",
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
