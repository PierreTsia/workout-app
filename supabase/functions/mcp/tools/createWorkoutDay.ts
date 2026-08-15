import type { ToolDefinition } from "./registry.ts"
import { validateDayExercises } from "../lib/createProgramValidation.ts"
import { fetchBenchmarkCircuits, fetchExercisesByIds } from "../lib/catalogLookup.ts"
import { collectCandidateExerciseIds } from "../lib/exerciseConversion.ts"
import { collectReferencedBenchmarkExerciseIds } from "../lib/resolveBenchmark.ts"
import { parsedCircuitToWire } from "../lib/daySequenceRead.ts"
import { buildDayRenderedLines, insertDaySequence } from "../lib/daySequence.ts"
import { MCP_CIRCUIT_DAY_ITEM_SCHEMA } from "../lib/circuitItemSchema.ts"

const TOOL_DESCRIPTION = `Create a single ad-hoc workout day in the user's GymLogic account (Quick Workout flow).

Use this when the user wants ONE workout (today, tomorrow, an extra session) without changing their active multi-day program. Unlike \`create_program\`, this tool does NOT deactivate any existing program — the new day is stored as a standalone \`workout_days\` row with \`program_id: null\`.

\`exercises[]\` accepts bare UUIDs, solo prescription objects, or Circuits (\`type: "circuit"\`) — same shape as \`create_program\` (ADR 0011 + 0014 + 0015). A Circuit counts as one item toward the 20-item cap. Omit \`mode\` for Tours; \`mode: "amrap"\` + \`cap_minutes\` for AMRAP. Named WODs: \`benchmark_slug: "cindy"\` (or label Cindy / Holland) — catalog Rx wins; unknown slug is an error.

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
          "Ordered day items: bare UUID, solo prescription, or Circuit (type:\"circuit\"). Mirrors create_program. Circuit = 1 slot toward maxItems.",
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
            MCP_CIRCUIT_DAY_ITEM_SCHEMA,
          ],
        },
      },
      dry_run: { type: "boolean" },
    },
    required: ["label", "exercises"],
  },
  async handler(args, supabase) {
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

    const { data: benchmarks, error: benchErr } = await fetchBenchmarkCircuits(supabase)
    if (benchErr) {
      return { content: [{ type: "text", text: benchErr }], isError: true }
    }

    const candidateIds = [
      ...new Set([
        ...collectCandidateExerciseIds(rawExercises),
        ...collectReferencedBenchmarkExerciseIds(rawExercises, benchmarks),
      ]),
    ]
    const { data: catalog, error: fetchErr } = await fetchExercisesByIds(supabase, candidateIds)
    if (fetchErr) {
      return { content: [{ type: "text", text: fetchErr }], isError: true }
    }
    const byId = new Map(catalog.map((e) => [e.id, e] as const))

    const validation = validateDayExercises(rawExercises, label, byId, benchmarks)
    if (!validation.ok) {
      return {
        content: [{ type: "text", text: `Invalid input: ${validation.error}` }],
        isError: true,
      }
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) {
      return {
        content: [{ type: "text", text: "Could not identify the authenticated user." }],
        isError: true,
      }
    }
    const userId = userData.user.id

    // Preview-first by default: dry_run defaults to true, mirroring
    // `create_program`. Callers that intend to write must pass `dry_run: false`
    // explicitly. The Edge `commit-quick-workout` function is the in-app
    // caller (T128) and will set this flag on every commit.
    const dryRun = (args.dry_run as boolean | undefined) !== false

    if (dryRun) {
      const rendered = buildDayRenderedLines(validation.parsed, byId)
      const exercises = validation.parsed.map((item) =>
        item.kind === "circuit" ? parsedCircuitToWire(item) : item.kind === "bare" ? item.exerciseId : {
          exercise_id: item.exerciseId,
          sets: item.sets,
          reps: item.reps,
          weight_kg: item.weightKg,
          rest_seconds: item.restSeconds,
        },
      )

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
                  rendered,
                  exercises,
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
    const { error: seqErr } = await insertDaySequence(
      supabase,
      workoutDayId,
      validation.parsed,
      byId,
    )
    if (seqErr) {
      await supabase.from("workout_exercises").delete().eq("workout_day_id", workoutDayId)
      await supabase.from("exercise_blocks").delete().eq("workout_day_id", workoutDayId)
      await supabase.from("workout_days").delete().eq("id", workoutDayId)
      return {
        content: [
          { type: "text", text: `Failed to insert day sequence: ${seqErr}` },
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
            exercises_count: validation.parsed.length,
          }),
        },
      ],
    }
  },
}
