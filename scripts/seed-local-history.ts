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
 *   3. Circuit catalog AMRAP history (Cindy + a few Pantheon seeds):
 *      npm run seed:circuit-history -- --user-id=<uuid>
 *
 * List users on the target instance (service role):
 *   npm run seed:history -- --list-users
 *
 * Re-run safe: removes previous rows where workout_label_snapshot LIKE 'Local seed%'.
 * Circuit seed uses 'Local seed circuit%' days/sessions and is independent.
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

/** Script client (untyped DB — seed targets dynamic local schema without generated types). */
type SeedSupabaseClient = SupabaseClient

const LOCAL_DEFAULT_SUPABASE = "http://127.0.0.1:54321"

const LOCAL_DEMO_SERVICE_ROLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

const PREFIX = "Local seed"
const CIRCUIT_PREFIX = `${PREFIX} circuit`

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

function wantsCircuitsOnly(): boolean {
  return process.argv.some((a) => a === "--circuits-only" || a === "--circuitsOnly")
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

type CircuitRunSpec = {
  daysAgo: number
  startHourUTC: number
  complete: boolean
  fullRounds: number
  leftover: number
  leftoverPosition: number
  capSeconds?: number
}

type SeedRxExercise = { exercise_id: string; amount: number; weight: number }

type SeedCatalog = {
  id: string
  slug: string
  label: string
  rx: { mode: "amrap"; cap_seconds: number; exercises: SeedRxExercise[] }
}

type SeedExercise = { id: string; name: string; muscle_group: string; emoji: string | null }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function parseSeedCatalog(row: unknown): SeedCatalog | null {
  if (!isRecord(row) || typeof row.id !== "string") return null
  if (typeof row.slug !== "string" || typeof row.label !== "string") return null
  if (!isRecord(row.rx) || row.rx.mode !== "amrap" || typeof row.rx.cap_seconds !== "number") {
    return null
  }
  if (!Array.isArray(row.rx.exercises)) return null
  const exercises = row.rx.exercises.flatMap((ex) => {
    if (!isRecord(ex) || typeof ex.exercise_id !== "string") return []
    if (typeof ex.amount !== "number" || typeof ex.weight !== "number") return []
    return [{ exercise_id: ex.exercise_id, amount: ex.amount, weight: ex.weight }]
  })
  if (exercises.length !== row.rx.exercises.length) return null
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    rx: { mode: "amrap", cap_seconds: row.rx.cap_seconds, exercises },
  }
}

function amrapFingerprint(capSeconds: number, exercises: SeedRxExercise[]): string {
  const cells = [...exercises]
    .sort((a, b) => a.exercise_id.localeCompare(b.exercise_id))
    .map((ex) => `${ex.exercise_id}:${ex.amount}:${ex.weight}`)
  return `amrap|${capSeconds}|${cells.join(",")}`
}

function snapshotAmrapBlock(
  catalog: SeedCatalog,
  workoutDayId: string,
  exerciseById: ReadonlyMap<string, SeedExercise>,
) {
  const missing = catalog.rx.exercises.filter((ex) => !exerciseById.has(ex.exercise_id))
  if (missing.length > 0) {
    console.error(
      `Missing exercises for ${catalog.slug}: ${missing.map((ex) => ex.exercise_id).join(", ")}`,
    )
    process.exit(1)
  }
  return {
    block: {
      workout_day_id: workoutDayId,
      label: catalog.label,
      rounds: 1,
      rest_seconds: 0,
      transition_seconds: 0,
      sort_order: 0,
      mode: "amrap" as const,
      cap_seconds: catalog.rx.cap_seconds,
      benchmark_circuit_id: catalog.id,
    },
    blockExercises: catalog.rx.exercises.map((ex, position) => {
      const row = exerciseById.get(ex.exercise_id)
      if (row == null) {
        console.error(`Missing exercise ${ex.exercise_id} for ${catalog.slug}`)
        process.exit(1)
      }
      return {
        exercise_id: ex.exercise_id,
        name_snapshot: row.name,
        muscle_snapshot: row.muscle_group,
        emoji_snapshot: row.emoji ?? "🏋️",
        position,
        per_round: [{ amount: ex.amount, weight: ex.weight }],
      }
    }),
  }
}

