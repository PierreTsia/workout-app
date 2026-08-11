/**
 * Restageable Prime Mover demo seed for Product Tour captures (#466 / T181).
 *
 * Targets the **hosted** workout-app Supabase project (full exercise catalog).
 * Does NOT create the auth user — create that in the Dashboard first.
 *
 * Default user (display name Prime Mover):
 *   afce3616-7d7a-4851-9ed4-09f2c0ec4323  (primemover@example.com)
 *
 * Usage:
 *   npm run seed:prime-mover
 *   npm run seed:prime-mover -- --user-id=<uuid>
 *   npm run seed:prime-mover -- --dry-run
 *
 * Env (never commit secrets):
 *   URL:  --url=…  |  SEED_SUPABASE_URL  |  SUPABASE_HISTORY_SEED_URL  |  VITE_SUPABASE_URL
 *   Key:  SUPABASE_HISTORY_SEED_SERVICE_ROLE_KEY  |  SUPABASE_SERVICE_ROLE_KEY
 *
 * Idempotent: deletes prior `Prime Mover%` sessions + `Echo Strength — 3×` program
 * for that user, then recreates profile / program / history / achievements.
 *
 * Local loopback is refused by default (thin catalog). Pass `--allow-local` only
 * for smoke tests against `supabase start`.
 */

import "./load-env.js"
import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  DAY_LABELS,
  DAY_SLOTS,
  PROGRAM_NAME,
  PRIME_MOVER_USER_ID_DEFAULT,
  SESSION_PREFIX,
  buildSessionPlan,
  estimated1rm,
  sessionWindow,
  type DayKey,
  type SlotTemplate,
} from "./prime-mover-plan.js"

type SeedClient = SupabaseClient

/** Local CLI demo JWT — only used with `--allow-local`. */
const LOCAL_CLI_SERVICE_ROLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

function normalizeSupabaseUrl(raw: string): string {
  return raw.trim().replace(/^http:\/\/localhost\b/i, "http://127.0.0.1")
}

function isLocalLoopback(urlStr: string): boolean {
  try {
    const u = new URL(urlStr)
    return u.hostname === "127.0.0.1" || u.hostname === "localhost" || u.hostname === "::1"
  } catch {
    return false
  }
}

function parseFlag(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`${name}=`))
  return arg?.split("=", 2)[1]?.trim()
}

function hasSwitch(name: string): boolean {
  return process.argv.some((a) => a === name)
}

function resolveUrl(): string {
  const fromCli = parseFlag("--url")
  if (fromCli) return normalizeSupabaseUrl(fromCli)
  const fromEnv =
    process.env.SEED_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_HISTORY_SEED_URL?.trim() ||
    process.env.VITE_SUPABASE_URL?.trim()
  if (!fromEnv) {
    console.error(
      "Missing Supabase URL. Set VITE_SUPABASE_URL (hosted) or pass --url=https://….supabase.co",
    )
    process.exit(1)
  }
  return normalizeSupabaseUrl(fromEnv)
}

function resolveServiceRoleKey(supabaseUrl: string): string {
  const override = process.env.SUPABASE_HISTORY_SEED_SERVICE_ROLE_KEY?.trim()
  if (override) return override
  if (isLocalLoopback(supabaseUrl)) return LOCAL_CLI_SERVICE_ROLE
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) {
    console.error(
      "Hosted URL requires SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_HISTORY_SEED_SERVICE_ROLE_KEY).\n" +
        "Do not commit service role keys.",
    )
    process.exit(1)
  }
  return key
}

function resolveUserId(): string {
  return (
    parseFlag("--user-id") ||
    process.env.PRIME_MOVER_USER_ID?.trim() ||
    PRIME_MOVER_USER_ID_DEFAULT
  )
}

