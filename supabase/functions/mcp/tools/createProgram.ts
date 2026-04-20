import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.103.3"
import type { ToolDefinition } from "./registry.ts"
import {
  buildWorkoutExerciseInsertRowsForDay,
  dayEmojiForProgramDayIndex,
  type CatalogExerciseForProgram,
  type GeneratedExerciseForProgram,
} from "../lib/programPersistence.ts"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const DEFAULT_SETS = 3
const DEFAULT_REPS = "10"
const DEFAULT_REST_SECONDS = 90
const MAX_DAYS = 14
const MAX_EXERCISES_PER_DAY = 40

type DayInput = {
  label: string
  exercise_ids: string[]
}

function isUuid(s: string): boolean {
  return UUID_RE.test(s)
}

function catalogRowToExercise(row: Record<string, unknown>): CatalogExerciseForProgram {
  const mt = row.measurement_type
  const measurement_type: "reps" | "duration" = mt === "duration" ? "duration" : "reps"
  const rawDur = row.default_duration_seconds
  let default_duration_seconds: number | null = null
  if (rawDur != null && rawDur !== "") {
    const n = Number(rawDur)
    default_duration_seconds = Number.isFinite(n) ? n : null
  }
  return {
    id: String(row.id),
    name: String(row.name),
    muscle_group: String(row.muscle_group),
    emoji: row.emoji != null ? String(row.emoji) : null,
    equipment: String(row.equipment),
    measurement_type,
    default_duration_seconds,
  }
}

function defaultGeneratedExercise(ex: CatalogExerciseForProgram): GeneratedExerciseForProgram {
  const isDuration = ex.measurement_type === "duration"
  return {
    exercise: ex,
    sets: DEFAULT_SETS,
    reps: isDuration ? "0" : DEFAULT_REPS,
    restSeconds: DEFAULT_REST_SECONDS,
    isCompound: false,
  }
}

async function fetchExercisesByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<{ data: CatalogExerciseForProgram[]; error: string | null }> {
  const unique = [...new Set(ids)]
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, muscle_group, emoji, equipment, measurement_type, default_duration_seconds")
    .in("id", unique)

  if (error) return { data: [], error: error.message }
  const rows = (data ?? []) as Record<string, unknown>[]
  const mapped = rows.map(catalogRowToExercise)
  if (mapped.length !== unique.length) {
    const found = new Set(mapped.map((e) => e.id))
    const missing = unique.filter((id) => !found.has(id))
    return {
      data: [],
      error: `Unknown or inaccessible exercise_id(s): ${missing.join(", ")}`,
    }
  }
  return { data: mapped, error: null }
}

