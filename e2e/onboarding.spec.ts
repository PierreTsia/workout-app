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
  await admin.from("workout_days").insert({
    program_id: program!.id, user_id: userId, label: "Day A", emoji: "💪", sort_order: 0,
  })
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
    await page.getByText("Recommend me a program").click()

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

    // Re-seed program for subsequent tests (in case they rely on it)
    await seedProgram(userId)
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

    await page.goto("/")
    await dismissNotificationDialog(page)

    // Wait for workout page to be loaded
    await page.waitForLoadState("networkidle")
    await expect(page).toHaveURL("/", { timeout: 10_000 })

    // Open side drawer via the hamburger button
    await page.getByLabel("Open menu").click()
    await expect(page.getByText("Menu")).toBeVisible({ timeout: 5_000 })

    // Click "Change program"
    await page.getByRole("link", { name: /Change program/i }).click()
    await expect(page).toHaveURL(/\/change-program/, { timeout: 10_000 })

    // --- Path choice step ---
    await expect(page.getByText("How do you want to start?")).toBeVisible({ timeout: 10_000 })
    await page.getByText("Recommend me a program").click()

    // --- Template recommendation step ---
    await expect(page.getByText("Recommended programs")).toBeVisible({ timeout: 15_000 })
    const firstTemplate = page.locator("[role='button']").first()
    await expect(firstTemplate).toBeVisible({ timeout: 10_000 })
    await firstTemplate.click()

    // --- Program summary step ---
    await expect(page.getByText("Program preview")).toBeVisible({ timeout: 10_000 })
    await page.getByRole("button", { name: "Create program" }).click()

    // --- Should redirect to home ---
    await expect(page).toHaveURL("/", { timeout: 30_000 })
  })
})