const CIRCUIT_RUNS: Record<string, CircuitRunSpec[]> = {
  cindy: [
    { daysAgo: 45, startHourUTC: 7, complete: true, fullRounds: 16, leftover: 5, leftoverPosition: 1 },
    { daysAgo: 30, startHourUTC: 8, complete: true, fullRounds: 18, leftover: 10, leftoverPosition: 1 },
    { daysAgo: 21, startHourUTC: 7, complete: true, fullRounds: 12, leftover: 3, leftoverPosition: 1, capSeconds: 900 },
    { daysAgo: 14, startHourUTC: 18, complete: false, fullRounds: 8, leftover: 4, leftoverPosition: 0 },
    { daysAgo: 10, startHourUTC: 7, complete: true, fullRounds: 20, leftover: 2, leftoverPosition: 0 },
    { daysAgo: 7, startHourUTC: 8, complete: true, fullRounds: 22, leftover: 4, leftoverPosition: 1 },
    { daysAgo: 3, startHourUTC: 7, complete: true, fullRounds: 21, leftover: 12, leftoverPosition: 1 },
    { daysAgo: 1, startHourUTC: 7, complete: true, fullRounds: 24, leftover: 3, leftoverPosition: 1 },
  ],
  zeus: [
    { daysAgo: 20, startHourUTC: 9, complete: true, fullRounds: 11, leftover: 8, leftoverPosition: 2 },
    { daysAgo: 8, startHourUTC: 9, complete: true, fullRounds: 13, leftover: 4, leftoverPosition: 2 },
    { daysAgo: 2, startHourUTC: 9, complete: true, fullRounds: 12, leftover: 10, leftoverPosition: 2 },
  ],
  atlas: [
    { daysAgo: 12, startHourUTC: 12, complete: true, fullRounds: 14, leftover: 6, leftoverPosition: 1 },
    { daysAgo: 4, startHourUTC: 12, complete: true, fullRounds: 16, leftover: 2, leftoverPosition: 1 },
  ],
  hades: [
    { daysAgo: 9, startHourUTC: 17, complete: true, fullRounds: 7, leftover: 5, leftoverPosition: 1 },
    { daysAgo: 3, startHourUTC: 17, complete: true, fullRounds: 9, leftover: 2, leftoverPosition: 1 },
  ],
  heracles: [
    { daysAgo: 6, startHourUTC: 10, complete: true, fullRounds: 8, leftover: 12, leftoverPosition: 0 },
  ],
}

async function clearCircuitSeed(admin: SeedSupabaseClient, userId: string) {
  const { data: days, error: daysErr } = await admin
    .from("workout_days")
    .select("id")
    .eq("user_id", userId)
    .like("label", `${CIRCUIT_PREFIX}%`)
  if (daysErr) {
    console.error("Failed to list circuit seed days:", daysErr.message)
    process.exit(1)
  }
  const dayIds = (days ?? []).flatMap((row) => (typeof row.id === "string" ? [row.id] : []))
  if (dayIds.length > 0) {
    const { error: sessionErr } = await admin
      .from("sessions")
      .delete()
      .eq("user_id", userId)
      .in("workout_day_id", dayIds)
    if (sessionErr) {
      console.error("Failed to clear circuit seed sessions:", sessionErr.message)
      process.exit(1)
    }
    const { error: dayErr } = await admin.from("workout_days").delete().eq("user_id", userId).in("id", dayIds)
    if (dayErr) {
      console.error("Failed to clear circuit seed days:", dayErr.message)
      process.exit(1)
    }
  }
  const { error: orphanErr } = await admin
    .from("sessions")
    .delete()
    .eq("user_id", userId)
    .like("workout_label_snapshot", `${CIRCUIT_PREFIX}%`)
  if (orphanErr) {
    console.error("Failed to clear orphan circuit seed sessions:", orphanErr.message)
    process.exit(1)
  }
}

