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

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

test.describe("Abandon & restart an incomplete cycle", () => {
  test.describe.configure({ timeout: 60_000 })

  let seededCycleId: string | null = null

  test.beforeAll(async () => {
    const userId = getTestUserId()

    // Wipe any leftover sessions/cycles from prior runs to keep state predictable.
    await admin.from("set_logs").delete().match({})
    await admin.from("sessions").delete().eq("user_id", userId)
    await admin.from("cycles").delete().eq("user_id", userId)

    // Find the active program seeded by global-setup
    const { data: program } = await admin
      .from("programs")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single()
    if (!program) throw new Error("no active program seeded")

    // Find the Lundi (day 1) workout_day
    const { data: lundi } = await admin
      .from("workout_days")
      .select("id, label")
      .eq("program_id", program.id)
      .eq("label", "Lundi")
      .single()
    if (!lundi) throw new Error("no Lundi workout day seeded")

    // Open a cycle
    const { data: cycle, error: cycleErr } = await admin
      .from("cycles")
      .insert({ program_id: program.id, user_id: userId })
      .select("id")
      .single()
    if (cycleErr || !cycle) throw new Error("failed to create cycle")
    seededCycleId = cycle.id

    // Seed a finished session for Lundi linked to that cycle (1/3 days done)
    const startedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const finishedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { error: sessErr } = await admin.from("sessions").insert({
      user_id: userId,
      workout_day_id: lundi.id,
      cycle_id: cycle.id,
      workout_label_snapshot: lundi.label,
      started_at: startedAt,
      finished_at: finishedAt,
      total_sets_done: 3,
    })
    if (sessErr) throw new Error(`failed to seed session: ${sessErr.message}`)
  })

  test.afterAll(async () => {
    const userId = getTestUserId()
    await admin.from("set_logs").delete().match({})
    await admin.from("sessions").delete().eq("user_id", userId)
    await admin.from("cycles").delete().eq("user_id", userId)
  })

  test("user closes incomplete cycle and gets a fresh one ready to start", async ({
    page,
  }) => {
    await page.goto("/")

    try {
      const notifDialog = page.getByRole("dialog", {
        name: /enable notifications/i,
      })
      await expect(notifDialog).toBeVisible({ timeout: 2_500 })
      await notifDialog.getByRole("button", { name: /not now/i }).click()
    } catch {
      /* already dismissed */
    }

    // Carousel renders. Lundi (which we seeded as done) must be visible.
    const lundiCard = page.locator("h3").filter({ hasText: "Lundi" })
    await expect(lundiCard).toBeVisible({ timeout: 30_000 })

    // The carousel may default to the first non-completed day. Force-click the
    // first dot to ensure we're on Lundi (the done day).
    const dots = page.getByRole("button", { name: /^(go to|aller à)\s/i })
    await expect(dots.first()).toBeVisible({ timeout: 5_000 })
    await dots.nth(0).click()
    await expect(lundiCard).toBeVisible()

    // The standard "Start Workout" button must NOT be in the sticky bar for a
    // day that's already done in the active cycle.
    const startButton = page.getByRole("button", { name: /start workout/i })
    await expect(startButton).not.toBeVisible()

    // Empty set_logs: no recap tabs (programme list still sits under the card).
    await expect(page.getByRole("tablist")).not.toBeVisible()

    // Instead, the restart-cycle CTA is shown.
    const restartCta = page.getByRole("button", {
      name: /restart cycle to do it again/i,
    })
    await expect(restartCta).toBeVisible({ timeout: 5_000 })

    // Click it → confirmation dialog appears
    await restartCta.click()
    const confirmDialog = page.getByRole("alertdialog", {
      name: /start a new cycle\?/i,
    })
    await expect(confirmDialog).toBeVisible({ timeout: 3_000 })

    // Body must mention completed/total and list the missing days (Mercredi, Vendredi).
    await expect(confirmDialog.getByText(/1\/3 workouts done/i)).toBeVisible()
    await expect(
      confirmDialog.getByText(/workouts not done in this cycle/i),
    ).toBeVisible()
    await expect(confirmDialog.getByText("Mercredi")).toBeVisible()
    await expect(confirmDialog.getByText("Vendredi")).toBeVisible()

    // Confirm
    await confirmDialog
      .getByRole("button", { name: /close and restart/i })
      .click()

    await expect(confirmDialog).not.toBeVisible({ timeout: 5_000 })

    // After restart: Lundi is no longer marked done in the (new) cycle, so the
    // standard Start Workout button comes back on this very same day card.
    await expect(startButton).toBeVisible({ timeout: 5_000 })
    await expect(restartCta).not.toBeVisible()

    // Sanity: the previously-seeded cycle must now be closed in the DB,
    // and a fresh open cycle must exist for the same program.
    const userId = getTestUserId()
    const { data: closedCycle } = await admin
      .from("cycles")
      .select("id, finished_at")
      .eq("id", seededCycleId!)
      .single()
    expect(closedCycle?.finished_at).not.toBeNull()

    const { data: openCycles } = await admin
      .from("cycles")
      .select("id")
      .eq("user_id", userId)
      .is("finished_at", null)
    expect(openCycles ?? []).toHaveLength(1)
  })
})