async function resolveExercises(
  admin: SeedClient,
  names: string[],
): Promise<Record<string, { id: string; name: string; muscle_group: string; emoji: string }>> {
  const { data, error } = await admin
    .from("exercises")
    .select("id, name, muscle_group, emoji")
    .in("name", names)
  if (error) {
    console.error("Exercise lookup failed:", error.message)
    process.exit(1)
  }
  const byName = Object.fromEntries((data ?? []).map((row) => [row.name, row]))
  const missing = names.filter((n) => !byName[n])
  if (missing.length > 0) {
    console.error(
      "Missing catalog exercises on this project (check names vs prod catalog):\n" +
        missing.map((n) => `  - ${n}`).join("\n"),
    )
    process.exit(1)
  }
  return byName
}

async function clearPrevious(admin: SeedClient, userId: string) {
  // Prefixed history from prior seeds.
  const { error: sessErr } = await admin
    .from("sessions")
    .delete()
    .eq("user_id", userId)
    .like("workout_label_snapshot", `${SESSION_PREFIX}%`)
  if (sessErr) {
    console.error("Failed clearing prior Prime Mover sessions:", sessErr.message)
    process.exit(1)
  }

  const { data: programs, error: progListErr } = await admin
    .from("programs")
    .select("id")
    .eq("user_id", userId)
    .eq("name", PROGRAM_NAME)
  if (progListErr) {
    console.error("Failed listing prior programs:", progListErr.message)
    process.exit(1)
  }

  const programIds = (programs ?? []).map((p) => p.id)
  if (programIds.length === 0) return

  // Capture / live sessions often use day labels ("Push") not the seed prefix —
  // still FK to workout_days and block program delete.
  const { data: days, error: daysErr } = await admin
    .from("workout_days")
    .select("id")
    .in("program_id", programIds)
  if (daysErr) {
    console.error("Failed listing program days:", daysErr.message)
    process.exit(1)
  }
  const dayIds = (days ?? []).map((d) => d.id)
  if (dayIds.length > 0) {
    const { error: linkedSessErr } = await admin
      .from("sessions")
      .delete()
      .eq("user_id", userId)
      .in("workout_day_id", dayIds)
    if (linkedSessErr) {
      console.error("Failed clearing sessions linked to program days:", linkedSessErr.message)
      process.exit(1)
    }
  }

  const { error: cycleErr } = await admin.from("cycles").delete().in("program_id", programIds)
  if (cycleErr) {
    console.error("Failed clearing cycles:", cycleErr.message)
    process.exit(1)
  }
  const { error: progErr } = await admin.from("programs").delete().in("id", programIds)
  if (progErr) {
    console.error("Failed clearing prior program:", progErr.message)
    process.exit(1)
  }
}

async function upsertProfile(admin: SeedClient, userId: string) {
  const { error } = await admin.from("user_profiles").upsert(
    {
      user_id: userId,
      display_name: "Prime Mover",
      locale: "en",
      gender: "prefer_not_to_say",
      age: 34,
      weight_kg: 78,
      goal: "strength",
      experience: "intermediate",
      equipment: "gym",
      training_days_per_week: 3,
      session_duration_minutes: 60,
    },
    { onConflict: "user_id" },
  )
  if (error) {
    console.error("Profile upsert failed:", error.message)
    process.exit(1)
  }
}

