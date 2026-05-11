import type { ToolDefinition } from "./registry.ts"
import { buildWorkoutExerciseInsertRowsForDay } from "../lib/programPersistence.ts"
import { formatPrescriptionLine, formatWeightConvention } from "../lib/format.ts"
import { validateDayExercises } from "../lib/createProgramValidation.ts"
import { fetchExercisesByIds } from "../lib/catalogLookup.ts"
import {
  buildGeneratedExercise,
  collectCandidateExerciseIds,
} from "../lib/exerciseConversion.ts"
import { decodeJwt } from "../../_shared/aiQuota.ts"

const TOOL_DESCRIPTION = `Create a single ad-hoc workout day in the user's GymLogic account (Quick Workout flow).

Use this when the user wants ONE workout (today, tomorrow, an extra session) without changing their active multi-day program. Unlike \`create_program\`, this tool does NOT deactivate any existing program — the new day is stored as a standalone \`workout_days\` row with \`program_id: null\`.

Pass \`dry_run: true\` to preview the rendered prescription without writing.`

const QUICK_WORKOUT_EMOJI = "⚡"

// Quick Workout is one ad-hoc session — narrower cap than `create_program`'s
// 40-per-day. The number is exposed in the inputSchema (`maxItems`) and in the
// runtime error message so agents always see the same value.
const MAX_EXERCISES_PER_QUICK_WORKOUT = 20

