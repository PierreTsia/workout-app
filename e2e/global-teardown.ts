import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = "http://127.0.0.1:54321"
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

const AUTH_DIR = path.join(__dirname, "..", "playwright", ".auth")

async function globalTeardown() {
  const userIdPath = path.join(AUTH_DIR, "test-user-id.txt")
  if (!fs.existsSync(userIdPath)) return

  const userId = fs.readFileSync(userIdPath, "utf-8").trim()
  if (!userId) return

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Clean up generated data owned by the test user (order matters for FK constraints)
  await admin.from("analytics_events").delete().eq("user_id", userId)
  await admin.from("set_logs").delete().match({})
  await admin.from("sessions").delete().match({})
  await admin.from("workout_exercises").delete().match({})
  await admin.from("workout_days").delete().eq("user_id", userId)
  await admin.from("programs").delete().eq("user_id", userId)
  await admin.from("user_profiles").delete().eq("user_id", userId)

  await admin.auth.admin.deleteUser(userId)
}

export default globalTeardown
