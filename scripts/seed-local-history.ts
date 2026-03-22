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
 * List users on the target instance (service role):
 *   npm run seed:history -- --list-users
 *
 * Re-run safe: removes previous rows where workout_label_snapshot LIKE 'Local seed%'.
 *
 * Target URL (this script does NOT read VITE_SUPABASE_URL — that often points at hosted prod):
 *   1. --url=http://127.0.0.1:54321
 *   2. SUPABASE_HISTORY_SEED_URL or SEED_SUPABASE_URL
 *   3. default http://127.0.0.1:54321
 *
 * Service role key resolution:
 *   - SUPABASE_HISTORY_SEED_SERVICE_ROLE_KEY: optional override for this script only (any URL).
 *   - Loopback URL (127.0.0.1 / localhost): always use the local CLI
 *     [demo service role](https://supabase.com/docs/guides/local-development/cli).
 *     SUPABASE_SERVICE_ROLE_KEY from .env is IGNORED here — it is often your hosted project's key
 *     and would cause "invalid JWT / signature is invalid" against local Auth.
 *   - Non-local URL: SUPABASE_SERVICE_ROLE_KEY is required (or use SUPABASE_HISTORY_SEED_SERVICE_ROLE_KEY).
 */

import "./load-env.js"
import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

/** Script client shape (avoids createClient<> overload vs ReturnType mismatch in helpers). */
type SeedSupabaseClient = SupabaseClient<any, "public", "public", any, any>

const LOCAL_DEFAULT_SUPABASE = "http://127.0.0.1:54321"

const LOCAL_DEMO_SERVICE_ROLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

const PREFIX = "Local seed"

function normalizeSupabaseUrl(raw: string): string {
  return raw.trim().replace(/^http:\/\/localhost\b/i, "http://127.0.0.1")
}

function parseUrlArg(): string | undefined {
  const arg = process.argv.find((a) => a.startsWith("--url="))
  const raw = arg?.split("=", 2)[1]?.trim()
  if (!raw) return undefined
  return normalizeSupabaseUrl(raw)
}

/**
 * Local CLI / docker: 127.0.0.1, localhost, ::1. Anything else needs an explicit service role key.
 */
function isLocalLoopbackApi(urlStr: string): boolean {
  try {
    const u = new URL(urlStr)
    return u.hostname === "127.0.0.1" || u.hostname === "localhost" || u.hostname === "::1"
  } catch {
    return false
  }
}

function resolveSeedSupabaseUrl(): string {
  const fromCli = parseUrlArg()
  if (fromCli) return fromCli
  const fromEnv =
    process.env.SUPABASE_HISTORY_SEED_URL?.trim() || process.env.SEED_SUPABASE_URL?.trim()
  if (fromEnv) return normalizeSupabaseUrl(fromEnv)
  return LOCAL_DEFAULT_SUPABASE
}

function resolveServiceRoleKey(supabaseUrl: string): string {
  const seedOverride = process.env.SUPABASE_HISTORY_SEED_SERVICE_ROLE_KEY?.trim()
  if (seedOverride) return seedOverride

  if (isLocalLoopbackApi(supabaseUrl)) {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      console.log(
        "[seed:history] Using local demo service role for loopback URL (SUPABASE_SERVICE_ROLE_KEY in .env is ignored — it is usually the hosted key and breaks local Auth).",
      )
    }
    return LOCAL_DEMO_SERVICE_ROLE
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (key) return key
  console.error(
    "Non-local Supabase URL requires SUPABASE_SERVICE_ROLE_KEY or SUPABASE_HISTORY_SEED_SERVICE_ROLE_KEY.\n" +
      "(Do not commit service role keys.)\n" +
      "Or omit SUPABASE_HISTORY_SEED_URL / --url to use the default local stack.",
  )
  process.exit(1)
}

function isJwtSignatureAuthError(message: string | undefined): boolean {
  if (!message) return false
  const m = message.toLowerCase()
  return (
    m.includes("invalid jwt") ||
    m.includes("signature is invalid") ||
    m.includes("parse or verify signature")
  )
}

function printJwtKeyMismatchHint(supabaseUrl: string) {
  if (!isLocalLoopbackApi(supabaseUrl)) return
  console.error(
    "\nLocal Auth rejected the JWT: your .env may set SUPABASE_SERVICE_ROLE_KEY to a **hosted** service role.\n" +
      "This script now uses the **local demo** service role for 127.0.0.1 by default.\n" +
      "If you changed local JWT secrets, set SUPABASE_HISTORY_SEED_SERVICE_ROLE_KEY from `supabase status`.\n",
  )
}

function parseUserId(): string | undefined {
  const arg = process.argv.find((a) => a.startsWith("--user-id="))
  if (arg) return arg.split("=", 2)[1]?.trim()
  return process.env.SUPABASE_HISTORY_SEED_USER_ID?.trim()
}

function wantsListUsers(): boolean {
  return process.argv.some((a) => a === "--list-users" || a === "--listUsers")
}

function printAuthUserHint(supabaseUrl: string) {
  console.error(
    `\nThe id must exist in auth.users on THIS Supabase project (script target: ${supabaseUrl}).\n` +
      "Common mistakes: id copied from another env / hosted project, or local stack was reset after sign-in.\n" +
      "Fix: sign in again on that instance, then run:\n" +
      "  npm run seed:history -- --list-users\n" +
      "and pass --user-id=… from that list.\n",
  )
}

async function listAuthUsers(admin: SeedSupabaseClient, supabaseUrl: string) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200, page: 1 })
  if (error) {
    console.error("listUsers failed:", error.message)
    if (isJwtSignatureAuthError(error.message)) printJwtKeyMismatchHint(supabaseUrl)
    process.exit(1)
  }
  const users = data?.users ?? []
  if (users.length === 0) {
    console.log("No users in auth.users on", supabaseUrl, "— sign in once (e.g. Google), then re-run.")
    return
  }
  console.log(`Users on ${supabaseUrl} (${users.length} shown, first page):\n`)
  for (const u of users) {
    console.log(`  ${u.id}  ${u.email ?? "(no email)"}`)
  }
  console.log("\nThen: npm run seed:history -- --user-id=<uuid above>")
}

