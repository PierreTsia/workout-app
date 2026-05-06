# T98 — `resolve_exercises` Tool End-to-End

## Goal

Ship the new MCP tool `resolve_exercises` that batch-resolves a list of exercise names to UUIDs in a single call, with bundled catalog metadata (`weight_convention`, `measurement_type`, `default_duration_seconds`) so downstream `create_program` / `update_program` flows don't need follow-up `get_exercise_details` calls.

Addresses Epic Brief stories **1, 2, 3, 4, 7, 8, 9, 10, 11**: the core capability + ambiguity surfacing + no-match handling + perf win + token reduction + catalog-tool coexistence.

## Mode

**AFK** — every decision is locked in the Tech Plan (RPC signature, score-gap value, status field shape, env-var fallback, test coverage scope, version bump). No mid-flight design choices.

## Slice

`migration (RPC + GRANT)` → `lib/scoreGap.ts (pure helper)` → `tools/resolveExercises.ts (handler)` → `tools/registry.ts (registration)` → `index.ts (server version bump)` → `vitest unit tests (handler + helper)` → `SKILL.md tool-reference row (one-line additive edit)`.

End-to-end demoable: after merge, an MCP client calling `tools/list` sees the new tool; `tools/call` returns properly-shaped batch results.

## Dependencies

None. Self-contained capability slice. Existing `search_exercises` keeps working unchanged.

## Scope

### 1. Postgres migration

Create `supabase/migrations/YYYYMMDDhhmmss_resolve_exercises_batch.sql` with:

- `CREATE OR REPLACE FUNCTION resolve_exercises_batch(queries text[])` per the Tech Plan SQL snippet
- Returns `TABLE (query_idx int, query_text text, exercise_id uuid, name text, name_en text, muscle_group text, equipment text, measurement_type text, default_duration_seconds int, score real)`
- `LANGUAGE plpgsql STABLE SECURITY INVOKER`
- Per-query PL/pgSQL FOR loop: normalize via `extensions.unaccent(lower(...))`, `CONTINUE` on empty, `RETURN QUERY` ranked top-3 reusing the existing search ranking expression
- `GRANT EXECUTE ON FUNCTION public.resolve_exercises_batch(text[]) TO authenticated`
- Inline `-- See also: 20260326120000_search_exercises.sql (keep ranking clauses aligned or consciously diverge)` comment near the WHERE/ORDER BY block

