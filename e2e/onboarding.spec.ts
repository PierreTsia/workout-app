import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = "http://127.0.0.1:54321"
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

function getTestUserId(): string {
  const p = path.join(__dirname, "..", "playwright", ".auth", "test-user-id.txt")
  return fs.readFileSync(p, "utf-8").trim()
}

function getAdmin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function clearUserData(userId: string) {
  const admin = getAdmin()
  await admin.from("analytics_events").delete().eq("user_id", userId)
  await admin.from("workout_exercises").delete().match({})
  await admin.from("workout_days").delete().eq("user_id", userId)
  await admin.from("programs").delete().eq("user_id", userId)
  await admin.from("user_profiles").delete().eq("user_id", userId)
}

async function seedProgram(userId: string) {
  const admin = getAdmin()
  await clearUserData(userId)
  await admin.from("user_profiles").insert({
    user_id: userId, gender: "male", age: 30, weight_kg: 80,
    goal: "general_fitness", experience: "intermediate", equipment: "gym",
    training_days_per_week: 4, session_duration_minutes: 60,
  })
  const { data: program } = await admin.from("programs").insert({
    user_id: userId, name: "E2E Test Program", is_active: true,
  }).select("id").single()
  const days = [
    { label: "Lundi", emoji: "💪", sort_order: 0 },
    { label: "Mercredi", emoji: "🔥", sort_order: 1 },
    { label: "Vendredi", emoji: "⚡", sort_order: 2 },
  ]
  const { data: insertedDays } = await admin.from("workout_days")
    .insert(days.map((d) => ({ ...d, program_id: program!.id, user_id: userId })))
    .select("id")
  const { data: exercises } = await admin.from("exercises").select("id, name, muscle_group, emoji").limit(3)
  if (exercises && exercises.length >= 3 && insertedDays) {
    await admin.from("workout_exercises").insert(
      insertedDays.map((day, i) => ({
        workout_day_id: day.id,
        exercise_id: exercises[i].id,
        name_snapshot: exercises[i].name,
        muscle_snapshot: exercises[i].muscle_group ?? "",
        emoji_snapshot: exercises[i].emoji ?? "🏋️",
        sets: 3, reps: "10", weight: "0", rest_seconds: 90, sort_order: 0,
      })),
    )
  }
}

async function dismissNotificationDialog(page: import("@playwright/test").Page) {
  const dialog = page.getByRole("dialog", { name: /enable notifications/i })
  try {
    await expect(dialog).toBeVisible({ timeout: 3_000 })
    await dialog.getByRole("button", { name: /not now/i }).click()
    await expect(dialog).not.toBeVisible()
  } catch {
    /* dialog didn't appear */
  }
}

