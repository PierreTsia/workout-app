/**
 * MCP `update_program` tool — in-place program editing (Epic C, #280).
 *
 * Wires the four pure modules from T77-T80 into a single handler:
 *
 *   parsePatchShape (T79)         → top-level shape, defaults, is_active rejection
 *   ↓
 *   fetch current program (RLS)   → CurrentProgramSnapshot
 *   ↓
 *   validateDayIdentities (T79)   → no dup ids, every id ∈ current
 *   ↓
 *   fetchExercisesByIds (T77)     → catalog (union of patch + unchanged ids)
 *   ↓
 *   validateDayExercises (T77)    → per-day parse + cross-field
 *   ↓
 *   computeProgramDiff (T78)      → structural diff + apply_order
 *   ↓
 *   session-count on days_to_delete → informational (ON DELETE SET NULL)
 *   ↓
 *   active-cycle check            → optional warning string
 *   ↓
 *   ┌─ dry_run=true  → render + structured preview
 *   └─ dry_run=false → requireConfirmForDestructive + applyProgramDiff (T80)
 */

import type { ToolDefinition } from "./registry.ts"
import { collectCandidateExerciseIds } from "../lib/exerciseConversion.ts"
import { fetchBenchmarkCircuits, fetchExercisesByIds } from "../lib/catalogLookup.ts"
import { collectReferencedBenchmarkExerciseIds } from "../lib/resolveBenchmark.ts"
import { validateDayExercises } from "../lib/createProgramValidation.ts"
import { MCP_CIRCUIT_DAY_ITEM_SCHEMA } from "../lib/circuitItemSchema.ts"
import {
  parsePatchShape,
  requireConfirmForDestructive,
  validateDayIdentities,
} from "../lib/updateProgramValidation.ts"
import { computeProgramDiff } from "../lib/updateProgramDiff.ts"
import { applyProgramDiff } from "../lib/updateProgramApply.ts"
import {
  formatActiveCycleWarning,
  formatProgramAfterUpdate,
} from "../lib/format.ts"
import type {
  CurrentProgramSnapshot,
  CurrentProgramSnapshotDay,
  CurrentProgramSnapshotExercise,
  ParsedPatchDay,
} from "../lib/updateProgramTypes.ts"

type ErrorReply = { content: [{ type: "text"; text: string }]; isError: true }
type SuccessReply = { content: [{ type: "text"; text: string }]; isError?: false }
type ToolReply = ErrorReply | SuccessReply

function err(text: string): ErrorReply {
  return { content: [{ type: "text", text }], isError: true }
}

function ok(text: string, isError = false): ToolReply {
  return isError
    ? { content: [{ type: "text", text }], isError: true }
    : { content: [{ type: "text", text }] }
}

function jsonReply(payload: unknown, isError = false): ToolReply {
  return ok(JSON.stringify(payload, null, 2), isError)
}

interface RawProgramRow {
  id: string
  name: string
  workout_days: RawWorkoutDayRow[] | null
}

interface RawWorkoutDayRow {
  id: string
  label: string
  emoji: string | null
  sort_order: number
  workout_exercises: RawWorkoutExerciseRow[] | null
}

interface RawWorkoutExerciseRow {
  exercise_id: string
  name_snapshot: string
  sets: number
  reps: string
  weight: string
  rest_seconds: number
  target_duration_seconds: number | null
  sort_order: number
}

