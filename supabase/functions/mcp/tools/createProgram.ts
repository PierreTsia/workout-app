import type { ToolDefinition } from "./registry.ts"
import {
  buildWorkoutExerciseInsertRowsForDay,
  dayEmojiForProgramDayIndex,
  parseRepsBounds,
  type CatalogExerciseForProgram,
  type GeneratedExerciseForProgram,
} from "../lib/programPersistence.ts"
import { formatPrescriptionLine, formatWeightConvention } from "../lib/format.ts"
import {
  detectLegacyExerciseIds,
  LEGACY_MIGRATION_ERROR_MESSAGE,
  validateDayExercises,
  type ParsedExercise,
} from "../lib/createProgramValidation.ts"
import { fetchExercisesByIds } from "../lib/catalogLookup.ts"
import { isUuid } from "../lib/uuid.ts"

/**
 * Walk a raw `exercises[]` payload and extract every entry that LOOKS like a
 * catalog id (bare UUID string or an object with an `exercise_id: <uuid>`).
 * Non-UUID inputs are dropped — they're surfaced later by `validateDayExercises`
 * via `parseExerciseInput`'s locator-aware error message. This keeps the
 * catalog fetch from leaking Postgres "invalid input syntax for type uuid"
 * errors to the agent.
 */
function collectCandidateExerciseIds(raw: unknown[]): string[] {
  return raw.flatMap((entry) => {
    if (typeof entry === "string") {
      return isUuid(entry) ? [entry] : []
    }
    if (entry !== null && typeof entry === "object" && !Array.isArray(entry)) {
      const id = (entry as Record<string, unknown>).exercise_id
      return typeof id === "string" && isUuid(id) ? [id] : []
    }
    return []
  })
}

const DEFAULT_SETS = 3
const DEFAULT_REPS = "10"
const DEFAULT_REST_SECONDS = 90
const MAX_DAYS = 14
const MAX_EXERCISES_PER_DAY = 40

type DayInput = {
  label: string
  exercises: unknown[]
}

