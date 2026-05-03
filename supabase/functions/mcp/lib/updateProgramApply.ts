/**
 * Per-day apply orchestrator for `update_program` (T80, Epic C #280).
 *
 * Walks a `ProgramDiff` and mutates supabase one day at a time. No cross-day
 * rollback — on failure, returns a partial-success report enumerating what
 * landed (`applied_days`), what blew up (`failed_at`), and what remains
 * (`remaining_days`), plus an explicit retry-guidance message so the agent
 * can resume cleanly.
 *
 * Apply order honours `diff.apply_order`:
 *   - "default":      [...deletes, ...updates, ...inserts]
 *   - "insert_first": [...inserts, ...deletes, ...updates]   (drain-to-0 escape hatch)
 *
 * Every UPDATE-day flow ALWAYS replaces its exercises (idempotent
 * wipe-and-reinsert via `applyDayUpdate`); meta is updated only when the
 * label/emoji/sort_order actually changed. Every INSERT-day flow inserts
 * `workout_days` first, captures the returned id, then bulk-inserts the
 * exercise rows directly (no DELETE needed for a fresh day).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.103.3"
import { applyDayUpdate, parsedExerciseToGeneratedForApply } from "./applyDayUpdate.ts"
import {
  buildWorkoutExerciseInsertRowsForDay,
  type CatalogExerciseForProgram,
} from "./programPersistence.ts"
import type {
  DiffDayDelete,
  DiffDayInsert,
  DiffDayUpdate,
  ProgramDiff,
} from "./updateProgramTypes.ts"

export type AppliedDayOp = "meta_changed" | "exercises_replaced" | "inserted" | "deleted"

export interface AppliedDay {
  /** `workout_days.id` — for an INSERT op, this is the freshly-returned id. */
  id: string
  label: string
  ops: AppliedDayOp[]
}

export type RemainingDayIntent = "delete" | "update" | "insert"

export interface RemainingDay {
  label: string
  intent: RemainingDayIntent
}

export interface ApplyResult {
  applied_days: AppliedDay[]
  failed_at: { day_label: string; error: string } | null
  remaining_days: RemainingDay[]
  message: string
}

const PROGRAM_RENAME_LABEL = "<program rename>"

const RETRY_GUIDANCE =
  "To retry, submit a new patch containing only the remaining_days (with their `id`s) plus any corrections; applied_days are already up to date and should be omitted from `days[]` (or included with their existing `id` to be left unchanged)."

type PlanOp =
  | { intent: "delete"; entry: DiffDayDelete }
  | { intent: "update"; entry: DiffDayUpdate }
  | { intent: "insert"; entry: DiffDayInsert }

function planOpLabel(op: PlanOp): string {
  return op.intent === "insert" ? op.entry.label : op.entry.label
}

function buildApplyPlan(diff: ProgramDiff): PlanOp[] {
  const deletes: PlanOp[] = diff.days_to_delete.map((entry) => ({ intent: "delete", entry }))
  const updates: PlanOp[] = diff.days_to_update.map((entry) => ({ intent: "update", entry }))
  const inserts: PlanOp[] = diff.days_to_insert.map((entry) => ({ intent: "insert", entry }))

  return diff.apply_order === "insert_first"
    ? [...inserts, ...deletes, ...updates]
    : [...deletes, ...updates, ...inserts]
}

function buildSuccessMessage(appliedCount: number): string {
  return `Updated ${appliedCount} day(s).`
}

function buildPartialMessage(
  appliedCount: number,
  failedLabel: string,
  failureError: string,
  remainingCount: number,
): string {
  return [
    `Updated ${appliedCount} day(s).`,
    `Failed at day '${failedLabel}': ${failureError}.`,
    `${remainingCount} day(s) remaining.`,
    RETRY_GUIDANCE,
  ].join(" ")
}

interface OpSuccess {
  ok: true
  applied: AppliedDay
}

interface OpFailure {
  ok: false
  error: string
}

type OpResult = OpSuccess | OpFailure

async function executeDelete(
  supabase: SupabaseClient,
  entry: DiffDayDelete,
): Promise<OpResult> {
  // Defensive DELETE on workout_exercises even though `workout_days` ON DELETE
  // CASCADE would handle it — keeps the call sequence explicit and makes any
  // FK regression surface immediately at this layer instead of cascading.
  const { error: exErr } = await supabase
    .from("workout_exercises")
    .delete()
    .eq("workout_day_id", entry.id)
  if (exErr) return { ok: false, error: exErr.message }

  const { error: dayErr } = await supabase
    .from("workout_days")
    .delete()
    .eq("id", entry.id)
  if (dayErr) return { ok: false, error: dayErr.message }

  return { ok: true, applied: { id: entry.id, label: entry.label, ops: ["deleted"] } }
}

