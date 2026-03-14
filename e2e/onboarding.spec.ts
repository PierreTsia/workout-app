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

    // Start fresh — remove any existing profile/program
    await clearUserData(userId)

    // Navigate to app — should redirect to /onboarding
    await page.goto("/")
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 })

    // --- Welcome step ---
    await expect(page.getByText("Let's build your program")).toBeVisible({ timeout: 10_000 })
    await page.getByRole("button", { name: "Get Started" }).click()

    // --- Questionnaire step ---
    await expect(page.getByText("About you")).toBeVisible({ timeout: 5_000 })

    // Fill gender
    await page.getByRole("radio", { name: /Male/ }).click()

    // Fill age & weight
    await page.getByPlaceholder("e.g. 28").fill("28")
    await page.getByPlaceholder("e.g. 75").fill("80")

    // Fill goal, experience, equipment
    await page.getByRole("radio", { name: /General fitness/ }).click()
    await page.getByRole("radio", { name: /Intermediate/ }).click()
    await page.getByRole("radio", { name: /Full gym/ }).click()

    // Days slider defaults to 3, duration defaults to 60 min — leave as-is
    await page.getByRole("button", { name: "Next" }).click()

    // --- Path choice step ---
    await expect(page.getByText("How do you want to start?")).toBeVisible({ timeout: 5_000 })
    await page.getByText("Recommend me a program").click()

    // --- Template recommendation step ---
    await expect(page.getByText("Recommended programs")).toBeVisible({ timeout: 10_000 })

    // Click the first (top-ranked) template card
    const firstTemplate = page.locator("[role='button']").filter({ hasText: /Recommended/ }).first()
    await expect(firstTemplate).toBeVisible({ timeout: 10_000 })
    await firstTemplate.click()

    // --- Program summary step ---
    await expect(page.getByText("Program preview")).toBeVisible({ timeout: 5_000 })
    await page.getByRole("button", { name: "Create program" }).click()

    // --- Should redirect to home after program generation ---
    await expect(page).toHaveURL("/", { timeout: 30_000 })

    await dismissNotificationDialog(page)

    // Verify we're on the workout page with content (not redirected back to onboarding)
    await expect(page.locator("button").filter({ hasText: /Day/ }).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test("guard redirects onboarded user away from /onboarding", async ({ page }) => {
    test.setTimeout(30_000)

    // After the previous test, the user has a program
    await page.goto("/onboarding")
    await expect(page).toHaveURL("/", { timeout: 15_000 })
  })

  test("change program flow from side drawer", async ({ page }) => {
    test.setTimeout(120_000)

    await page.goto("/")
    await dismissNotificationDialog(page)

    // Wait for workout page to load
    await expect(page.locator("button").filter({ hasText: /Day/ }).first()).toBeVisible({
      timeout: 15_000,
    })

    // Open side drawer
    await page.getByLabel("Open menu").click()
    await expect(page.getByText("Menu")).toBeVisible({ timeout: 3_000 })

    // Click "Change program"
    await page.getByRole("link", { name: /Change program/i }).click()
    await expect(page).toHaveURL(/\/change-program/, { timeout: 5_000 })

    // --- Path choice step ---
    await expect(page.getByText("How do you want to start?")).toBeVisible({ timeout: 5_000 })
    await page.getByText("Recommend me a program").click()

    // --- Template recommendation step ---
    await expect(page.getByText("Recommended programs")).toBeVisible({ timeout: 10_000 })
    const firstTemplate = page.locator("[role='button']").first()
    await expect(firstTemplate).toBeVisible({ timeout: 10_000 })
    await firstTemplate.click()

    // --- Program summary step ---
    await expect(page.getByText("Program preview")).toBeVisible({ timeout: 5_000 })
    await page.getByRole("button", { name: "Create program" }).click()

    // --- Should redirect to home ---
    await expect(page).toHaveURL("/", { timeout: 30_000 })
  })
})