test.describe("Onboarding", () => {
  test.afterAll(async () => {
    const userId = getTestUserId()
    await seedProgram(userId)
  })

  test("full guided onboarding flow", async ({ page }) => {
    test.setTimeout(120_000)
    const userId = getTestUserId()

    await clearUserData(userId)

    await page.goto("/")
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 })

    await dismissNotificationDialog(page)

    // --- Welcome step ---
    await expect(page.getByText("Let's build your program")).toBeVisible({ timeout: 10_000 })
    await page.getByRole("button", { name: "Get Started" }).click()

    // --- Questionnaire step ---
    await expect(page.getByText("About you")).toBeVisible({ timeout: 5_000 })

    await page.getByRole("radio", { name: /Male/ }).click()
    await page.getByPlaceholder("e.g. 28").fill("28")
    await page.getByPlaceholder("e.g. 75").fill("80")
    await page.getByRole("radio", { name: /General fitness/ }).click()
    await page.getByRole("radio", { name: /Intermediate/ }).click()
    await page.getByRole("radio", { name: /Full gym/ }).click()

    await page.getByRole("button", { name: "Next" }).click()

    // --- Path choice step ---
    await expect(page.getByText("How do you want to start?")).toBeVisible({ timeout: 5_000 })
    await page.getByText("From template").click()

    // --- Template recommendation step ---
    await expect(page.getByText("Recommended programs")).toBeVisible({ timeout: 10_000 })

    const firstTemplate = page.locator("[role='button']").filter({ hasText: /Recommended/ }).first()
    await expect(firstTemplate).toBeVisible({ timeout: 10_000 })
    await firstTemplate.click()

    // --- Program summary step ---
    await expect(page.getByText("Program preview")).toBeVisible({ timeout: 5_000 })
    await page.getByRole("button", { name: "Create program" }).click()

    // --- Should redirect to home after program generation ---
    await expect(page).toHaveURL("/", { timeout: 30_000 })
  })

  test("full AI onboarding flow", async ({ page }) => {
    test.setTimeout(120_000)
    const userId = getTestUserId()

    await clearUserData(userId)

    await page.goto("/")
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 })

    await dismissNotificationDialog(page)

    await page.getByRole("button", { name: "Get Started" }).click()
    await expect(page.getByText("About you")).toBeVisible({ timeout: 5_000 })

    await page.getByRole("radio", { name: /Male/ }).click()
    await page.getByPlaceholder("e.g. 28").fill("28")
    await page.getByPlaceholder("e.g. 75").fill("80")
    await page.getByRole("radio", { name: /General fitness/ }).click()
    await page.getByRole("radio", { name: /Intermediate/ }).click()
    await page.getByRole("radio", { name: /Full gym/ }).click()
    await page.getByRole("button", { name: "Next" }).click()

    await expect(page.getByText("How do you want to start?")).toBeVisible({ timeout: 5_000 })
    await page.getByText("AI Generate").click()

    // Onboarding skips the duplicate constraint form; goes straight to generation
    await expect(page.getByText("Customize your program")).not.toBeVisible({ timeout: 2_000 })

    // AI preview step — generation succeeded (requires GEMINI_API_KEY in supabase/functions/.env)
    await expect(page.getByText("Your AI Program")).toBeVisible({ timeout: 60_000 })

    await page.getByRole("button", { name: /Create Program/i }).click()

    // Should redirect to home after program creation, same as template flow
    await expect(page).toHaveURL("/", { timeout: 30_000 })
  })

  test("onboarding blank path opens builder", async ({ page }) => {
    test.setTimeout(120_000)
    const userId = getTestUserId()

    await clearUserData(userId)

    await page.goto("/")
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 })

    await dismissNotificationDialog(page)

    await page.getByRole("button", { name: "Get Started" }).click()
    await expect(page.getByText("About you")).toBeVisible({ timeout: 5_000 })

    await page.getByRole("radio", { name: /Male/ }).click()
    await page.getByPlaceholder("e.g. 28").fill("28")
    await page.getByPlaceholder("e.g. 75").fill("80")
    await page.getByRole("radio", { name: /General fitness/ }).click()
    await page.getByRole("radio", { name: /Intermediate/ }).click()
    await page.getByRole("radio", { name: /Full gym/ }).click()
    await page.getByRole("button", { name: "Next" }).click()

    await expect(page.getByText("How do you want to start?")).toBeVisible({ timeout: 5_000 })
    await page.getByText("Start from scratch").click()

    await expect(page).toHaveURL(/\/builder\//, { timeout: 30_000 })
    await expect(page.getByRole("button", { name: /new day/i })).toBeVisible({ timeout: 15_000 })
  })

  test("guard redirects onboarded user away from /onboarding", async ({ page }) => {
    test.setTimeout(30_000)

    // Global setup seeds a program, so the guard should redirect
    await page.goto("/")
    await dismissNotificationDialog(page)

    // Confirm we're on the home page (user has a program)
    await page.waitForLoadState("networkidle")
    await expect(page).toHaveURL("/", { timeout: 10_000 })

    // Now try /onboarding — guard should redirect back to /
    await page.goto("/onboarding")
    await expect(page).toHaveURL("/", { timeout: 15_000 })
  })

  test("change program flow from side drawer", async ({ page }) => {
    test.setTimeout(120_000)

    const admin = getAdmin()
    const userId = getTestUserId()
    await admin.from("programs").insert({
      user_id: userId, name: "Second Program", is_active: false,
    })

    await page.goto("/")
    await dismissNotificationDialog(page)

    await page.waitForLoadState("networkidle")
    await expect(page).toHaveURL("/", { timeout: 10_000 })

    // Open side drawer via the hamburger button
    await page.getByLabel("Open menu").click()
    await expect(page.getByText("Menu")).toBeVisible({ timeout: 5_000 })

    // Click "Library"
    await page.getByRole("link", { name: /Library/i }).click()
    await expect(page).toHaveURL(/\/library/, { timeout: 10_000 })

    // --- Click "Activate" on the inactive program ---
    const activateButton = page.getByRole("button", { name: /Activate/i }).first()
    await expect(activateButton).toBeVisible({ timeout: 15_000 })
    await activateButton.click()

    // --- Confirm activation dialog ---
    await expect(page.getByText(/Switch program/i)).toBeVisible({ timeout: 5_000 })
    await page.getByRole("button", { name: /Confirm/i }).click()

    // --- Should stay on library after activation ---
    await expect(page).toHaveURL(/\/library/, { timeout: 30_000 })
  })
})
