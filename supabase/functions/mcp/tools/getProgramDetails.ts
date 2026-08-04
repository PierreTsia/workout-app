import { unwrapCatalogNameEmbed, type CatalogNameEmbed } from "../lib/bilingualName.ts"
import {
  daySequenceToEchoExercises,
  mergeDaySequence,
  type DbBlockForRead,
  type DbSoloForRead,
} from "../lib/daySequenceRead.ts"
import { formatProgramDetails } from "../lib/format.ts"
import { isUuid } from "../lib/uuid.ts"
import type { ToolDefinition } from "./registry.ts"

interface ProgramRow {
  id: string
  name: string
  archived_at: string | null
  workout_days: WorkoutDayRow[] | null
}

interface WorkoutDayRow {
  id: string
  label: string
  emoji: string
  sort_order: number
  workout_exercises: WorkoutExerciseRow[] | null
  exercise_blocks: ExerciseBlockRow[] | null
}

interface WorkoutExerciseRow {
  id: string
  exercise_id: string
  name_snapshot: string
  sets: number
  reps: string
  weight: string
  rest_seconds: number
  target_duration_seconds: number | null
  sort_order: number
  exercises: CatalogNameEmbed | CatalogNameEmbed[] | null
}

interface BlockExerciseRow {
  exercise_id: string
  name_snapshot: string
  position: number
  per_round: { amount: number; weight: number }[]
  exercises: CatalogNameEmbed | CatalogNameEmbed[] | null
}

interface ExerciseBlockRow {
  id: string
  label: string | null
  rounds: number
  rest_seconds: number
  transition_seconds: number
  sort_order: number
  block_exercises: BlockExerciseRow[] | null
}

const PROGRAM_DETAILS_SELECT =
  "id, name, archived_at, workout_days(id, label, emoji, sort_order, " +
  "workout_exercises(id, exercise_id, name_snapshot, sets, reps, weight, rest_seconds, target_duration_seconds, sort_order, exercises(name, name_en)), " +
  "exercise_blocks(id, label, rounds, rest_seconds, transition_seconds, sort_order, " +
  "block_exercises(exercise_id, name_snapshot, position, per_round, exercises(name, name_en))))"

export const getProgramDetails: ToolDefinition = {
  name: "get_program_details",
  annotations: {
    title: "Get program details",
    readOnlyHint: true,
    idempotentHint: true,
  },
  description:
    "Get the full structure of a training program by ID — days, exercises, Circuits, sets, reps, weights, rest. " +
    "Works regardless of cycle state. Use after list_programs, or with the program_id surfaced by " +
    "get_upcoming_workouts / get_workout_history. Returns markdown with inline IDs plus a fenced JSON " +
    "block (`days` patch shape) for echo into `update_program` (prefer the JSON over markdown alone).",
  inputSchema: {
    type: "object",
    required: ["program_id"],
    properties: {
      program_id: {
        type: "string",
        description: "UUID of the program to fetch (obtained from list_programs or any tool that surfaces program ids).",
      },
    },
  },

  async handler(args, supabase) {
    if (!supabase) {
      return {
        content: [{ type: "text", text: "Authentication required — please provide a valid Bearer token." }],
        isError: true,
      }
    }

    const programId = String(args.program_id ?? "")

    if (!isUuid(programId)) {
      return {
        content: [{ type: "text", text: "Invalid program_id format (expected UUID)." }],
        isError: true,
      }
    }

    const { data, error } = await supabase
      .from("programs")
      .select(PROGRAM_DETAILS_SELECT)
      .eq("id", programId)
      .maybeSingle()

    if (error) {
      return {
        content: [{ type: "text", text: `Error fetching program: ${error.message}` }],
        isError: true,
      }
    }

    if (!data) {
      return {
        content: [{ type: "text", text: "Program not found or you don't have access." }],
        isError: true,
      }
    }

    const program = data as unknown as ProgramRow
    const days = (program.workout_days ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)

    const sequenceByDay = new Map(
      days.map((day) => {
        const solos: DbSoloForRead[] = (day.workout_exercises ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((ex) => {
            const catalog = unwrapCatalogNameEmbed(ex.exercises)
            return {
              id: ex.id,
              exercise_id: ex.exercise_id,
              name_snapshot: ex.name_snapshot,
              name: catalog?.name ?? null,
              name_en: catalog?.name_en ?? null,
              sets: ex.sets,
              reps: ex.reps,
              weight: ex.weight,
              rest_seconds: ex.rest_seconds,
              target_duration_seconds: ex.target_duration_seconds,
              sort_order: ex.sort_order,
            }
          })

        const blocks: DbBlockForRead[] = (day.exercise_blocks ?? []).map((block) => ({
          id: block.id,
          label: block.label,
          rounds: block.rounds,
          rest_seconds: block.rest_seconds,
          transition_seconds: block.transition_seconds,
          sort_order: block.sort_order,
          block_exercises: (block.block_exercises ?? []).map((be) => {
            const catalog = unwrapCatalogNameEmbed(be.exercises)
            return {
              exercise_id: be.exercise_id,
              name_snapshot: be.name_snapshot,
              position: be.position,
              per_round: be.per_round,
              exercises: catalog
                ? { name: catalog.name, name_en: catalog.name_en }
                : null,
            }
          }),
        }))

        return [day.id, mergeDaySequence(solos, blocks)] as const
      }),
    )

    const exercisesByDay = new Map(
      [...sequenceByDay.entries()].map(([dayId, items]) => [
        dayId,
        items
          .filter((i) => i.kind === "solo")
          .map((i) => ({
            id: i.solo.id ?? i.solo.exercise_id,
            exercise_id: i.solo.exercise_id,
            name_snapshot: i.solo.name_snapshot,
            name: i.solo.name,
            name_en: i.solo.name_en,
            sets: i.solo.sets,
            reps: i.solo.reps,
            weight: i.solo.weight,
            rest_seconds: i.solo.rest_seconds,
            target_duration_seconds: i.solo.target_duration_seconds,
          })),
      ]),
    )

    const echoDays = days.map((day) => ({
      id: day.id,
      label: day.label,
      emoji: day.emoji,
      exercises: daySequenceToEchoExercises(sequenceByDay.get(day.id) ?? []),
    }))

    const text = formatProgramDetails(
      { id: program.id, name: program.name, archived_at: program.archived_at },
      days.map(({ id, label, emoji, sort_order }) => ({ id, label, emoji, sort_order })),
      exercisesByDay,
      { sequenceByDay, echoDays },
    )

    return {
      content: [{ type: "text", text }],
    }
  },
}
