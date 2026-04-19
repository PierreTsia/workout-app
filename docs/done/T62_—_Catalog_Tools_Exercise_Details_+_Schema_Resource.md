# T62 — Catalog Tools: Exercise Details + Schema Resource

## Goal

Complete the exercise-related data surfaces on the MCP server: a `get_exercise_details` tool for full metadata on a single exercise, and an `exercise_catalog_schema` resource that exposes the domain taxonomy (muscle groups, equipment types, difficulty levels) as reference data the agent reads once at conversation start.

## Dependencies

- T61 — MCP Server Scaffold + First Tool (provides `index.ts`, auth plumbing, tool registration pattern)

## Scope

### Tool: `get_exercise_details`

| Item | Detail |
|---|---|
| File | `supabase/functions/mcp/tools/getExerciseDetails.ts` |
| Export | Registration function: `(server: McpServer) => void` |
| Data source | Direct query: `supabase.from("exercises").select("*")` |
| Input schema (Zod) | `exercise_id` (string/uuid, optional), `name` (string, optional) — at least one required |
| Lookup logic | By ID if provided; otherwise fuzzy name match via `.ilike("name", `%${name}%`)` or `.ilike("name_en", `%${name}%`)` |
| Output | Structured text: exercise name (FR + EN), muscle group, secondary muscles, equipment, difficulty, instructions (setup/movement/breathing/common mistakes), YouTube URL, image URL |
| Error handling | Not found → MCP error: "Exercise not found. Try search_exercises to find the right one." |
| Tool description | "Get full details for a specific exercise by ID or name. Returns instructions, muscle targets, equipment, difficulty, and media links. Use search_exercises first if you don't know the exact ID or name." |

### Resource: `exercise_catalog_schema`

| Item | Detail |
|---|---|
| File | `supabase/functions/mcp/resources/exerciseCatalogSchema.ts` |
| Export | Registration function: `(server: McpServer) => void` |
| Data source | RPC: `get_exercise_filter_options` (returns distinct muscle groups, equipment types, difficulty levels) |
| MCP resource URI | `workout-app://exercise-catalog-schema` |
| Output | JSON with three arrays: `muscle_groups`, `equipment_types`, `difficulty_levels` — stable reference data |
| Resource description | "Exercise catalog taxonomy: available muscle groups, equipment types, and difficulty levels. Read this once to understand the domain vocabulary before using search_exercises or get_exercise_details." |

### Registration

Wire both into `mcp/index.ts` alongside the existing `search_exercises` tool from T61.

## Out of Scope

- Training data tools (T63)
- `lib/format.ts` shared formatters (T63) — this ticket uses inline formatting since exercise details are a one-off shape
- OAuth 2.1 (T64)
- Production testing (T65)

## Acceptance Criteria

- [ ] `tools/list` returns `search_exercises` (T61) + `get_exercise_details`
- [ ] `resources/list` returns `exercise_catalog_schema`
- [ ] `get_exercise_details` with a valid exercise ID returns full metadata as structured text
- [ ] `get_exercise_details` with a name string returns the matching exercise (fuzzy)
- [ ] `get_exercise_details` with an unknown ID/name returns a clear "not found" message (not a crash)
- [ ] `exercise_catalog_schema` resource returns muscle groups, equipment types, and difficulty levels as JSON
- [ ] MCP Inspector shows both new surfaces alongside the existing tool

## References

- [Epic Brief — MCP-First Architecture (#231)](./Epic_Brief_—_MCP-First_Architecture_#231.md) — Scope: items 3e, 4
- [Tech Plan — MCP-First Architecture (#231)](./Tech_Plan_—_MCP-First_Architecture_#231.md) — Sections: Tool-to-Query Mapping, New Files & Responsibilities
- [T61 — MCP Server Scaffold + First Tool](./T61_—_MCP_Server_Scaffold_+_First_Tool.md)