async function assertUserExistsForSessions(
  admin: SeedSupabaseClient,
  userId: string,
  supabaseUrl: string,
) {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error && isJwtSignatureAuthError(error.message)) {
    console.error(`Auth admin API failed: ${error.message}`)
    printJwtKeyMismatchHint(supabaseUrl)
    process.exit(1)
  }
  if (error || !data?.user) {
    console.error(
      `No auth user with id ${userId} on ${supabaseUrl}.\n` +
        (error ? `Auth API: ${error.message}\n` : ""),
    )
    printAuthUserHint(supabaseUrl)
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 20, page: 1 })
    const found = list?.users ?? []
    if (found.length > 0) {
      console.error("First users on this instance:")
      for (const u of found) {
        console.error(`  ${u.id}  ${u.email ?? ""}`)
      }
    }
    process.exit(1)
  }
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
  const supabaseUrl = resolveSeedSupabaseUrl()
  const serviceRoleKey = resolveServiceRoleKey(supabaseUrl)
  console.log(`[seed:history] ${supabaseUrl}`)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as SeedSupabaseClient

  if (wantsListUsers()) {
    await listAuthUsers(admin, supabaseUrl)
    return
  }

  const userId = parseUserId()
  if (!userId) {
    console.error(
      "Missing user id. After Google sign-in, copy auth.users.id from Studio, then:\n" +
        "  npm run seed:history -- --user-id=<uuid>\n" +
        "or set SUPABASE_HISTORY_SEED_USER_ID\n\n" +
        "To print ids on this instance:\n" +
        "  npm run seed:history -- --list-users",
    )
    process.exit(1)
  }

  await assertUserExistsForSessions(admin, userId, supabaseUrl)

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
      if (sErr?.message?.includes("sessions_user_id_fkey")) {
        printAuthUserHint(supabaseUrl)
      }
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
