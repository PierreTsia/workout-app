import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = "http://127.0.0.1:54321"
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

const TEST_EMAIL = "e2e-test@example.com"
const TEST_PASSWORD = "e2e-test-password-123!"

const AUTH_DIR = path.join(__dirname, "..", "playwright", ".auth")

async function globalSetup() {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Clean up any leftover test user from a previous aborted run
  const { data: existing } = await admin.auth.admin.listUsers()
  const stale = existing?.users?.find((u) => u.email === TEST_EMAIL)
  if (stale) {
    await admin.auth.admin.deleteUser(stale.id)
  }

  // Create a fresh test user
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    })
  if (createErr) throw new Error(`Failed to create test user: ${createErr.message}`)

  const userId = created.user.id

  // Sign in to get session tokens
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: signIn, error: signInErr } =
    await anon.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
  if (signInErr) throw new Error(`Failed to sign in test user: ${signInErr.message}`)

  const session = signIn.session

  // Build Supabase localStorage session payload
  // Key format: sb-<hostname.split('.')[0]>-auth-token → sb-127-auth-token
  const sessionPayload = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    user: session.user,
  }

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: "http://localhost:5173",
        localStorage: [
          {
            name: "sb-127-auth-token",
            value: JSON.stringify(sessionPayload),
          },
          { name: "locale", value: JSON.stringify("en") },
          { name: "weightUnit", value: JSON.stringify("kg") },
        ],
      },
    ],
  }

  // Seed user profile + active program so OnboardingGuard lets existing specs through
  const { error: profileErr } = await admin.from("user_profiles").insert({
    user_id: userId,
    gender: "male",
    age: 30,
    weight_kg: 80,
    goal: "general_fitness",
    experience: "intermediate",
    equipment: "gym",
    training_days_per_week: 4,
    session_duration_minutes: 60,
  })
  if (profileErr) throw new Error(`Failed to seed profile: ${profileErr.message}`)

  const { data: program, error: programErr } = await admin
    .from("programs")
    .insert({ user_id: userId, name: "E2E Test Program", is_active: true })
    .select("id")
    .single()
  if (programErr) throw new Error(`Failed to seed program: ${programErr.message}`)

  // Seed 3 days with French labels that existing E2E specs expect
  const dayLabels = [
    { label: "Lundi", emoji: "💪", sort_order: 0 },
    { label: "Mercredi", emoji: "🔥", sort_order: 1 },
    { label: "Vendredi", emoji: "⚡", sort_order: 2 },
  ]
  const { data: days, error: dayErr } = await admin
    .from("workout_days")
    .insert(dayLabels.map((d) => ({ ...d, program_id: program.id, user_id: userId })))
    .select("id")
  if (dayErr) throw new Error(`Failed to seed workout days: ${dayErr.message}`)

  // Seed one exercise per day so workout-session specs have content
  const { data: exercises } = await admin
    .from("exercises")
    .select("id, name, muscle_group, emoji")
    .limit(3)
  if (exercises && exercises.length >= 3) {
    await admin.from("workout_exercises").insert(
      days!.map((day, i) => ({
        workout_day_id: day.id,
        exercise_id: exercises[i].id,
        name_snapshot: exercises[i].name,
        muscle_snapshot: exercises[i].muscle_group ?? "",
        emoji_snapshot: exercises[i].emoji ?? "🏋️",
        sets: 3,
        reps: "10",
        weight: "0",
        rest_seconds: 90,
        sort_order: 0,
      })),
    )
  }

  fs.mkdirSync(AUTH_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(AUTH_DIR, "user.json"),
    JSON.stringify(storageState, null, 2),
  )
  fs.writeFileSync(path.join(AUTH_DIR, "test-user-id.txt"), userId)
}

export default globalSetup