type ParsedDay = {
  label: string
  exercises: ParsedExercise[]
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

/**
 * Build the persistence input from an object-form parsed exercise. Freezes the
 * progression range bounds to the agent-provided sets and reps (T74 spec).
 * Bodyweight (T75) and duration (T75) branches inside `buildWorkoutExerciseInsertRow`
 * will override these range fields when relevant.
 */
function geFromParsedObject(
  parsed: Extract<ParsedExercise, { kind: "object" }>,
  ex: CatalogExerciseForProgram,
): GeneratedExerciseForProgram {
  const bounds = parseRepsBounds(parsed.reps)
  return {
    exercise: ex,
    sets: parsed.sets,
    reps: parsed.reps,
    restSeconds: parsed.restSeconds,
    isCompound: false,
    weightKg: parsed.weightKg,
    repRangeMin: bounds.min,
    repRangeMax: bounds.max,
    setRangeMin: parsed.sets,
    setRangeMax: parsed.sets,
    targetDurationSeconds: parsed.targetDurationSeconds ?? undefined,
  }
}

function geFromParsed(
  parsed: ParsedExercise,
  ex: CatalogExerciseForProgram,
): GeneratedExerciseForProgram {
  return parsed.kind === "bare" ? defaultGeneratedExercise(ex) : geFromParsedObject(parsed, ex)
}

const TOOL_DESCRIPTION = `Create a multi-day training program in the user's GymLogic account (same persistence as the in-app AI program flow).

Each item in a day's \`exercises\` array can be EITHER:
  - A bare UUID string — applies legacy defaults (3 sets, 10 reps, 0 kg, 90s rest, auto-derived ranges).
  - A prescription object — explicit \`sets\`, \`reps\`, \`weight_kg\`, \`rest_seconds\`. Freezes the progression ranges around the prescribed values.

Reps formats:
  - "8"     → linear progression (rep_range frozen at 8/8). Weight bumps when target hit.
  - "8-12"  → double progression (rep_range frozen at 8/12). Reps grow first, then weight bumps and reps reset.

Weight conventions: per_hand for dumbbells/kettlebells, total for barbells/machines/cables. Call \`get_exercise_details\` first to confirm the convention (\`weight_convention\` field). Bodyweight exercises must use weight_kg=0; weighted bodyweight (weighted dips/pull-ups) is tracked in #281.

Bounds: sets [1,10], reps [1,50] for reps exercises (use "0" ONLY for duration exercises, paired with target_duration_seconds), weight_kg [0,500], rest_seconds [0,600], target_duration_seconds [5,600].

Always call with dry_run: true first; review the \`preview.days[].rendered\` lines (e.g. "Bench Press — 4 × 8 × 80 kg total — 120s rest"), then re-call with dry_run: false to persist.

Activates the new program and deactivates any other active program. Breaking change in v0.3.0: the \`exercise_ids\` field has been removed (use \`exercises\` instead).`

export const createProgram: ToolDefinition = {
  name: "create_program",
  description: TOOL_DESCRIPTION,
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
          "Ordered training days. Each day has a label and an ordered `exercises` array of either bare UUIDs (defaults) or full prescription objects.",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Day label shown in the app (e.g. \"Upper\")." },
            exercises: {
              type: "array",
              description:
                "Ordered exercises for this day. Each item is a UUID string (legacy defaults) OR an object with required prescription fields.",
              items: {
                oneOf: [
                  {
                    type: "string",
                    description:
                      "Bare exercise UUID — defaults applied (3 sets, 10 reps, 0 kg, 90s rest).",
                  },
                  {
                    type: "object",
                    description:
                      "Full prescription. All of {exercise_id, sets, reps, weight_kg, rest_seconds} required; target_duration_seconds optional and reserved for duration exercises (T75).",
                    properties: {
                      exercise_id: {
                        type: "string",
                        description: "UUID from search_exercises / get_exercise_details.",
                      },
                      sets: {
                        type: "integer",
                        minimum: 1,
                        maximum: 10,
                        description: "Number of working sets per exercise (1-10).",
                      },
                      reps: {
                        type: "string",
                        pattern: "^\\d+(-\\d+)?$",
                        description: "\"N\" (linear, e.g. \"8\") or \"N-M\" (double progression, e.g. \"8-12\"). Bounds: 1-50 for reps exercises; use \"0\" ONLY for duration exercises (paired with target_duration_seconds).",
                      },
                      weight_kg: {
                        type: "number",
                        minimum: 0,
                        maximum: 500,
                        description: "Working weight per set. Per hand for dumbbells/kettlebells, total for barbells/machines (see get_exercise_details).",
                      },
                      rest_seconds: {
                        type: "integer",
                        minimum: 0,
                        maximum: 600,
                        description: "Rest between sets in seconds (0-600).",
                      },
                      target_duration_seconds: {
                        type: "integer",
                        minimum: 5,
                        maximum: 600,
                        description: "Target duration in seconds for time-based exercises (planks, holds). Cross-field rules T75.",
                      },
                    },
                    required: ["exercise_id", "sets", "reps", "weight_kg", "rest_seconds"],
                  },
                ],
              },
            },
          },
          required: ["label", "exercises"],
        },
      },
      dry_run: {
        type: "boolean",
        description: "If true or omitted, validate and return the insert plan with rendered echo without writing. If false, perform the database writes.",
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

    // T74: detect v0.2.x legacy callers up-front and surface a structured
    // migration error before any other validation runs. This also catches the
    // common LLM mistake of using both the old and new shapes in the same call.
    if (detectLegacyExerciseIds(args)) {
      return {
        content: [{ type: "text", text: LEGACY_MIGRATION_ERROR_MESSAGE }],
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

    // Phase 1 — day-level shape (label + exercises array bounds). Per-exercise
    // parse + cross-field is consolidated into Phase 3 via validateDayExercises.
    const rawDays: { label: string; exercises: unknown[] }[] = []
    for (const [i, d] of days.entries()) {
      const label = typeof d?.label === "string" ? d.label.trim() : ""
      const exercisesArr = Array.isArray(d?.exercises) ? d.exercises : null
      if (!label) {
        return {
          content: [{ type: "text", text: `Invalid input: days[${i}].label is required.` }],
          isError: true,
        }
      }
      if (!exercisesArr || exercisesArr.length === 0) {
        return {
          content: [{ type: "text", text: `Invalid input: days[${i}].exercises must be a non-empty array.` }],
          isError: true,
        }
      }
      if (exercisesArr.length > MAX_EXERCISES_PER_DAY) {
        return {
          content: [{ type: "text", text: `Invalid input: days[${i}] exceeds ${MAX_EXERCISES_PER_DAY} exercises.` }],
          isError: true,
        }
      }
      rawDays.push({ label, exercises: exercisesArr })
    }

    // Phase 2 — catalog fetch (Supabase, RLS-scoped to caller). Candidate IDs
    // are pre-filtered to syntactically-valid UUIDs so a malformed input
    // surfaces via validateDayExercises (locator-aware) rather than as a
    // Postgres syntax error from the IN clause.
    const allIds = [
      ...new Set(rawDays.flatMap((d) => collectCandidateExerciseIds(d.exercises))),
    ]
    const { data: exercises, error: fetchErr } = await fetchExercisesByIds(supabase, allIds)
    if (fetchErr) {
      return { content: [{ type: "text", text: fetchErr }], isError: true }
    }

    const byId = new Map(exercises.map((e) => [e.id, e] as const))

    // Phase 3 — full per-day validation: parse + cross-field (T75 superset).
    const parsedDays: ParsedDay[] = []
    for (const day of rawDays) {
      const result = validateDayExercises(day.exercises, day.label, byId)
      if (!result.ok) {
        return {
          content: [{ type: "text", text: `Invalid input: ${result.error}` }],
          isError: true,
        }
      }
      parsedDays.push({ label: day.label, exercises: result.parsed })
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) {
      return {
        content: [{ type: "text", text: "Could not identify the authenticated user." }],
        isError: true,
      }
    }
    const userId = userData.user.id

    // Phase 4 — build per-day generated rows + dry_run preview lines.
    // The `rendered` echo derives from the persisted row (source of truth) so
    // the agent sees exactly what will land in the database — including the
    // catalog-default target_duration_seconds for bare-string duration entries
    // and the bodyweight branch's defensive weight=0.
    const previewDays = parsedDays.map((day, dayIndex) => {
      const generated = day.exercises.map((parsed) => geFromParsed(parsed, byId.get(parsed.exerciseId)!))
      const placeholderDayId = `00000000-0000-4000-8000-${String(dayIndex).padStart(12, "0")}`
      const fullRows = buildWorkoutExerciseInsertRowsForDay(placeholderDayId, generated)
      const workout_exercises = fullRows.map((row) => {
        const { workout_day_id: _, ...rest } = row
        return rest
      })

      const rendered = fullRows.map((row, i) => {
        const ge = generated[i]
        const convention = formatWeightConvention(ge.exercise.equipment)
        return formatPrescriptionLine({
          exerciseName: ge.exercise.name,
          sets: row.sets,
          reps: row.reps,
          weightKg: Number(row.weight),
          restSeconds: row.rest_seconds,
          weightConvention: convention,
          targetDurationSeconds: row.target_duration_seconds ?? undefined,
        })
      })

      return {
        sort_order: dayIndex,
        label: day.label,
        emoji: dayEmojiForProgramDayIndex(dayIndex),
        workout_exercises,
        rendered,
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

    // Phase 5 — apply writes with compensating rollback on failure
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

      for (const [i, day] of parsedDays.entries()) {
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

        const generated = day.exercises.map((parsed) => geFromParsed(parsed, byId.get(parsed.exerciseId)!))
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
