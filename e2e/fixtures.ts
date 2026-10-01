import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import { test as base, expect } from "@playwright/test"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = "http://127.0.0.1:54321"
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

/**
 * Playwright test with per-test cleanup. A test that starts a session and does
 * not finish it leaves a recent orphan; on the next page load the app-open
 * Resume / Finish prompt (#571) opens as a modal and aria-hides the page, so
 * the following test can't find its elements. Deleting the user's open
 * sessions between tests (cascade removes their `set_logs` / `block_runs`)
 * restores the pre-test state.
 */
export const test = base.extend({
  page: async ({ page }, run) => {
    await run(page)

    const userIdPath = path.join(
      __dirname,
      "..",
      "playwright",
      ".auth",
      "test-user-id.txt",
    )
    if (!fs.existsSync(userIdPath)) return
    const userId = fs.readFileSync(userIdPath, "utf-8").trim()
    if (!userId) return

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await admin
      .from("sessions")
      .delete()
      .eq("user_id", userId)
      .is("finished_at", null)
  },
})

export { expect }