async function seedProgram(
  admin: SeedClient,
  userId: string,
  exercises: Record<string, { id: string; name: string; muscle_group: string; emoji: string }>,
): Promise<{ programId: string; dayIds: Record<DayKey, string>; slotIds: Record<DayKey, string[]> }> {
  const { error: deactivateErr } = await admin
    .from("programs")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("is_active", true)
  if (deactivateErr) {
    console.error("Failed deactivating other programs:", deactivateErr.message)
    process.exit(1)
  }

  const { data: program, error: programErr } = await admin
    .from("programs")
    .insert({ user_id: userId, name: PROGRAM_NAME, is_active: true })
    .select("id")
    .single()
  if (programErr || !program) {
    console.error("Program insert failed:", programErr?.message)
    process.exit(1)
  }

  const dayKeys = Object.keys(DAY_LABELS) as DayKey[]
  const dayRows = dayKeys.map((key) => ({
    program_id: program.id,
    user_id: userId,
    ...DAY_LABELS[key],
  }))
  const { data: days, error: dayErr } = await admin
    .from("workout_days")
    .insert(dayRows)
    .select("id, label")
  if (dayErr || !days) {
    console.error("workout_days insert failed:", dayErr?.message)
    process.exit(1)
  }

  const dayIds = Object.fromEntries(
    days.map((d) => {
      const key = (Object.keys(DAY_LABELS) as DayKey[]).find((k) => DAY_LABELS[k].label === d.label)
      if (!key) throw new Error(`Unexpected day label ${d.label}`)
      return [key, d.id] as const
    }),
  ) as Record<DayKey, string>

  const slotIds: Record<DayKey, string[]> = { push: [], pull: [], legs: [] }

  const insertSlots = async (dayKey: DayKey, templates: SlotTemplate[]) => {
    const rows = templates.map((t, sort_order) => {
      const ex = exercises[t.exerciseName]!
      return {
        workout_day_id: dayIds[dayKey],
        exercise_id: ex.id,
        name_snapshot: ex.name,
        muscle_snapshot: ex.muscle_group ?? "",
        emoji_snapshot: ex.emoji ?? "🏋️",
        sets: t.sets,
        reps: String(t.reps),
        weight: String(t.weight),
        rest_seconds: t.restSeconds,
        sort_order,
        rep_range_min: t.repRangeMin,
        rep_range_max: t.repRangeMax,
        set_range_min: t.setRangeMin,
        set_range_max: t.setRangeMax,
        weight_increment: t.weightIncrement,
        max_weight_reached: t.maxWeightReached ?? false,
      }
    })
    const { data, error } = await admin.from("workout_exercises").insert(rows).select("id")
    if (error || !data) {
      console.error(`workout_exercises insert failed (${dayKey}):`, error?.message)
      process.exit(1)
    }
    slotIds[dayKey] = data.map((r) => r.id)
  }

  await insertSlots("push", DAY_SLOTS.push)
  await insertSlots("pull", DAY_SLOTS.pull)
  await insertSlots("legs", DAY_SLOTS.legs)

  const cycleStart = new Date()
  cycleStart.setUTCDate(cycleStart.getUTCDate() - 35)
  const { error: cycleErr } = await admin.from("cycles").insert({
    program_id: program.id,
    user_id: userId,
    started_at: cycleStart.toISOString(),
    finished_at: null,
  })
  if (cycleErr) {
    console.error("cycle insert failed:", cycleErr.message)
    process.exit(1)
  }

  return { programId: program.id, dayIds, slotIds }
}

async function seedSessions(
  admin: SeedClient,
  userId: string,
  dayIds: Record<DayKey, string>,
  slotIds: Record<DayKey, string[]>,
  exercises: Record<string, { id: string; name: string; muscle_group: string; emoji: string }>,
) {
  const plan = buildSessionPlan()
  // Sequential inserts: each session needs its id before set_logs (early-exit on error).
  let inserted = 0
  let setCount = 0

  for (const session of plan) {
    const { started_at, finished_at } = sessionWindow(
      session.daysAgo,
      session.startHourUTC,
      session.durationMin,
    )
    const templates = DAY_SLOTS[session.dayKey]
    const totalSets = session.slots.reduce((n, s) => n + s.length, 0)

    const { data: row, error: sErr } = await admin
      .from("sessions")
      .insert({
        user_id: userId,
        workout_day_id: dayIds[session.dayKey],
        workout_label_snapshot: session.label,
        started_at,
        finished_at,
        active_duration_ms: session.durationMin * 60_000,
        total_sets_done: totalSets,
        has_skipped_sets: false,
        cycle_id: null,
      })
      .select("id")
      .single()
    if (sErr || !row) {
      console.error("session insert failed:", sErr?.message)
      process.exit(1)
    }

    const sessionStartMs = Date.parse(started_at)
    const logs = session.slots.flatMap((outcomes, slotIdx) => {
      const template = templates[slotIdx]!
      const slotId = slotIds[session.dayKey][slotIdx]!
      const ex = exercises[template.exerciseName]!
      return outcomes.map((set, setIdx) => ({
        session_id: row.id,
        exercise_id: ex.id,
        workout_exercise_id: slotId,
        exercise_name_snapshot: ex.name,
        set_number: setIdx + 1,
        reps_logged: String(set.reps),
        duration_seconds: null,
        weight_logged: set.weight,
        estimated_1rm: estimated1rm(set.weight, set.reps),
        was_pr: set.was_pr ?? false,
        rir: set.rir,
        prescribed_reps: template.reps,
        prescribed_weight: template.weight,
        prescribed_sets: template.sets,
        prescribed_duration_seconds: null,
        logged_at: new Date(sessionStartMs + (slotIdx * 8 + setIdx + 1) * 90_000).toISOString(),
      }))
    })

    const { error: lErr } = await admin.from("set_logs").insert(logs)
    if (lErr) {
      console.error("set_logs insert failed:", lErr.message)
      process.exit(1)
    }

    inserted += 1
    setCount += logs.length
  }

  return { inserted, setCount }
}

