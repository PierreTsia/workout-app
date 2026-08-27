import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = "http://127.0.0.1:54321"
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function getTestUserId(): string {
  return fs
    .readFileSync(path.join(__dirname, "..", "playwright", ".auth", "test-user-id.txt"), "utf-8")
    .trim()
}

async function getActiveProgramId(): Promise<string> {
  const { data } = await admin
    .from("programs")
    .select("id")
    .eq("user_id", getTestUserId())
    .eq("is_active", true)
    .limit(1)
    .single()
  return data!.id
}

/** Days seeded by global-setup. Anything else on the program is test debris. */
const SEEDED_DAY_LABELS = ["Lundi", "Mercredi", "Vendredi"]

test.describe("Builder — CRUD", () => {
  // These tests delete the days they create, but only on the happy path. A
  // failure in between leaks a fourth day onto the shared program, which then
  // breaks cycle-abandon's "1/3 workouts done" count — one broken assertion
  // reported as two unrelated failures. Sweep the debris instead.
  // Best-effort: a session pinned to a leaked day would block the delete, and a
  // cleanup hook must never be the thing that turns a green run red.
  test.afterAll(async () => {
    try {
      const labelList = SEEDED_DAY_LABELS.map((l) => `"${l}"`).join(",")
      await admin
        .from("workout_days")
        .delete()
        .eq("program_id", await getActiveProgramId())
        .not("label", "in", `(${labelList})`)
    } catch {
      /* leave it to the next run's setup */
    }
  })

  test("create day, add exercise, edit sets/reps, delete exercise, delete day", async ({
    page,
  }) => {
    test.setTimeout(120_000)

    // Visit / first so bootstrap seeds system exercises into the DB
    await page.goto("/")

    const notifDialog = page.getByRole("dialog", {
      name: /enable notifications/i,
    })

    try {
      await expect(notifDialog).toBeVisible({ timeout: 5_000 })
      await notifDialog.getByRole("button", { name: /not now/i }).click()
      await expect(notifDialog).not.toBeVisible()
    } catch {
      /* dialog didn't appear */
    }

    await expect(
      page
        .locator("h3")
        .filter({ hasText: /Lundi|Mercredi|Vendredi/ })
        .first(),
    ).toBeVisible({ timeout: 60_000 })

    const programId = await getActiveProgramId()
    await page.goto(`/builder/${programId}`)

    // Dialog may reappear after full-page navigation (AuthGuard re-mounts)
    try {
      await expect(notifDialog).toBeVisible({ timeout: 5_000 })
      await notifDialog.getByRole("button", { name: /not now/i }).click()
      await expect(notifDialog).not.toBeVisible()
    } catch {
      /* dialog didn't appear */
    }

    // Day list titles live in Card > flex-1 > p (avoid matching unrelated .font-semibold)
    await expect(page.getByRole("button", { name: /new day/i })).toBeVisible({
      timeout: 15_000,
    })
    const dayLabels = page.locator("div.flex-1 > p.font-semibold")
    await expect(dayLabels.first()).toBeVisible({ timeout: 15_000 })
    const initialCount = await dayLabels.count()

    // --- Create a new day ---
    const newDayButton = page.getByRole("button", { name: /new day/i })
    await newDayButton.click()

    await expect(dayLabels).toHaveCount(initialCount + 1, { timeout: 10_000 })
    const newDayLabel = dayLabels.nth(initialCount)
    const dayLabelText = await newDayLabel.textContent()

    // --- Open the new day editor ---
    await newDayLabel.click()

    const addExerciseButton = page.getByRole("button", {
      name: /add exercise/i,
    })
    await expect(addExerciseButton).toBeVisible({ timeout: 5_000 })

    // --- Add exercise from library ---
    await addExerciseButton.click()

    const pickerDialog = page.getByRole("dialog")
    await expect(pickerDialog).toBeVisible({ timeout: 5_000 })

    const allItems = pickerDialog.locator("[cmdk-item]")
    await expect(allItems.first()).toBeVisible({ timeout: 10_000 })
    const libraryItemCount = await allItems.count()

    // --- Verify search filters the list ---
    // The suite runs in English, so search with an English term: the query must
    // hit `name_en` server-side and the row must render the same English label.
    const searchInput = pickerDialog.getByRole("searchbox")
    await searchInput.fill("Bench")
    const filteredItems = pickerDialog.locator("[cmdk-item]")
    await expect(async () => {
      const count = await filteredItems.count()
      expect(count).toBeGreaterThan(0)
      expect(count).toBeLessThan(libraryItemCount)
    }).toPass({ timeout: 10_000 })
    await expect(filteredItems.first().locator("span.truncate")).toContainText(
      /bench/i,
      { timeout: 3_000 },
    )
    await searchInput.fill("")
    await expect(allItems).toHaveCount(libraryItemCount, { timeout: 10_000 })

    // --- Select exercise via checkbox + Add N ---
    const exerciseOption = allItems.first()
    const exerciseName = await exerciseOption
      .locator("span.truncate")
      .textContent()
    await exerciseOption.getByRole("checkbox").click()
    await pickerDialog
      .getByRole("button", { name: /add 1/i })
      .click()

    await expect(pickerDialog).not.toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(exerciseName!)).toBeVisible({ timeout: 5_000 })

    // --- Edit sets inline on the row; leftover fields live behind ⋯ ---
    const exerciseRow = page
      .locator("div")
      .filter({ hasText: exerciseName! })
      .filter({ has: page.getByRole("spinbutton", { name: /sets/i }) })
      .first()
    const setsInput = exerciseRow.getByRole("spinbutton", { name: /sets/i })
    await expect(setsInput).toBeVisible({ timeout: 5_000 })

    await setsInput.fill("5")
    await page.waitForTimeout(1_000)
    await expect(setsInput).toHaveValue("5")

    // --- Delete the exercise via overflow ---
    await exerciseRow.getByRole("button", { name: /more actions/i }).click()
    await page.getByRole("menuitem", { name: /remove/i }).click()

    const deleteExDialog = page.getByRole("dialog")
    await expect(deleteExDialog).toBeVisible()
    await deleteExDialog.getByRole("button", { name: /^remove$/i }).click()
    await expect(deleteExDialog).not.toBeVisible({ timeout: 10_000 })
    await expect(
      page.locator("span.truncate.text-sm.font-medium", {
        hasText: exerciseName!,
      }),
    ).toHaveCount(0, { timeout: 5_000 })

    // --- Navigate back to day list ---
    const backButton = page.locator("button:has(.lucide-arrow-left)")
    await backButton.click()

    // --- Delete the created day ---
    const dayCard = page
      .locator("[class*='cursor-pointer']")
      .filter({ hasText: dayLabelText! })
    await expect(dayCard).toBeVisible({ timeout: 5_000 })

    await dayCard
      .locator("button")
      .filter({ has: page.locator("svg.lucide-trash-2") })
      .click()

    const dayDeleteDialog = page.getByRole("dialog")
    await expect(dayDeleteDialog).toBeVisible()
    await dayDeleteDialog.getByRole("button", { name: /delete/i }).click()
    await expect(dayCard).not.toBeVisible({ timeout: 5_000 })
  })

  test("exercise picker shows filter button at mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    await page.goto("/")
    const notifDialog = page.getByRole("dialog", {
      name: /enable notifications/i,
    })
    try {
      await expect(notifDialog).toBeVisible({ timeout: 5_000 })
      await notifDialog.getByRole("button", { name: /not now/i }).click()
      await expect(notifDialog).not.toBeVisible()
    } catch {
      /* dialog didn't appear */
    }

    const programId = await getActiveProgramId()
    await page.goto(`/builder/${programId}`)
    try {
      await expect(notifDialog).toBeVisible({ timeout: 5_000 })
      await notifDialog.getByRole("button", { name: /not now/i }).click()
      await expect(notifDialog).not.toBeVisible()
    } catch {
      /* dialog didn't appear */
    }

    await expect(page.getByRole("button", { name: /new day/i })).toBeVisible({
      timeout: 15_000,
    })
    const dayLabels = page.locator("div.flex-1 > p.font-semibold")
    await expect(dayLabels.first()).toBeVisible({ timeout: 15_000 })
    await dayLabels.first().click()

    const addExerciseButton = page.getByRole("button", {
      name: /add exercise/i,
    })
    await expect(addExerciseButton).toBeVisible({ timeout: 5_000 })
    await addExerciseButton.click()

    const pickerDialog = page.getByRole("dialog")
    await expect(pickerDialog).toBeVisible({ timeout: 5_000 })

    const filterButton = pickerDialog.getByRole("button", {
      name: /filters|filtres/i,
    })
    await expect(filterButton).toBeVisible()

    await filterButton.click()
    await expect(
      pickerDialog.getByRole("button", { name: /filters|filtres/i }),
    ).toBeVisible()
  })

  test("create a circuit (block) from the picker on a fresh day", async ({
    page,
  }) => {
    test.setTimeout(120_000)

    await page.goto("/")

    const notifDialog = page.getByRole("dialog", {
      name: /enable notifications/i,
    })
    async function dismissNotif() {
      try {
        await expect(notifDialog).toBeVisible({ timeout: 5_000 })
        await notifDialog.getByRole("button", { name: /not now/i }).click()
        await expect(notifDialog).not.toBeVisible()
      } catch {
        /* dialog didn't appear */
      }
    }
    await dismissNotif()

    await expect(
      page
        .locator("h3")
        .filter({ hasText: /Lundi|Mercredi|Vendredi/ })
        .first(),
    ).toBeVisible({ timeout: 60_000 })

    const programId = await getActiveProgramId()
    await page.goto(`/builder/${programId}`)
    await dismissNotif()

    // --- Create a fresh day so the circuit assertion is isolated ---
    const dayLabels = page.locator("div.flex-1 > p.font-semibold")
    await expect(page.getByRole("button", { name: /new day/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(dayLabels.first()).toBeVisible({ timeout: 15_000 })
    const initialCount = await dayLabels.count()

    await page.getByRole("button", { name: /new day/i }).click()
    await expect(dayLabels).toHaveCount(initialCount + 1, { timeout: 10_000 })
    const newDayLabel = dayLabels.nth(initialCount)
    const dayLabelText = await newDayLabel.textContent()
    await newDayLabel.click()

    // --- Open Add → Circuits → New circuit ---
    const addExerciseButton = page.getByRole("button", {
      name: /add exercise/i,
    })
    await expect(addExerciseButton).toBeVisible({ timeout: 10_000 })
    await addExerciseButton.click()

    const pickerDialog = page.getByRole("dialog")
    await expect(pickerDialog).toBeVisible({ timeout: 5_000 })

    await pickerDialog.getByRole("radio", { name: /circuits/i }).click()
    await pickerDialog.getByRole("button", { name: /new circuit/i }).click()

    const items = pickerDialog.locator("[cmdk-item]")
    await expect(items.first()).toBeVisible({ timeout: 10_000 })

    // --- Pick two exercises (block needs >= 2) ---
    const firstName = await items.nth(0).locator("span.truncate").textContent()
    const secondName = await items.nth(1).locator("span.truncate").textContent()
    await items.nth(0).getByRole("checkbox").click()
    await items.nth(1).getByRole("checkbox").click()

    // --- The block-mode CTA carries the count in parentheses; the day-editor
    //     trigger does not — so this regex unambiguously targets the CTA. ---
    const createBlockCta = pickerDialog.getByRole("button", {
      name: /create circuit \(/i,
    })
    await expect(createBlockCta).toBeVisible({ timeout: 5_000 })
    await createBlockCta.click()

    await expect(pickerDialog).not.toBeVisible({ timeout: 5_000 })

    // --- The circuit renders as a BlockCard: overflow → Edit circuit + both exercises ---
    await expect(
      page.getByRole("button", { name: /more actions/i }),
    ).toBeVisible({ timeout: 10_000 })
    await page.getByRole("button", { name: /more actions/i }).click()
    await expect(
      page.getByRole("menuitem", { name: /edit circuit/i }),
    ).toBeVisible()
    await expect(page.getByText(firstName!).first()).toBeVisible()
    await expect(page.getByText(secondName!).first()).toBeVisible()

    // --- Cleanup: delete the throwaway day ---
    await page.keyboard.press("Escape")
    const backButton = page.locator("button:has(.lucide-arrow-left)")
    await backButton.click()
    const dayCard = page
      .locator("[class*='cursor-pointer']")
      .filter({ hasText: dayLabelText! })
    await expect(dayCard).toBeVisible({ timeout: 5_000 })
    await dayCard
      .locator("button")
      .filter({ has: page.locator("svg.lucide-trash-2") })
      .click()
    const dayDeleteDialog = page.getByRole("dialog")
    await expect(dayDeleteDialog).toBeVisible()
    await dayDeleteDialog.getByRole("button", { name: /delete/i }).click()
    await expect(dayCard).not.toBeVisible({ timeout: 5_000 })
  })
})
