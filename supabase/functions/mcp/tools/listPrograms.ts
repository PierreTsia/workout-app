import type { ToolDefinition } from "./registry.ts"
import { formatProgramListEntry } from "../lib/format.ts"

/**
 * Spike outcome (T70 — see docs/Tech_Plan_—_MCP_—_Read_Programs_#276.md):
 *
 * Without `!inner`, `.is("cycles.finished_at", null)` filters the *embed*
 * (the nested `cycles` array) — NOT the parent rows. So a program with
 * no active cycle still appears in the result with `cycles: []`.
 *
 * That is exactly what we want here: list ALL non-archived programs and
 * derive `has_active_cycle` from `(row.cycles ?? []).length > 0`.
 *
 * Using `!inner` would silently drop programs without an active cycle.
 *
 * Plan B (if PostgREST embedded-filter bugs ever bite): split into two
 * queries (programs, then active cycles for those program ids), join in JS.
 */

export const listPrograms: ToolDefinition = {
  name: "list_programs",
  description:
    "List the user's training programs (with or without active cycle). " +
    "Returns id, name, is_active, day_count, created_at, has_active_cycle. " +
    "Use to browse before drilling into a specific program with get_program_details. " +
    "Excludes archived programs by default — pass include_archived: true to see them.",
  inputSchema: {
    type: "object",
    properties: {
      include_archived: {
        type: "boolean",
        description: "Include soft-archived programs (default: false).",
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

    const includeArchived = args.include_archived === true

    let query = supabase
      .from("programs")
      .select(
        "id, name, is_active, created_at, archived_at, workout_days(count), cycles(id)",
      )
      .is("cycles.finished_at", null)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false })

    if (!includeArchived) {
      query = query.is("archived_at", null)
    }

    const { data, error } = await query

    if (error) {
      return {
        content: [{ type: "text", text: `Error fetching programs: ${error.message}` }],
        isError: true,
      }
    }

    if (!data || data.length === 0) {
      return {
        content: [{ type: "text", text: "Aucun programme. Crée-en un dans le builder pour commencer." }],
      }
    }

    const lines = data
      .map((row) => row as Record<string, unknown>)
      .map((row) => {
        const workoutDays = row.workout_days as Array<{ count: number }> | null
        const cycles = row.cycles as Array<{ id: string }> | null
        return formatProgramListEntry({
          id: String(row.id),
          name: String(row.name),
          is_active: Boolean(row.is_active),
          day_count: workoutDays?.[0]?.count ?? 0,
          created_at: String(row.created_at),
          has_active_cycle: (cycles ?? []).length > 0,
          archived_at: row.archived_at == null ? null : String(row.archived_at),
        })
      })

    return {
      content: [{
        type: "text",
        text: `## Programs\n\n${lines.join("\n")}`,
      }],
    }
  },
}
