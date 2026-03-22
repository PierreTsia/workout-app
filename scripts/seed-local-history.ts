/**
 * Inserts finished sessions + set_logs for local History / Activity / heatmap UI dev.
 *
 * The app login is Google-only; seed data must target YOUR auth user id.
 *
 * Usage:
 *   1. Sign in once with Google locally, then copy your user id from
 *      Supabase Studio → Authentication → Users (or SQL: select id from auth.users).
 *   2. npm run seed:history -- --user-id=<uuid>
 *      or SUPABASE_HISTORY_SEED_USER_ID=<uuid> npm run seed:history
 *
 * Re-run safe: removes previous rows where workout_label_snapshot LIKE 'Local seed%'.
 *
 * Env: VITE_SUPABASE_URL (default http://127.0.0.1:54321), SUPABASE_SERVICE_ROLE_KEY
 * (defaults to local Supabase demo service role if unset).
 */

import "./load-env.js"
import { createClient } from "@supabase/supabase-js"

const LOCAL_DEMO_SERVICE_ROLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL?.replace("localhost", "127.0.0.1") ??
  "http://127.0.0.1:54321"
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_DEMO_SERVICE_ROLE

const PREFIX = "Local seed"

function parseUserId(): string | undefined {
  const arg = process.argv.find((a) => a.startsWith("--user-id="))
  if (arg) return arg.split("=", 2)[1]?.trim()
  return process.env.SUPABASE_HISTORY_SEED_USER_ID?.trim()
}

function atDaysAgo(daysAgo: number, startHourUTC: number, durationMin: number) {
  const started = new Date()
  started.setUTCHours(startHourUTC, 0, 0, 0)
  started.setUTCDate(started.getUTCDate() - daysAgo)
  const finished = new Date(started.getTime() + durationMin * 60_000)
  return { started_at: started.toISOString(), finished_at: finished.toISOString() }
}

type SessionSpec = {
  daysAgo: number
  startHourUTC: number
  durationMin: number
  label: string
  totalSets: number
  /** exercise name from seed.sql (French) → set rows */
  exerciseName: string
  sets: { reps: number; weight: number; was_pr?: boolean }[]
}

async function main() {
  const userId = parseUserId()
  if (!userId) {
    console.error(
      "Missing user id. After Google sign-in, copy auth.users.id from Studio, then:\n" +
        "  npm run seed:history -- --user-id=<uuid>\n" +
        "or set SUPABASE_HISTORY_SEED_USER_ID",
    )
    process.exit(1)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error: delErr } = await admin
    .from("sessions")
    .delete()
    .eq("user_id", userId)
    .like("workout_label_snapshot", `${PREFIX}%`)
  if (delErr) {
    console.error("Failed to clear old seed sessions:", delErr.message)
    process.exit(1)
  }

  const exerciseNames = [
    "Développé couché",
    "Squat barre",
    "Tirage latéral prise large",
    "Élévations latérales",
    "Soulevé de terre roumain",
  ] as const

  const exIds: Record<string, string> = {}
  for (const name of exerciseNames) {
    const { data, error } = await admin.from("exercises").select("id").eq("name", name).maybeSingle()
    if (error || !data) {
      console.error(`Exercise not found (run db reset + seed): "${name}"`, error?.message)
      process.exit(1)
    }
    exIds[name] = data.id
  }

  const specs: SessionSpec[] = []
  const spreadDays = [
    0, 0, 1, 2, 3, 5, 7, 8, 10, 12, 14, 15, 18, 21, 22, 25, 28, 30, 35, 40, 45, 50, 55, 60, 67, 74,
    82, 90,
  ]
  let i = 0
  for (const daysAgo of spreadDays) {
    const primary =
      exerciseNames[i % exerciseNames.length]!
    const secondary = exerciseNames[(i + 2) % exerciseNames.length]!
    const durationMin = 35 + (i % 5) * 12
    const startHourUTC = 7 + (i % 8)
    const sets =
      i % 3 === 0
        ? [
            { reps: 8, weight: 60 + (i % 3) * 2.5 },
            { reps: 8, weight: 62.5 + (i % 3) * 2.5 },
            { reps: 6, weight: 65 + (i % 3) * 2.5, was_pr: i % 7 === 0 },
          ]
        : [
            { reps: 10, weight: 40 },
            { reps: 10, weight: 40 },
          ]
    specs.push({
      daysAgo,
      startHourUTC,
      durationMin,
      label: `${PREFIX} — ${primary.split(" ")[0]} ${i + 1}`,
      totalSets: sets.length,
      exerciseName: primary,
      sets,
    })
    if (i % 4 === 0 && daysAgo > 0) {
      specs.push({
        daysAgo,
        startHourUTC: (startHourUTC + 5) % 20,
        durationMin: 28,
        label: `${PREFIX} — Quick ${i}`,
        totalSets: 2,
        exerciseName: secondary,
        sets: [
          { reps: 12, weight: 20 },
          { reps: 12, weight: 22 },
        ],
      })
    }
    i++
  }

  let inserted = 0
  for (const spec of specs) {
    const { started_at, finished_at } = atDaysAgo(spec.daysAgo, spec.startHourUTC, spec.durationMin)
    const { data: session, error: sErr } = await admin
      .from("sessions")
      .insert({
        user_id: userId,
        workout_day_id: null,
        workout_label_snapshot: spec.label,
        started_at,
        finished_at,
        total_sets_done: spec.totalSets,
        has_skipped_sets: false,
        cycle_id: null,
      })
      .select("id")
      .single()
    if (sErr || !session) {
      console.error("Insert session failed:", sErr?.message)
      process.exit(1)
    }

    const exerciseId = exIds[spec.exerciseName]!
    const logs = spec.sets.map((s, idx) => ({
      session_id: session.id,
      exercise_id: exerciseId,
      exercise_name_snapshot: spec.exerciseName,
      set_number: idx + 1,
      reps_logged: String(s.reps),
      weight_logged: s.weight,
      estimated_1rm: null,
      was_pr: s.was_pr ?? false,
      rir: null,
    }))
    const { error: lErr } = await admin.from("set_logs").insert(logs)
    if (lErr) {
      console.error("Insert set_logs failed:", lErr.message)
      process.exit(1)
    }
    inserted++
  }

  console.log(
    `Inserted ${inserted} seed sessions (+ set_logs) for user ${userId}.\n` +
      `Open /history after signing in as that user.`,
  )
}

main()