function buildSnapshot(row: RawProgramRow): CurrentProgramSnapshot {
  const days: CurrentProgramSnapshotDay[] = (row.workout_days ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((d) => {
      const exercises: CurrentProgramSnapshotExercise[] = (d.workout_exercises ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((ex) => ({
          exercise_id: ex.exercise_id,
          name_snapshot: ex.name_snapshot,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
          rest_seconds: ex.rest_seconds,
          target_duration_seconds: ex.target_duration_seconds,
          sort_order: ex.sort_order,
        }))
      return {
        id: d.id,
        label: d.label,
        emoji: d.emoji ?? "🏋️",
        sort_order: d.sort_order,
        workout_exercises: exercises,
      }
    })
  return { id: row.id, name: row.name, days }
}

const PROGRAM_SELECT =
  "id, name, workout_days(id, label, emoji, sort_order, workout_exercises(exercise_id, name_snapshot, sets, reps, weight, rest_seconds, target_duration_seconds, sort_order))"

const TOOL_DESCRIPTION = `Edit an existing program in place — rename it, add/remove/reorder days, swap exercises/Circuits, or revise prescriptions — without breaking session history (logged set_logs are preserved via wipe-and-reinsert of the Unified Day Sequence: solos + Circuits).

Patch shape:
  - Top level: PATCH semantics. Omit a field → leave it unchanged. Pass \`name\` → rename. Pass \`days\` → declarative PUT inside that field (see below).
  - Inside \`days\`: declarative. Each entry with an \`id\` matching an existing day = UPDATE; without \`id\` = INSERT; existing days NOT in the array = DELETE.

Each item in a day's \`exercises\` array can be EITHER:
  - A bare UUID string — applies legacy defaults (3 sets, 10 reps, 0 kg, 90s rest).
  - A full prescription object — required fields {exercise_id, sets, reps, weight_kg, rest_seconds}; \`target_duration_seconds\` for duration exercises (T75).
  - A Circuit object — \`{ type: "circuit", ... }\` same shape as \`create_program\` (ADR 0011 + 0014 + 0015: optional \`mode\` / \`cap_minutes\` for AMRAP; \`benchmark_slug\` / \`benchmark_id\` instantiate a catalog Circuit). A patched day's \`exercises[]\` fully replaces that day's solos AND Circuits.

Atomicity: per-day, no cross-day rollback. If a mid-flight INSERT fails, prior days are already persisted; the response includes \`applied_days\`, \`failed_at\`, and \`remaining_days\` plus retry guidance.

Always call with \`dry_run: true\` first (the default) — review the top-level \`rendered\` markdown plus the \`removed_days\`/\`added_days\`/\`warnings\` arrays. Re-call with \`dry_run: false\` to apply.

Destructive guard: removing ≥1 day requires \`confirm: true\` along with \`dry_run: false\`. Logged sessions do not block deletion — \`sessions.workout_day_id\` is \`ON DELETE SET NULL\`, so history stays (label snapshot + set_logs).

Mid-cycle awareness: when an active cycle exists for the program, the response surfaces a French warning ("Cycle actif depuis ..."). Edits still proceed when confirmed.

For activating/deactivating a program (\`is_active\`), use the dedicated \`set_active_program\` tool (coming soon) — \`update_program\` rejects \`is_active\` in the patch.`

export const updateProgram: ToolDefinition = {
  name: "update_program",
  annotations: {
    title: "Update existing program (preserves history)",
    destructiveHint: true,
    idempotentHint: true,
  },
  description: TOOL_DESCRIPTION,
  inputSchema: {
    type: "object",
    properties: {
      program_id: {
        type: "string",
        description: "UUID of the program to update. Obtain from list_programs or get_program_details.",
      },
      name: {
        type: "string",
        description: "Optional. New program name. Omit to leave the name unchanged.",
      },
      days: {
        type: "array",
        description:
          "Optional. Full desired list of days (declarative PUT inside this field). Days with `id` matching an existing day = UPDATE; days without `id` = INSERT; existing days NOT in this array = DELETE (requires `confirm: true`). Logged sessions are detached (SET NULL), not deleted. Omit the field entirely to leave days unchanged.",
        minItems: 1,
        maxItems: 14,
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "UUID of an existing day to UPDATE. Omit to INSERT a new day.",
            },
            label: { type: "string", description: "Day label shown in the app." },
            emoji: { type: "string", description: "Optional emoji for the day." },
            exercises: {
              type: "array",
              minItems: 1,
              maxItems: 40,
              items: {
                oneOf: [
                  {
                    type: "string",
                    description: "Bare UUID — defaults applied (3 sets, 10 reps, 0 kg, 90s rest).",
                  },
                  {
                    type: "object",
                    description: "Full prescription. Required fields documented in `create_program`.",
                    properties: {
                      exercise_id: { type: "string" },
                      sets: { type: "integer", minimum: 1, maximum: 10 },
                      reps: { type: "string", pattern: "^\\d+(-\\d+)?$" },
                      weight_kg: { type: "number", minimum: 0, maximum: 500 },
                      rest_seconds: { type: "integer", minimum: 0, maximum: 600 },
                      target_duration_seconds: {
                        type: "integer",
                        minimum: 5,
                        maximum: 600,
                      },
                    },
                    required: ["exercise_id", "sets", "reps", "weight_kg", "rest_seconds"],
                  },
                  MCP_CIRCUIT_DAY_ITEM_SCHEMA,
                ],
              },
            },
          },
          required: ["label", "exercises"],
        },
      },
      dry_run: {
        type: "boolean",
        description: "Default true. Set false to apply.",
      },
      confirm: {
        type: "boolean",
        description: "Default false. REQUIRED when the patch removes ≥1 day.",
      },
    },
    required: ["program_id"],
  },

  async handler(args, supabase) {
    if (!supabase) {
      return err("Authentication required — please provide a valid Bearer token.")
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) {
      return err("Could not identify the authenticated user.")
    }
    const userId = userData.user.id

    const parseResult = parsePatchShape(args)
    if (!parseResult.ok) {
      return err(parseResult.error)
    }
    const parsedPatch = parseResult.value

    const { data: programRow, error: programErr } = await supabase
      .from("programs")
      .select(PROGRAM_SELECT)
      .eq("id", parsedPatch.program_id)
      .maybeSingle()
    if (programErr) {
      return err(`Error fetching program: ${programErr.message}`)
    }
    if (!programRow) {
      return err("Program not found or you don't have access.")
    }
    const currentProgram = buildSnapshot(programRow as unknown as RawProgramRow)

    const currentDayIds = new Set(currentProgram.days.map((d) => d.id))
    const idsResult = validateDayIdentities(parsedPatch.days ?? [], currentDayIds)
    if (!idsResult.ok) {
      return err(idsResult.error)
    }

    // Catalog fetch covers BOTH the patch's referenced ids AND the unchanged days'
    // persisted exercise_ids — the dry_run renderer needs the equipment field for
    // every line it'll emit (formatPrescriptionLine's weight convention).
    const rawDays =
      Array.isArray(args.days)
        ? (args.days as Array<Record<string, unknown>>)
        : []
    const { data: benchmarks, error: benchErr } = await fetchBenchmarkCircuits(supabase)
    if (benchErr) {
      return err(`Invalid input: ${benchErr}`)
    }

    const patchIds = rawDays.flatMap((d) =>
      Array.isArray(d.exercises)
        ? [
            ...collectCandidateExerciseIds(d.exercises),
            ...collectReferencedBenchmarkExerciseIds(d.exercises, benchmarks),
          ]
        : [],
    )
    const currentIds = currentProgram.days.flatMap((d) =>
      d.workout_exercises.map((ex) => ex.exercise_id),
    )
    const unionIds = [...new Set([...patchIds, ...currentIds])]
    const { data: catalogRows, error: catalogErr } = await fetchExercisesByIds(
      supabase,
      unionIds,
    )
    if (catalogErr) {
      return err(`Invalid input: ${catalogErr}`)
    }
    const catalogById = new Map(catalogRows.map((e) => [e.id, e] as const))

    if (parsedPatch.days) {
      const validateOne = (
        day: ParsedPatchDay,
        i: number,
      ): { ok: true; updated: ParsedPatchDay } | { ok: false; error: string } => {
        const rawExercises = Array.isArray(rawDays[i]?.exercises)
          ? (rawDays[i].exercises as unknown[])
          : []
        const result = validateDayExercises(rawExercises, day.label, catalogById, benchmarks)
        if (!result.ok) return result
        return { ok: true, updated: { ...day, parsed_exercises: result.parsed } }
      }

      const validated = parsedPatch.days.map((day, i) => validateOne(day, i))
      const failure = validated.find((r) => !r.ok)
      if (failure && !failure.ok) {
        return err(`Invalid input: ${failure.error}`)
      }
      parsedPatch.days = validated.map(
        (r) => (r as { ok: true; updated: ParsedPatchDay }).updated,
      )
    }

    const diff = computeProgramDiff(currentProgram, parsedPatch)

    // Count sessions per to-be-deleted day for `removed_days[].session_count`.
    // Deletion is not blocked: sessions.workout_day_id is ON DELETE SET NULL.
    if (diff.days_to_delete.length > 0) {
      const deleteIds = diff.days_to_delete.map((d) => d.id)
      const { data: sessionRows, error: sessErr } = await supabase
        .from("sessions")
        .select("workout_day_id")
        .in("workout_day_id", deleteIds)
      if (sessErr) {
        return err(`Error checking sessions for deleted days: ${sessErr.message}`)
      }
      const counts = (sessionRows ?? []).reduce<Map<string, number>>((acc, row) => {
        const id = (row as { workout_day_id: string }).workout_day_id
        acc.set(id, (acc.get(id) ?? 0) + 1)
        return acc
      }, new Map())
      diff.days_to_delete.forEach((d) => {
        d.session_count = counts.get(d.id) ?? 0
      })
    }

    const { data: cycleData } = await supabase
      .from("cycles")
      .select("started_at")
      .eq("program_id", parsedPatch.program_id)
      .is("finished_at", null)
      .maybeSingle()
    const activeCycleWarning =
      cycleData && typeof (cycleData as { started_at?: unknown }).started_at === "string"
        ? formatActiveCycleWarning({ started_at: (cycleData as { started_at: string }).started_at })
        : null

    const warnings = activeCycleWarning ? [activeCycleWarning] : []

    if (parsedPatch.dry_run) {
      const rendered = formatProgramAfterUpdate(diff, currentProgram, catalogById)
      const removed_days = diff.days_to_delete.map((d) => ({
        id: d.id,
        label: d.label,
        session_count: d.session_count,
        blocking: d.blocking,
      }))
      const added_days = diff.days_to_insert.map((d) => ({ label: d.label }))

      const payload = {
        dry_run: true,
        program_id: parsedPatch.program_id,
        rendered,
        removed_days,
        added_days,
        warnings,
        errors: [],
        message:
          "Dry run preview only — no writes performed. Re-call with `dry_run: false` to apply.",
      }

      return jsonReply(payload, false)
    }

    const confirmResult = requireConfirmForDestructive(diff, parsedPatch.confirm)
    if (!confirmResult.ok) {
      return err(confirmResult.error)
    }

    const applyResult = await applyProgramDiff(supabase, diff, catalogById, userId)
    const responsePayload = {
      dry_run: false,
      program_id: parsedPatch.program_id,
      applied_days: applyResult.applied_days,
      failed_at: applyResult.failed_at,
      remaining_days: applyResult.remaining_days,
      warnings,
      message: applyResult.message,
    }
    return jsonReply(responsePayload, applyResult.failed_at !== null)
  },
}