export const createProgram: ToolDefinition = {
  name: "create_program",
  description:
    "Create a multi-day training program in the user's Gymlogic account (same persistence as the in-app AI program flow). " +
    "Uses default prescription unless you extend the schema later: 3 sets, 10 reps (or duration mode for time-based exercises), 90s rest. " +
    "**Always call with dry_run true first** (default); only pass dry_run false after reviewing the preview. " +
    "When applied, deactivates other active programs and sets this program active so it appears in the app immediately.",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Program display name (e.g. \"Push / Pull 4d\").",
      },
      days: {
        type: "array",
        description:
          "Ordered training days. Each day has a label and an ordered list of exercise UUIDs from the catalog (use search_exercises / get_exercise_details to resolve IDs).",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Day label shown in the app (e.g. \"Upper\")." },
            exercise_ids: {
              type: "array",
              items: { type: "string" },
              description: "Ordered exercise UUIDs for this day.",
            },
          },
          required: ["label", "exercise_ids"],
        },
      },
      dry_run: {
        type: "boolean",
        description: "If true or omitted, validate and return the insert plan without writing. If false, perform the database writes.",
      },
    },
    required: ["name", "days"],
  },

  async handler(args, supabase) {
    if (!supabase) {
      return {
        content: [{ type: "text", text: "Authentication required — please provide a valid Bearer token." }],
        isError: true,
      }
    }

    const dryRun = (args.dry_run as boolean | undefined) !== false
    const name = String(args.name ?? "").trim()
    const days = args.days as DayInput[] | undefined

    if (!name) {
      return {
        content: [{ type: "text", text: "Invalid input: `name` must be a non-empty string." }],
        isError: true,
      }
    }

    if (!Array.isArray(days) || days.length === 0) {
      return {
        content: [{ type: "text", text: "Invalid input: `days` must be a non-empty array." }],
        isError: true,
      }
    }

    if (days.length > MAX_DAYS) {
      return {
        content: [{ type: "text", text: `Invalid input: at most ${MAX_DAYS} days allowed.` }],
        isError: true,
      }
    }

    const normalizedDays: DayInput[] = []
    for (const [i, d] of days.entries()) {
      const label = typeof d?.label === "string" ? d.label.trim() : ""
      const ids = Array.isArray(d?.exercise_ids) ? d.exercise_ids.map(String) : []
      if (!label) {
        return {
          content: [{ type: "text", text: `Invalid input: days[${i}].label is required.` }],
          isError: true,
        }
      }
      if (ids.length === 0) {
        return {
          content: [{ type: "text", text: `Invalid input: days[${i}].exercise_ids must be non-empty.` }],
          isError: true,
        }
      }
      if (ids.length > MAX_EXERCISES_PER_DAY) {
        return {
          content: [{ type: "text", text: `Invalid input: days[${i}] exceeds ${MAX_EXERCISES_PER_DAY} exercises.` }],
          isError: true,
        }
      }
      const bad = ids.filter((id) => !isUuid(id))
      if (bad.length > 0) {
        return {
          content: [{ type: "text", text: `Invalid UUID(s) in days[${i}].exercise_ids: ${bad.join(", ")}` }],
          isError: true,
        }
      }
      normalizedDays.push({ label, exercise_ids: ids })
    }

    const allIds = [...new Set(normalizedDays.flatMap((d) => d.exercise_ids))]
    const { data: exercises, error: fetchErr } = await fetchExercisesByIds(supabase, allIds)
    if (fetchErr) {
      return { content: [{ type: "text", text: fetchErr }], isError: true }
    }

    const byId = new Map(exercises.map((e) => [e.id, e] as const))

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) {
      return {
        content: [{ type: "text", text: "Could not identify the authenticated user." }],
        isError: true,
      }
    }
    const userId = userData.user.id

    const previewDays = normalizedDays.map((day, dayIndex) => {
      const generated = day.exercise_ids.map((id) => defaultGeneratedExercise(byId.get(id)!))
      const placeholderDayId = `00000000-0000-4000-8000-${String(dayIndex).padStart(12, "0")}`
      const workout_exercises = buildWorkoutExerciseInsertRowsForDay(placeholderDayId, generated).map(
        (row) => {
          const { workout_day_id: _, ...rest } = row
          return rest
        },
      )
      return {
        sort_order: dayIndex,
        label: day.label,
        emoji: dayEmojiForProgramDayIndex(dayIndex),
        workout_exercises,
      }
    })

    const previewPayload = {
      dry_run: dryRun,
      program: { name, is_active: true, template_id: null as null },
      days: previewDays,
    }

    if (dryRun) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ...previewPayload,
                note: "workout_day_id omitted per exercise row; server assigns UUIDs on insert. Re-call with dry_run false to persist.",
              },
              null,
              2,
            ),
          },
        ],
      }
    }

    let createdProgramId: string | null = null
    const createdDayIds: string[] = []
    let previousActiveProgramIds: string[] = []

    try {
      const { data: activePrograms, error: activeProgramsError } = await supabase
        .from("programs")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)

      if (activeProgramsError) throw activeProgramsError
      previousActiveProgramIds = (activePrograms ?? []).map((p) => p.id as string)

      const { data: prog, error: progError } = await supabase
        .from("programs")
        .insert({
          user_id: userId,
          name,
          template_id: null,
          is_active: false,
        })
        .select("id")
        .single()

      if (progError) throw progError
      if (!prog?.id) throw new Error("Program insert returned no id")
      createdProgramId = prog.id

      for (const [i, day] of normalizedDays.entries()) {
        const { data: insertedDay, error: dayError } = await supabase
          .from("workout_days")
          .insert({
            program_id: prog.id,
            user_id: userId,
            label: day.label,
            emoji: dayEmojiForProgramDayIndex(i),
            sort_order: i,
          })
          .select("id")
          .single()

        if (dayError) throw dayError
        if (!insertedDay?.id) throw new Error("workout_day insert returned no id")

        createdDayIds.push(insertedDay.id)

        const generated = day.exercise_ids.map((id) => defaultGeneratedExercise(byId.get(id)!))
        const rows = buildWorkoutExerciseInsertRowsForDay(insertedDay.id, generated)

        const { error: exError } = await supabase.from("workout_exercises").insert(rows)
        if (exError) throw exError
      }

      const { error: deactivateError } = await supabase
        .from("programs")
        .update({ is_active: false })
        .eq("user_id", userId)
        .eq("is_active", true)

      if (deactivateError) throw deactivateError

      const { error: activateError } = await supabase
        .from("programs")
        .update({ is_active: true })
        .eq("id", prog.id)

      if (activateError) throw activateError

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                dry_run: false,
                program_id: prog.id,
                workout_day_ids: createdDayIds,
                message: "Program created and set active. Open the app to train.",
              },
              null,
              2,
            ),
          },
        ],
      }
    } catch (applyError) {
      if (createdDayIds.length > 0) {
        await supabase.from("workout_exercises").delete().in("workout_day_id", createdDayIds)
        await supabase.from("workout_days").delete().in("id", createdDayIds)
      }
      if (createdProgramId) {
        await supabase.from("programs").delete().eq("id", createdProgramId)
      }
      if (previousActiveProgramIds.length > 0) {
        await supabase
          .from("programs")
          .update({ is_active: true })
          .in("id", previousActiveProgramIds)
      }
      const message = applyError instanceof Error ? applyError.message : String(applyError)
      return {
        content: [{ type: "text", text: `create_program failed: ${message}` }],
        isError: true,
      }
    }
  },
}
