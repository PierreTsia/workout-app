/**
 * HITL: Quick Workout preview with coach rationale (Tour 01c).
 *
 * Stages a specific demand (Chest + focus note), mocks generate-quick-workout
 * so we never hit Gemini, then screenshots the Preview with Coach Says.
 *
 *   CAPTURE_APP_ORIGIN=http://localhost:5174 npx tsx scripts/capture-tour-quick-workout.ts
 */

import "./load-env.js"
import { chromium, type Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import {
  OUT_DIR,
  assertAuthReady,
  assertAuthenticated,
  dismissNoise,
  phoneContextOptions,
  resolveAppOrigin,
  shot,
} from "./capture-tour-shared.js"
import { resolveHostedViteEnv } from "./resolve-hosted-vite-env.js"

const DEMAND =
  "Short on time — prioritize heavy bench compounds, minimal isolation fluff."

const RATIONALE =
  "You asked for a short, heavy bench-focused hit. I led with Bench Press and a wide-grip pulldown for balance, kept laterals light, and skipped fluff so you can finish in ~30 minutes."

async function resolvePreviewExerciseIds(): Promise<string[]> {
  const hosted = resolveHostedViteEnv()
  const client = createClient(hosted.VITE_SUPABASE_URL, hosted.VITE_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const names = [
    "Développé couché",
    "Tirage poulie haute prise large",
    "Élévations latérales",
    "Squat barre",
  ]
  const { data, error } = await client.from("exercises").select("id, name").in("name", names)
  if (error || !data?.length) {
    throw new Error(`Failed to resolve exercises for QW mock: ${error?.message ?? "empty"}`)
  }
  const byName = Object.fromEntries(data.map((r) => [r.name, r.id]))
  const ids = names.map((n) => byName[n]).filter((id): id is string => Boolean(id))
  if (ids.length < 3) {
    throw new Error(`Need ≥3 exercises for QW preview, got ${ids.length}`)
  }
  return ids
}

async function openQuickWorkout(page: Page) {
  await page.getByRole("button", { name: /open menu/i }).click()
  await page.getByRole("button", { name: /^Quick Workout$/i }).click()
  await page.getByRole("heading", { name: /^Quick Workout$/i }).waitFor({
    state: "visible",
    timeout: 15_000,
  })
}

async function main() {
  assertAuthReady()
  const appOrigin = await resolveAppOrigin()
  const exerciseIds = await resolvePreviewExerciseIds()
  console.log(`[capture-qw] origin=${appOrigin}`)
  console.log(`[capture-qw] out=${OUT_DIR}`)
  console.log(`[capture-qw] mock exercises=${exerciseIds.length}`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext(phoneContextOptions())
  const page = await context.newPage()

  await page.route("**/functions/v1/generate-quick-workout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        exerciseIds,
        rationale: RATIONALE,
        repaired: false,
      }),
    })
  })
  await page.route("**/generativelanguage.googleapis.com/**", (route) => {
    void route.abort()
  })

  await page.goto(new URL("/", appOrigin).toString(), { waitUntil: "networkidle" })
  await assertAuthenticated(page)
  await dismissNoise(page)

  await openQuickWorkout(page)

  // Specific demand: Chest focus + free-text preference.
  await page.getByRole("button", { name: /^Chest$/i }).click()
  const focus = page.getByLabel(/preferences for ai/i)
  await focus.fill(DEMAND)

  // Optional: constraints frame before generate (handy for HITL).
  console.log("[capture-qw] 01-qw-constraints (demand filled)")
  await shot(page, "01-qw-constraints")

  await page.getByRole("button", { name: /AI Generate/i }).click()

  await page.getByRole("button", { name: /Start Workout/i }).waitFor({
    state: "visible",
    timeout: 30_000,
  })
  // EN generator copy: "Coach's take" (not "Coach says").
  const coach = page.getByText(/coach'?s take/i)
  await coach.waitFor({ state: "visible", timeout: 15_000 })
  await page.getByText(/heavy bench/i).first().waitFor({ state: "visible", timeout: 5_000 })

  // Dense Tour frame: coach + CTAs + exercise list. Expanded SessionHeatmap
  // eats the lower half with sparse body silhouettes (reads as a dead void
  // inside DeviceFrame even when pixels aren’t “empty”). Collapse it so the
  // prescription fills the 390×844 bezel; trimTrailingEmptyChrome cleans any
  // leftover chrome.
  const muscleMap = page.getByRole("button", { name: /muscle map/i })
  if (await muscleMap.isVisible().catch(() => false)) {
    const expanded = await muscleMap.getAttribute("data-state")
    if (expanded !== "closed") {
      await muscleMap.click()
      await page.waitForTimeout(300)
    }
  }

  await page.getByRole("button", { name: /add exercise/i }).waitFor({
    state: "visible",
    timeout: 10_000,
  })
  await coach.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)

  console.log("[capture-qw] 01c-program-agent (preview + exercises, map collapsed)")
  await shot(page, "01c-program-agent")

  await browser.close()
  console.log(
    "[capture-qw] Done. Review:\n" +
      "  01-qw-constraints.png   — Chest + specific demand\n" +
      "  01c-program-agent.png   — Coach + exercise list (Tour 01c)\n" +
      "Say the word to swap 01c into web/src/assets/screenshots/tour/",
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