**Also add a matching `-- See also:` comment to** `file:supabase/migrations/20260326120000_search_exercises.sql` pointing back to this new migration. (Cross-reference enforcement, per Tech Plan Critical Constraint #7.)

### 2. New file — `supabase/functions/mcp/lib/scoreGap.ts`

| Item | Detail |
|---|---|
| Exports | `isAmbiguous(matches: ScoredMatch[]): boolean`, `getAmbiguityGap(): number`, `DEFAULT_AMBIGUITY_GAP = 0.10` |
| `isAmbiguous` | Returns `true` when `matches.length >= 2 && matches[0].score - matches[1].score < getAmbiguityGap()`. NaN-safe. |
| `getAmbiguityGap` | Reads `Deno.env.get("MCP_AMBIGUITY_GAP")`, parses with `parseFloat`, validates as finite `(0, 1]`, falls back to `DEFAULT_AMBIGUITY_GAP` on (unset, NaN, out-of-range). Cached after first read. |
| Comment block | Include a `// TUNING:` comment near `DEFAULT_AMBIGUITY_GAP` describing what to look for in production traces (false-ambiguous rate, false-confident pick rate) and how to adjust the env var. |

### 3. New file — `supabase/functions/mcp/lib/scoreGap.test.ts`

Vitest unit coverage:

- Default threshold: gap=0.10 boundary cases (0.099, 0.10, 0.101)
- Edge cases: single match, zero matches, three-way tie, NaN scores
- Env-var override path: valid value, invalid string, out-of-range (0 / negative / >1), missing env var
- Caching behaviour (subsequent reads after env mutation return the cached value, per the documented contract)

### 4. New file — `supabase/functions/mcp/tools/resolveExercises.ts`

Implements `ToolDefinition` per `file:supabase/functions/mcp/tools/registry.ts`:

| Item | Detail |
|---|---|
| `name` | `"resolve_exercises"` |
| `description` | Self-contained, factual: what it does, input shape, response shape with `status` field semantics, max 50 queries. Do **NOT** include "use this instead of search_exercises" steering — that lands in T99. |
| `inputSchema` | `{ type: "object", properties: { queries: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 50 } }, required: ["queries"] }` |
| Validation | Non-empty array, length ≤ 50, every element string. Errors return `isError: true` with explicit messages per the Tech Plan failure-mode table. |
| Auth | Standard early-return on `!supabase` with `"Authentication required..."` text. |
| RPC call | Single `supabase.rpc("resolve_exercises_batch", { queries })` call. |
| Grouping | Build `Map<number, RawRow[]>` keyed by `row.query_idx`, NOT by row position. |
| Per-query status | `"empty_query"` (input was blank) / `"no_match"` (input had text, no rows) / `"ambiguous"` (rows present + `isAmbiguous(matches)` true → top 1-3 attached) / `"matched"` (rows present + not ambiguous → top-1 only). |
| Bundled metadata | Each `ResolvedExercise` includes `weight_convention: formatWeightConvention(row.equipment)` from `file:supabase/functions/mcp/lib/format.ts`. Never duplicate the equipment-to-convention map in this file. |
| Response | `{ content: [{ type: "text", text: JSON.stringify(response, null, 2) }] }` matching `BatchResolveResponse` shape from Tech Plan data model. |

### 5. New file — `supabase/functions/mcp/tools/resolveExercises.test.ts`

Mirror the fake-supabase pattern from `file:supabase/functions/mcp/lib/catalogLookup.test.ts`. Required test coverage:

- Happy path single match → `status: "matched"`, top-1 exercise with `weight_convention`
- Ambiguous-with-alternates → `status: "ambiguous"`, 2-3 entries
- No-match (RPC returns zero rows for a real query) → `status: "no_match"`, empty matches
- Empty/whitespace query in batch → `status: "empty_query"`
- All-empty batch
- Mixed batch (matched + ambiguous + no_match + empty_query in one call)
- Batch-size cap exceeded (51 queries) → `isError: true`
- Empty `queries` array → `isError: true`
- Non-string element in `queries` → `isError: true`
- RPC error propagation → `isError: true` with verbatim message
- No-auth → `"Authentication required..."`
- `weight_convention` bundling correct for `dumbbell` (`per_hand`), `barbell` (`total`), `bodyweight` (`bodyweight`)
- **Non-input-order RPC results**: queries `["a", "b", "c"]`, fake RPC returns rows tagged with `query_idx` `[2, 0, 1]` — verify Edge Function groups by tagged column, not row position

### 6. Modified file — `supabase/functions/mcp/tools/registry.ts`

Append `resolveExercises` import + register in the `tools` array. No other changes.

### 7. Modified file — `supabase/functions/mcp/index.ts`

Bump `SERVER_INFO.version` from `"0.4.0"` to `"0.5.0"`.

### 8. Modified file — `skills/gymlogic-mcp/SKILL.md` (minimal additive only)

- Add a row to the **tool reference table** (currently lines ~68-78) for `resolve_exercises`. Description should mirror the tool's MCP `description` (factual, no cross-tool steering).
- Update the **count line** ("Nine tools total — seven reads, two writes" near line 66) to "Ten tools total — seven reads, two writes, one resolver" (or equivalent — author's choice).

**Do NOT touch** the decision table, Pattern 3, Pattern 4, `update_program` worked examples, Edge Cases table, or any cross-tool steering copy. All of that is T99.

## Out of Scope

- Tool description updates that steer agents AWAY from `search_exercises` or `get_exercise_details` (T99).
- SKILL.md decision table, Pattern updates, worked example rewrites (T99).
- Updates to `createProgram.ts`'s `TOOL_DESCRIPTION` constant (T99).
- Removing `search_exercises` from the MCP toolkit (deferred per Epic Brief, ≥ 2-week observation window).
- Production instrumentation / metrics for tool-call counts (separate follow-up ticket).
- `LEGACY_MIGRATION_ERROR_MESSAGE` in `createProgramValidation.ts` — leave untouched (v0.2.x→v0.3.x migration text, not v0.5.x guidance).

## Acceptance Criteria

- [ ] New migration file applies cleanly via `supabase migration up` against the local Supabase stack
- [ ] `resolve_exercises_batch(ARRAY['bench press', 'squat', ''])` called via `psql` returns ranked rows for the first two queries and zero rows for the third
- [ ] `tools/list` MCP request returns 10 tools including `resolve_exercises` with the documented input schema
- [ ] `tools/call resolve_exercises { queries: ["bench press", "leg press", "trap bar deadlift", ""] }` returns a JSON payload with 4 entries, each with the documented `status` field; the "leg press" entry has `status: "ambiguous"` and ≥ 2 alternates; the "trap bar deadlift" entry has `status: "no_match"`; the empty-string entry has `status: "empty_query"`
- [ ] Each `ResolvedExercise` row includes `weight_convention` derived via `formatWeightConvention(equipment)` (verified for at least one `dumbbell` and one `barbell` exercise in the catalog)
- [ ] `MCP_AMBIGUITY_GAP=0.05` environment override changes the ambiguity threshold without code change (verified via test or manual run)
- [ ] All new vitest tests pass (`scoreGap.test.ts` and `resolveExercises.test.ts`); existing tests still pass
- [ ] `tsc --noEmit` is clean
- [ ] An end-to-end manual smoke test against a real MCP client (Claude Desktop or `mcp inspector`) successfully resolves a 12-name batch in a single call and returns properly-shaped results

## References

- [Epic Brief — MCP — Batch Exercise Resolution #310](./Epic_Brief_—_MCP_—_Batch_Exercise_Resolution_#310.md)
- [Tech Plan — MCP — Batch Exercise Resolution #310](./Tech_Plan_—_MCP_—_Batch_Exercise_Resolution_#310.md) — Sections: Key Decisions, Critical Constraints (#1, #2, #3, #4, #6, #7, #8), Data Model, Component Responsibilities (`resolveExercises.ts`, `scoreGap.ts`, `resolve_exercises_batch`), Failure Mode Analysis
- GitHub issue [#310](https://github.com/PierreTsia/workout-app/issues/310)