async function seedCircuitHistory(admin: SeedSupabaseClient, userId: string) {
  await clearCircuitSeed(admin, userId)

  const slugs = Object.keys(CIRCUIT_RUNS)
  const { data: catalogRows, error: catalogErr } = await admin
    .from("benchmark_circuits")
    .select("id, slug, label, aliases, rx")
    .is("owner_id", null)
    .in("slug", slugs)
  if (catalogErr) {
    console.error("Failed to load benchmark circuits:", catalogErr.message)
    process.exit(1)
  }

  const catalogs = (catalogRows ?? []).flatMap((row) => {
    const parsed = parseSeedCatalog(row)
    return parsed ? [parsed] : []
  })
  const missingSlugs = slugs.filter((slug) => !catalogs.some((row) => row.slug === slug))
  if (missingSlugs.length > 0) {
    console.error(`Missing GymLogic seeds (reset local DB?): ${missingSlugs.join(", ")}`)
    process.exit(1)
  }

  const exerciseIds = [...new Set(catalogs.flatMap((row) => row.rx.exercises.map((ex) => ex.exercise_id)))]
  const { data: exerciseRows, error: exErr } = await admin
    .from("exercises")
    .select("id, name, muscle_group, emoji")
    .in("id", exerciseIds)
  if (exErr) {
    console.error("Failed to load exercises:", exErr.message)
    process.exit(1)
  }
  const exerciseById = new Map(
    (exerciseRows ?? []).flatMap((row) => {
      if (
        row == null ||
        typeof row !== "object" ||
        typeof row.id !== "string" ||
        typeof row.name !== "string" ||
        typeof row.muscle_group !== "string"
      ) {
        return []
      }
      const emoji = typeof row.emoji === "string" ? row.emoji : null
      return [[row.id, { id: row.id, name: row.name, muscle_group: row.muscle_group, emoji }] as const]
    }),
  )

  const seeded = await catalogs.reduce(async (pending, catalog) => {
    const count = await pending
    const slug = catalog.slug
    const runs = CIRCUIT_RUNS[slug]
    if (runs == null || runs.length === 0) return count
    const catalogCap = catalog.rx.cap_seconds

    const { data: day, error: dayErr } = await admin
      .from("workout_days")
      .insert({
        user_id: userId,
        program_id: null,
        label: `${CIRCUIT_PREFIX} — ${catalog.label}`,
        emoji: "🔁",
        sort_order: 0,
      })
      .select("id")
      .single()
    if (dayErr || day == null || typeof day.id !== "string") {
      console.error(`Insert workout_day for ${slug} failed:`, dayErr?.message)
      process.exit(1)
    }

    const { block, blockExercises } = snapshotAmrapBlock(catalog, day.id, exerciseById)
    const { data: blockRow, error: blockErr } = await admin
      .from("exercise_blocks")
      .insert(block)
      .select("id")
      .single()
    if (blockErr || blockRow == null || typeof blockRow.id !== "string") {
      console.error(`Insert exercise_block for ${slug} failed:`, blockErr?.message)
      process.exit(1)
    }

    const { data: beRows, error: beErr } = await admin
      .from("block_exercises")
      .insert(blockExercises.map((row) => ({ ...row, block_id: blockRow.id })))
      .select("id, position, exercise_id, name_snapshot")
      .order("position", { ascending: true })
    if (beErr || beRows == null || beRows.length !== blockExercises.length) {
      console.error(`Insert block_exercises for ${slug} failed:`, beErr?.message)
      process.exit(1)
    }
    const stations = [...beRows].sort((a, b) => {
      const pa = typeof a.position === "number" ? a.position : 0
      const pb = typeof b.position === "number" ? b.position : 0
      return pa - pb
    })

    const sessionRows = runs.map((spec) => {
      const capSeconds = spec.capSeconds ?? catalogCap
      const durationMin = Math.round(capSeconds / 60)
      const { started_at, finished_at } = atDaysAgo(spec.daysAgo, spec.startHourUTC, durationMin)
      return {
        spec,
        capSeconds,
        durationMin,
        started_at,
        finished_at: spec.complete ? finished_at : null,
        sessionId: crypto.randomUUID(),
      }
    })

    const { error: sessionErr } = await admin.from("sessions").insert(
      sessionRows.map((row) => ({
        id: row.sessionId,
        user_id: userId,
        workout_day_id: day.id,
        workout_label_snapshot: `${CIRCUIT_PREFIX} — ${catalog.label}`,
        started_at: row.started_at,
        finished_at: row.finished_at,
        active_duration_ms: row.durationMin * 60_000,
        total_sets_done: row.spec.complete ? row.spec.fullRounds + 1 : row.spec.fullRounds,
        has_skipped_sets: false,
        cycle_id: null,
      })),
    )
    if (sessionErr) {
      console.error(`Insert sessions for ${slug} failed:`, sessionErr.message)
      process.exit(1)
    }

    const { error: runErr } = await admin.from("block_runs").insert(
      sessionRows.map((row) => ({
        session_id: row.sessionId,
        block_id: blockRow.id,
        started_at: row.started_at,
        finished_at: row.finished_at,
        mode: "amrap",
        cap_seconds: row.capSeconds,
        template_fingerprint: amrapFingerprint(row.capSeconds, catalog.rx.exercises),
        benchmark_circuit_id: catalog.id,
      })),
    )
    if (runErr) {
      console.error(`Insert block_runs for ${slug} failed:`, runErr.message)
      process.exit(1)
    }

    const leftoverLogs = sessionRows.flatMap((row) => {
      const leftoverBe = stations[row.spec.leftoverPosition]
      if (
        leftoverBe == null ||
        typeof leftoverBe.id !== "string" ||
        typeof leftoverBe.exercise_id !== "string" ||
        typeof leftoverBe.name_snapshot !== "string"
      ) {
        console.error(`leftoverPosition ${row.spec.leftoverPosition} out of range for ${slug}`)
        process.exit(1)
      }
      const leftoverAt = new Date(row.started_at)
      leftoverAt.setUTCMinutes(leftoverAt.getUTCMinutes() + row.durationMin - 1)
      return [
        {
          session_id: row.sessionId,
          exercise_id: leftoverBe.exercise_id,
          block_exercise_id: leftoverBe.id,
          exercise_name_snapshot: leftoverBe.name_snapshot,
          set_number: row.spec.fullRounds + 1,
          reps_logged: String(row.spec.leftover),
          weight_logged: 0,
          estimated_1rm: null,
          was_pr: false,
          rir: null,
          logged_at: leftoverAt.toISOString(),
        },
      ]
    })
    const { error: logErr } = await admin.from("set_logs").insert(leftoverLogs)
    if (logErr) {
      console.error(`Insert set_logs for ${slug} failed:`, logErr.message)
      process.exit(1)
    }

    return count + sessionRows.length
  }, Promise.resolve(0))

  console.log(
    `Inserted ${seeded} AMRAP block_runs for user ${userId}.\n` +
      `Open /library/circuits/cindy (local Vite + local Supabase) after signing in as that user.`,
  )
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

  if (wantsCircuitsOnly()) {
    await seedCircuitHistory(admin, userId)
    return
  }

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
        active_duration_ms: spec.durationMin * 60_000,
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
