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

/** Must match `playwright.config.ts` baseURL (storage state origin) */
const PLAYWRIGHT_APP_ORIGIN =
  process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:4173"

const AUTH_DIR = path.join(__dirname, "..", "playwright", ".auth")

function grantsHint(detail: string) {
  return (
    `Cannot write to the local public schema (${detail}).\n` +
    `The local stack is missing the Supabase grants on public tables. Repair with:\n` +
    `  psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c ` +
    `"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;"`
  )
}

async function globalSetup() {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Reuse a leftover test user instead of failing. A teardown whose
  // `deleteUser` failed (GoTrue runs as `supabase_auth_admin`) leaves the
  // account behind, and `createUser` would then 422 "already registered" — an
  // error that hides the real cause. Reusing makes the leak harmless.
  const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const stale = existing?.users?.find((u) => u.email === TEST_EMAIL)

  let userId: string
  if (stale) {
    userId = stale.id
    // Reset the account's data so the seeding below starts from a clean slate.
    await admin.from("sessions").delete().eq("user_id", userId)
    await admin.from("programs").delete().eq("user_id", userId) // cascades days/exercises/blocks
    await admin.from("user_profiles").delete().eq("user_id", userId)
  } else {
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
      })
    if (createErr) throw new Error(`Failed to create test user: ${createErr.message}`)
    userId = created.user.id
  }

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
        origin: PLAYWRIGHT_APP_ORIGIN,
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

  // Preflight: a fresh `supabase db reset` can leave the public tables without
  // the Supabase grants, and the first write then fails with "permission
  // denied" — which used to surface as a confusing 422. Probe a write here and
  // stop with the cause and the repair command.
  const { data: probe, error: probeErr } = await admin
    .from("analytics_events")
    .insert({ event_type: "e2e_preflight", user_id: userId })
    .select("id")
    .single()
  if (probeErr) {
    throw new Error(
      /permission denied/i.test(probeErr.message)
        ? grantsHint(probeErr.message)
        : `Failed to write to the local database: ${probeErr.message}`,
    )
  }
  await admin.from("analytics_events").delete().eq("id", probe.id)

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
    const weRows = days!.map((day, i) => ({
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
      rep_range_min: 8,
      rep_range_max: 12,
      set_range_min: 2,
      set_range_max: 5,
    }))

    // Progression E2E retests the same Lundi Exercise Slot after a cycle
    // restart (#463 / ADR 0012) — do not seed a second day with the same
    // catalog exercise_id; that is a different slot and must not share history.

    await admin.from("workout_exercises").insert(weRows)
  }

  // Seed an Exercise Block (circuit) on Vendredi so the block-session E2E has
  // a block slot in the unified sequence (#351). Use reps exercises + zero
  // rest/transition so the runner shows "Log" and advances instantly.
  const { data: repsExercises } = await admin
    .from("exercises")
    .select("id, name, muscle_group, emoji, measurement_type")
    .or("measurement_type.eq.reps,measurement_type.is.null")
    .limit(2)
  if (repsExercises && repsExercises.length >= 2) {
    const { data: block, error: blockErr } = await admin
      .from("exercise_blocks")
      .insert({
        workout_day_id: days![2].id,
        label: "E2E Circuit",
        rounds: 2,
        rest_seconds: 0,
        transition_seconds: 0,
        sort_order: 1,
      })
      .select("id")
      .single()
    if (blockErr) throw new Error(`Failed to seed block: ${blockErr.message}`)
    await admin.from("block_exercises").insert(
      repsExercises.map((ex, position) => ({
        block_id: block.id,
        exercise_id: ex.id,
        name_snapshot: ex.name,
        muscle_snapshot: ex.muscle_group ?? "",
        emoji_snapshot: ex.emoji ?? "🏋️",
        position,
        per_round: [
          { amount: 10, weight: 0 },
          { amount: 10, weight: 0 },
        ],
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