export const createWorkoutDay: ToolDefinition = {
  name: "create_workout_day",
  description: TOOL_DESCRIPTION,
  annotations: {
    title: "Create Workout Day",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
  inputSchema: {
    type: "object",
    properties: {
      label: { type: "string", minLength: 1, maxLength: 100 },
      exercises: {
        type: "array",
        minItems: 1,
        maxItems: MAX_EXERCISES_PER_QUICK_WORKOUT,
        description:
          "Ordered exercises for this ad-hoc day. Each item is a UUID string (legacy defaults) OR an object with required prescription fields. Mirrors `create_program`'s per-day exercises shape.",
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
                  description:
                    "UUID from `resolve_exercises` (preferred for batch building) or `search_exercises`.",
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
                  description:
                    "\"N\" (linear, e.g. \"8\") or \"N-M\" (double progression, e.g. \"8-12\"). Bounds: 1-50 for reps exercises; use \"0\" ONLY for duration exercises (paired with target_duration_seconds).",
                },
                weight_kg: {
                  type: "number",
                  minimum: 0,
                  maximum: 500,
                  description:
                    "Working weight per set. Per hand for dumbbells/kettlebells, total for barbells/machines (see `weight_convention` returned by `resolve_exercises`).",
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
                  description:
                    "Target duration in seconds for time-based exercises (planks, holds). Cross-field rules T75.",
                },
              },
              required: ["exercise_id", "sets", "reps", "weight_kg", "rest_seconds"],
            },
          ],
        },
      },
      dry_run: { type: "boolean" },
    },
    required: ["label", "exercises"],
  },
  async handler(args, supabase, accessToken) {
    if (!supabase) {
      return {
        content: [{ type: "text", text: "Authentication required — please provide a valid Bearer token." }],
        isError: true,
      }
    }

    const label = typeof args.label === "string" ? args.label.trim() : ""
    if (!label) {
      return {
        content: [{ type: "text", text: "Invalid input: `label` must be a non-empty string." }],
        isError: true,
      }
    }

    const rawExercises = args.exercises
    if (!Array.isArray(rawExercises) || rawExercises.length === 0) {
      return {
        content: [{ type: "text", text: "Invalid input: `exercises` must be a non-empty array." }],
        isError: true,
      }
    }
    if (rawExercises.length > MAX_EXERCISES_PER_QUICK_WORKOUT) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid input: at most ${MAX_EXERCISES_PER_QUICK_WORKOUT} exercises per Quick Workout (got ${rawExercises.length}).`,
          },
        ],
        isError: true,
      }
    }

    const candidateIds = [...new Set(collectCandidateExerciseIds(rawExercises))]
    const { data: catalog, error: fetchErr } = await fetchExercisesByIds(supabase, candidateIds)
    if (fetchErr) {
      return { content: [{ type: "text", text: fetchErr }], isError: true }
    }
    const byId = new Map(catalog.map((e) => [e.id, e] as const))

    const validation = validateDayExercises(rawExercises, label, byId)
    if (!validation.ok) {
      return {
        content: [{ type: "text", text: `Invalid input: ${validation.error}` }],
        isError: true,
      }
    }

    const generated = validation.parsed.map((p) =>
      buildGeneratedExercise(p, byId.get(p.exerciseId)!),
    )

    // GoTrue can't verify the asymmetric (ES256) JWTs the local Supabase
    // CLI mints, so `supabase.auth.getUser()` is unreliable in e2e. We decode
    // the bearer locally (trust the `sub` claim) and rely on PostgREST + RLS
    // to enforce the real auth boundary on the workout_days INSERT below:
    // if the JWT signature is bad, the insert 401s. This is the same pattern
    // `commit-quick-workout`'s edge handler already uses.
    const jwt = accessToken ? decodeJwt(accessToken) : null
    if (!jwt?.sub) {
      return {
        content: [{ type: "text", text: "Could not identify the authenticated user." }],
        isError: true,
      }
    }
    const userId = jwt.sub

    // Preview-first by default: dry_run defaults to true, mirroring
    // `create_program`. Callers that intend to write must pass `dry_run: false`
    // explicitly. The Edge `commit-quick-workout` function is the in-app
    // caller (T128) and will set this flag on every commit.
    const dryRun = (args.dry_run as boolean | undefined) !== false

    if (dryRun) {
      const placeholderDayId = "00000000-0000-4000-8000-000000000000"
      const fullRows = buildWorkoutExerciseInsertRowsForDay(placeholderDayId, generated)
      const workout_exercises = fullRows.map(({ workout_day_id: _omit, ...rest }) => rest)
      const rendered = fullRows.map((row, i) => {
        const ge = generated[i]
        return formatPrescriptionLine({
          exerciseName: ge.exercise.name,
          sets: row.sets,
          reps: row.reps,
          weightKg: Number(row.weight),
          restSeconds: row.rest_seconds,
          weightConvention: formatWeightConvention(ge.exercise.equipment),
          targetDurationSeconds: row.target_duration_seconds ?? undefined,
        })
      })

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                dry_run: true,
                workout_day: {
                  label,
                  emoji: QUICK_WORKOUT_EMOJI,
                  sort_order: 0,
                  program_id: null,
                  workout_exercises,
                  rendered,
                },
                note:
                  "workout_day_id omitted; server assigns the UUID on insert. Re-call with dry_run: false to persist.",
              },
              null,
              2,
            ),
          },
        ],
      }
    }

    const { data: dayInsert, error: dayErr } = await supabase
      .from("workout_days")
      .insert({
        program_id: null,
        user_id: userId,
        label,
        emoji: QUICK_WORKOUT_EMOJI,
        sort_order: 0,
        saved_at: null,
      })
      .select("id")
      .single()

    if (dayErr || !dayInsert) {
      return {
        content: [{ type: "text", text: `Failed to insert workout day: ${dayErr?.message ?? "unknown error"}` }],
        isError: true,
      }
    }

    const workoutDayId = (dayInsert as { id: string }).id
    const exerciseRows = buildWorkoutExerciseInsertRowsForDay(workoutDayId, generated)

    const { error: exErr } = await supabase.from("workout_exercises").insert(exerciseRows)
    if (exErr) {
      // Compensating delete: without this the user keeps an empty "Quick
      // Workout" day cluttering their UI for every transient
      // `workout_exercises` insert failure. We mirror `create_program`'s
      // rollback shape (delete dependent rows first, then the parent),
      // ignoring the cleanup outcome — we still surface the original
      // exercise-insert error to the agent. See PR #347 review.
      await supabase.from("workout_exercises").delete().eq("workout_day_id", workoutDayId)
      await supabase.from("workout_days").delete().eq("id", workoutDayId)
      return {
        content: [
          { type: "text", text: `Failed to insert workout exercises: ${exErr.message}` },
        ],
        isError: true,
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            workout_day_id: workoutDayId,
            exercises_count: exerciseRows.length,
          }),
        },
      ],
    }
  },
}
