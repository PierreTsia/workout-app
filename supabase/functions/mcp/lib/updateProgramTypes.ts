/**
 * Shared type contracts for the MCP `update_program` tool (Epic C, #280).
 *
 * Types-only module — zero runtime code, zero side effects. Imported by
 * `lib/updateProgramDiff.ts` (T78), `lib/updateProgramValidation.ts` (T79),
 * `lib/updateProgramApply.ts` (T80), and the handler `tools/updateProgram.ts`
 * (T81). Lives here (vs in any of those modules) so T78/T79 can be developed
 * in parallel against a single shared type contract.
 */

import type { ParsedExercise } from "./createProgramValidation.ts"

export interface CurrentProgramSnapshotExercise {
  exercise_id: string
  name_snapshot: string
  sets: number
  reps: string
  weight: string
  rest_seconds: number
  target_duration_seconds: number | null
  sort_order: number
}

export interface CurrentProgramSnapshotDay {
  id: string
  label: string
  emoji: string
  sort_order: number
  workout_exercises: CurrentProgramSnapshotExercise[]
}

export interface CurrentProgramSnapshot {
  id: string
  name: string
  days: CurrentProgramSnapshotDay[]
}

export interface ParsedPatchDay {
  /** Present → UPDATE existing day. Absent → INSERT new day. */
  id?: string
  label: string
  emoji?: string
  parsed_exercises: ParsedExercise[]
}

export interface ParsedPatch {
  program_id: string
  name?: string
  days?: ParsedPatchDay[]
  /** Resolved (default true). */
  dry_run: boolean
  /** Resolved (default false). Required when patch removes ≥1 day. */
  confirm: boolean
}

export interface DiffDayInsert {
  label: string
  emoji?: string
  sort_order: number
  parsed_exercises: ParsedExercise[]
}

export interface DiffDayUpdate {
  id: string
  current: { label: string; emoji: string; sort_order: number }
  label: string
  emoji: string
  sort_order: number
  parsed_exercises: ParsedExercise[]
}

export interface DiffDayDelete {
  id: string
  label: string
  /** Populated post-FK-precheck (initially 0 from `computeProgramDiff`). */
  session_count: number
  /** Populated post-FK-precheck (initially false). True iff session_count > 0. */
  blocking: boolean
}

export interface DiffDayUnchanged {
  id: string
  label: string
}

export interface ProgramDiff {
  program_id: string
  name_change: { from: string; to: string } | null
  days_to_insert: DiffDayInsert[]
  days_to_update: DiffDayUpdate[]
  days_to_delete: DiffDayDelete[]
  days_unchanged: DiffDayUnchanged[]
  /**
   * `"insert_first"` is set by `computeProgramDiff` ONLY when the patch would
   * transit through a 0-days state (current.days.length - days_to_delete.length
   * === 0 AND days_to_insert.length > 0). Otherwise `"default"`.
   */
  apply_order: "default" | "insert_first"
}