async function executeUpdate(
  supabase: SupabaseClient,
  entry: DiffDayUpdate,
  catalogById: Map<string, CatalogExerciseForProgram>,
  userId: string,
): Promise<OpResult> {
  const ops: AppliedDayOp[] = []

  const metaChanged =
    entry.label !== entry.current.label ||
    entry.emoji !== entry.current.emoji ||
    entry.sort_order !== entry.current.sort_order

  if (metaChanged) {
    const { error } = await supabase
      .from("workout_days")
      .update({ label: entry.label, emoji: entry.emoji, sort_order: entry.sort_order })
      .eq("id", entry.id)
    if (error) return { ok: false, error: error.message }
    ops.push("meta_changed")
  }

  const dayResult = await applyDayUpdate(
    supabase,
    entry.id,
    entry.parsed_exercises,
    catalogById,
    userId,
  )
  if (!dayResult.ok) return { ok: false, error: dayResult.error }

  ops.push("exercises_replaced")
  return { ok: true, applied: { id: entry.id, label: entry.label, ops } }
}

async function executeInsert(
  supabase: SupabaseClient,
  entry: DiffDayInsert,
  programId: string,
  catalogById: Map<string, CatalogExerciseForProgram>,
  userId: string,
): Promise<OpResult> {
  // Pre-flight catalog presence check: never INSERT a workout_day we cannot
  // then back-fill with exercises. Mirrors the safety pattern in applyDayUpdate.
  const missing = entry.parsed_exercises.find((p) => !catalogById.has(p.exerciseId))
  if (missing) {
    return { ok: false, error: `Catalog miss for exercise_id ${missing.exerciseId}` }
  }

  const { data, error } = await supabase
    .from("workout_days")
    .insert({
      program_id: programId,
      user_id: userId,
      label: entry.label,
      emoji: entry.emoji ?? "🏋️",
      sort_order: entry.sort_order,
    })
    .select("id")
    .single()

  if (error) return { ok: false, error: error.message }
  const newId = (data as { id?: string } | null)?.id
  if (!newId) {
    return { ok: false, error: "workout_days insert returned no id" }
  }

  const generated = entry.parsed_exercises.map((p) =>
    parsedExerciseToGeneratedForApply(p, catalogById),
  )
  const rows = buildWorkoutExerciseInsertRowsForDay(newId, generated)

  const { error: insertErr } = await supabase.from("workout_exercises").insert(rows)
  if (insertErr) return { ok: false, error: insertErr.message }

  return { ok: true, applied: { id: newId, label: entry.label, ops: ["inserted"] } }
}

async function executeOp(
  op: PlanOp,
  supabase: SupabaseClient,
  programId: string,
  catalogById: Map<string, CatalogExerciseForProgram>,
  userId: string,
): Promise<OpResult> {
  if (op.intent === "delete") return executeDelete(supabase, op.entry)
  if (op.intent === "update") return executeUpdate(supabase, op.entry, catalogById, userId)
  return executeInsert(supabase, op.entry, programId, catalogById, userId)
}

/**
 * Apply a `ProgramDiff` to the database. Returns the apply result with
 * partial-success tracking; never throws.
 */
export async function applyProgramDiff(
  supabase: SupabaseClient,
  diff: ProgramDiff,
  catalogById: Map<string, CatalogExerciseForProgram>,
  userId: string,
): Promise<ApplyResult> {
  const plan = buildApplyPlan(diff)

  // Step 0 — program rename. Failure here aborts BEFORE touching any day.
  if (diff.name_change) {
    const { error } = await supabase
      .from("programs")
      .update({ name: diff.name_change.to })
      .eq("id", diff.program_id)

    if (error) {
      const remaining = plan.map<RemainingDay>((op) => ({
        label: planOpLabel(op),
        intent: op.intent,
      }))
      return {
        applied_days: [],
        failed_at: { day_label: PROGRAM_RENAME_LABEL, error: error.message },
        remaining_days: remaining,
        message: buildPartialMessage(0, PROGRAM_RENAME_LABEL, error.message, remaining.length),
      }
    }
  }

  // Step 1+2 — per-day loop. Stops at first failure, reports partial success.
  const applied: AppliedDay[] = []
  for (let i = 0; i < plan.length; i += 1) {
    const op = plan[i]
    const result = await executeOp(op, supabase, diff.program_id, catalogById, userId)
    if (!result.ok) {
      const remaining = plan.slice(i + 1).map<RemainingDay>((rest) => ({
        label: planOpLabel(rest),
        intent: rest.intent,
      }))
      return {
        applied_days: applied,
        failed_at: { day_label: planOpLabel(op), error: result.error },
        remaining_days: remaining,
        message: buildPartialMessage(applied.length, planOpLabel(op), result.error, remaining.length),
      }
    }
    applied.push(result.applied)
  }

  return {
    applied_days: applied,
    failed_at: null,
    remaining_days: [],
    message: buildSuccessMessage(applied.length),
  }
}