async function grantAchievements(admin: SeedClient, userId: string) {
  const { error } = await admin.rpc("check_and_grant_achievements", { p_user_id: userId })
  if (error) {
    console.warn("check_and_grant_achievements failed (non-fatal):", error.message)
  }
}

async function main() {
  const supabaseUrl = resolveUrl()
  const allowLocal = hasSwitch("--allow-local")
  const dryRun = hasSwitch("--dry-run")

  if (isLocalLoopback(supabaseUrl) && !allowLocal) {
    console.error(
      `Refusing loopback URL ${supabaseUrl}.\n` +
        "Prime Mover Tour captures need the hosted catalog. Point at *.supabase.co,\n" +
        "or pass --allow-local for a local smoke test.",
    )
    process.exit(1)
  }

  const userId = resolveUserId()
  const serviceRoleKey = resolveServiceRoleKey(supabaseUrl)
  const host = new URL(supabaseUrl).hostname

  console.log(`[seed:prime-mover] host=${host}`)
  console.log(`[seed:prime-mover] user=${userId}`)
  console.log(`[seed:prime-mover] program="${PROGRAM_NAME}"`)

  const plan = buildSessionPlan()
  console.log(
    `[seed:prime-mover] plan=${plan.length} sessions; progression tags: ` +
      plan
        .filter((s) => s.progressionTag)
        .map((s) => `${s.dayKey}=${s.progressionTag}`)
        .join(", "),
  )

  if (dryRun) {
    console.log("[seed:prime-mover] dry-run — no writes")
    return
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as SeedClient

  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId)
  if (authErr || !authUser?.user) {
    console.error(
      `Auth user ${userId} not found on ${host}.\n` +
        "Create the user in Supabase Dashboard → Authentication first.",
      authErr?.message ?? "",
    )
    process.exit(1)
  }
  console.log(`[seed:prime-mover] email=${authUser.user.email ?? "(none)"}`)

  const allNames = Object.values(DAY_SLOTS)
    .flat()
    .map((s) => s.exerciseName)
  const uniqueNames = [...new Set(allNames)]
  const exercises = await resolveExercises(admin, uniqueNames)

  await clearPrevious(admin, userId)
  await upsertProfile(admin, userId)
  const { dayIds, slotIds } = await seedProgram(admin, userId, exercises)
  const { inserted, setCount } = await seedSessions(admin, userId, dayIds, slotIds, exercises)
  await grantAchievements(admin, userId)

  console.log(
    `[seed:prime-mover] Done: ${inserted} sessions / ${setCount} sets.\n` +
      `App UI is Google-only — inject a session for captures via Playwright\n` +
      `(see T181 runbook: PRIME_MOVER_EMAIL / PRIME_MOVER_PASSWORD + storage state).\n` +
      `Client prefs at capture time: EN locale, dark theme, kg.\n` +
      `Checklist: docs/T181_—_Prime_Mover_captures_asset_swap.md`,
  )
}

main()
