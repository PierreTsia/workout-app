# Tech Plan — MCP — Batch Exercise Resolution #310

## Architectural Approach

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Tool name | `resolve_exercises` | Conveys intent (name → UUID resolution); avoids confusion with existing `search_exercises` |
| Input shape | `{ queries: string[] }` only — no per-query filters in v1 | Real agent traces (issue #310 screenshot) show context-embedding in the name string itself; adding optional fields later is non-breaking |
| Postgres execution | New `resolve_exercises_batch(queries text[])` RPC; single round-trip; PL/pgSQL FOR loop returning ranked rows tagged by `query_idx` | 1 round-trip vs N; reuses `pg_trgm`/`unaccent` infra; PL/pgSQL more readable than `unnest LATERAL` for this shape; perf difference negligible at scale |
| Score-gap threshold | `0.10` between top-1 and top-2 similarity scores; substring-rank-0 ties naturally fall under this rule (identical scores → gap=0 → ambiguous) | Catches dominant ambiguity case (substring collisions like "leg press"); starter value, tunable later from production traces |
| Top-K | 3 (top-1 always; top-2/3 only attached when `ambiguous: true`) | Enough alternates for agent to surface to user without payload bloat |
| Bundled metadata | Each result includes `weight_convention`, `measurement_type`, `default_duration_seconds` | Eliminates N × `get_exercise_details` calls before `create_program`. `weight_convention` derived in Edge Function via existing `formatWeightConvention()` — single source of truth |
| Tool coexistence | Keep `search_exercises` in MCP toolkit | Browse-by-filter is a legitimate intent; non-breaking; agents steered via tool descriptions + SKILL.md |
| Server version | `0.4.0` → `0.5.0` | Additive (new tool, no breaking change to existing tools) |
| Max batch size | 50 queries | Comfortable buffer above realistic program-build (~12 names per call); DoS guardrail |
| Empty/whitespace queries | Per-query `{matches: [], reason: "empty_query"}` | Uniform response shape — every input query gets a result row |
| Score-gap helper location | Separate `file:supabase/functions/mcp/lib/scoreGap.ts` + dedicated tests | Tiny pure function but isolation lets us unit-test edge cases (0.099 / 0.10 / 0.101) without supabase mocks |

### Critical Constraints

1. **RLS / SECURITY INVOKER**: the new RPC must mirror the existing `file:supabase/migrations/20260326120000_search_exercises.sql` auth pattern (`SECURITY INVOKER` + `GRANT EXECUTE ... TO authenticated`). Without it, real users get 403s. The existing `exercises` table RLS scopes the query to the calling user automatically — no extra logic needed in the function.
2. **Diacritic / unicode normalization**: must use `extensions.unaccent(lower(...))` on BOTH query input and the indexed columns, matching the existing search RPC. Inconsistency here would produce different match sets for "épaules" vs "epaules" between the two tools.
3. **Tool registry contract**: the new handler must implement `ToolDefinition` from `file:supabase/functions/mcp/tools/registry.ts` and be added to the `tools` array. The dispatch in `file:supabase/functions/mcp/index.ts` (`tools/call` case) is generic — no changes needed there beyond the registry append.
4. **`weight_convention` source of truth**: derived via `formatWeightConvention(equipment)` in `file:supabase/functions/mcp/lib/format.ts`. NEVER duplicate this mapping in SQL — equipment-to-convention rules can shift (e.g. when issue #281 lands weighted bodyweight) and the TS layer must remain canonical.
5. **SKILL.md / description coherence**: all four updates (`resolve_exercises` desc, `search_exercises` desc revision, `create_program` desc edit, SKILL.md) must ship in the same PR. Mismatched guidance is worse than no change — the agent will pick a random path.
6. **MCP version bump**: `SERVER_INFO.version` in `file:supabase/functions/mcp/index.ts` plus a `CHANGELOG.md` entry. The protocol version (`PROTOCOL_VERSION = "2025-03-26"`) does NOT change — that's the MCP spec version.
7. **Ranking-clause duplication accepted**: the new RPC's `WHERE`/`ORDER BY` mirrors the existing `search_exercises` RPC's clauses. Not extracted to a shared SQL helper because the two tools may legitimately diverge over time (resolve cares about top-match quality; search cares about list completeness). Documented here so any future tuning of one is consciously evaluated against the other.

---

## Data Model

No new tables, no new columns. Pure RPC + tool layer addition.

### Response shape (JSON returned in the tool's text content)

```mermaid
classDiagram
    class BatchResolveResponse {
        +ResolvedQuery[] results
    }
    class ResolvedQuery {
        +string query
        +boolean ambiguous
        +string|null reason
        +ResolvedExercise[] matches
    }
    class ResolvedExercise {
        +uuid id
        +string name
        +string|null name_en
        +string muscle_group
        +string equipment
        +string measurement_type
        +int|null default_duration_seconds
        +string weight_convention
        +number score
    }
    BatchResolveResponse --> ResolvedQuery
    ResolvedQuery --> ResolvedExercise
```

### New Postgres RPC

```sql
-- supabase/migrations/YYYYMMDDhhmmss_resolve_exercises_batch.sql

CREATE OR REPLACE FUNCTION resolve_exercises_batch(
  queries text[]
)
RETURNS TABLE (
  query_idx int,
  query_text text,
  exercise_id uuid,
  name text,
  name_en text,
  muscle_group text,
  equipment text,
  measurement_type text,
  default_duration_seconds int,
  score real
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
AS $$
DECLARE
  q_raw text;
  q_norm text;
  qi int;
BEGIN
  IF queries IS NULL OR array_length(queries, 1) IS NULL THEN
    RETURN;
  END IF;

  FOR qi IN 1..array_length(queries, 1) LOOP
    q_raw := queries[qi];
    q_norm := trim(lower(extensions.unaccent(coalesce(q_raw, ''))));

    -- Empty/whitespace queries return zero rows for this query_idx;
    -- the Edge Function maps absence + reason "empty_query".
    IF length(q_norm) = 0 THEN
      CONTINUE;
    END IF;

    RETURN QUERY
      SELECT
        qi - 1 AS query_idx,
        q_raw AS query_text,
        e.id AS exercise_id,
        e.name,
        e.name_en,
        e.muscle_group,
        e.equipment,
        e.measurement_type::text,
        e.default_duration_seconds,
        GREATEST(
          similarity(extensions.unaccent(lower(e.name)), q_norm),
          similarity(extensions.unaccent(lower(coalesce(e.name_en, ''))), q_norm)
        )::real AS score
      FROM exercises e
      WHERE
        extensions.unaccent(lower(e.name)) ILIKE '%' || q_norm || '%'
        OR extensions.unaccent(lower(coalesce(e.name_en, ''))) ILIKE '%' || q_norm || '%'
        OR similarity(extensions.unaccent(lower(e.name)), q_norm) > 0.15
        OR similarity(extensions.unaccent(lower(coalesce(e.name_en, ''))), q_norm) > 0.15
      ORDER BY
        CASE
          WHEN extensions.unaccent(lower(e.name)) ILIKE '%' || q_norm || '%' THEN 0
          WHEN extensions.unaccent(lower(coalesce(e.name_en, ''))) ILIKE '%' || q_norm || '%' THEN 1
          ELSE 2
        END,
        GREATEST(
          similarity(extensions.unaccent(lower(e.name)), q_norm),
          similarity(extensions.unaccent(lower(coalesce(e.name_en, ''))), q_norm)
        ) DESC,
        e.name,
        e.id
      LIMIT 3;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_exercises_batch(text[]) TO authenticated;
```

### Table Notes

- **No `rank` column in the RPC output** — substring vs similarity ordering is encoded in the row order (deterministic via `LIMIT 3` after `ORDER BY`); the Edge Function reads rows in result order. Adding an explicit rank column is 4 bytes per row of payload bloat for no agent-visible benefit.
- **`measurement_type::text` cast** — the column is constrained text in `exercises`; cast to plain text in the result so the consumer doesn't need to know about the underlying type.
- **`score::real`** — keeps the field 32-bit for transport; `pg_trgm` similarity is float in [0, 1], no precision loss in 24-bit mantissa.
- **Empty-query handling lives in PL/pgSQL** — the `CONTINUE` branch produces zero rows for that `query_idx`. The Edge Function detects "no rows for this index" and decides whether it's `no_match` (input had real text) or `empty_query` (input was blank).
- **No score normalization across queries** — `pg_trgm` similarity is per-query; comparing scores across different queries is meaningless. The `ambiguous` flag operates strictly within a single query's results, never across.

---

## Component Architecture

### Layer Overview

```mermaid
graph TD
    Agent["AI Agent<br/>(Claude / Cursor / generic MCP)"]
    EdgeFn["MCP Edge Function<br/>(supabase/functions/mcp/index.ts)"]
    Tool["resolveExercises.ts<br/>(new tool handler)"]
    ScoreGap["scoreGap.ts<br/>(pure ambiguity helper)"]
    Format["format.ts<br/>(formatWeightConvention)"]
    RPC["resolve_exercises_batch<br/>(new Postgres RPC)"]
    Exercises[(exercises table<br/>RLS-scoped)]

    Agent -->|"tools/call resolve_exercises"| EdgeFn
    EdgeFn -->|"dispatch via toolRegistry"| Tool
    Tool --> ScoreGap
    Tool --> Format
    Tool -->|"supabase.rpc('resolve_exercises_batch')"| RPC
    RPC --> Exercises
```

### New Files & Responsibilities

| File | Purpose |
|---|---|
| `supabase/functions/mcp/tools/resolveExercises.ts` | New tool handler: validate input, call RPC, apply score-gap rule per query, bundle `weight_convention`, format JSON response |
| `supabase/functions/mcp/tools/resolveExercises.test.ts` | Vitest unit tests with fake supabase client (mirror `file:supabase/functions/mcp/lib/catalogLookup.test.ts` pattern) |
| `supabase/functions/mcp/lib/scoreGap.ts` | Pure helper: `isAmbiguous(matches: {score: number}[]): boolean`. Extracted for unit testing without supabase mocks. Exports `AMBIGUITY_GAP = 0.10`. |
| `supabase/functions/mcp/lib/scoreGap.test.ts` | Vitest unit tests for threshold rule (gap=0.10, edge cases at 0.099 / 0.10 / 0.101, single-match, zero-match, three-way tie, NaN defensive) |
| `supabase/migrations/YYYYMMDDhhmmss_resolve_exercises_batch.sql` | New Postgres RPC + GRANT |

### Modified Files

| File | Change |
|---|---|
| `supabase/functions/mcp/tools/registry.ts` | Register new tool in the `tools` array |
| `supabase/functions/mcp/tools/searchExercises.ts` | Update `description`: explicit "use `resolve_exercises` instead if you already know the names" steering |
| `supabase/functions/mcp/tools/createProgram.ts` | Update `TOOL_DESCRIPTION`: drop "Call `get_exercise_details` first to confirm the convention" line; replace with reference to `resolve_exercises` returning the convention |
| `supabase/functions/mcp/index.ts` | Bump `SERVER_INFO.version` from `"0.4.0"` to `"0.5.0"` |
| `skills/gymlogic-mcp/SKILL.md` | Add "Catalog tools — which one when" decision table near top; update Pattern 3, Pattern 4, both `update_program` worked examples to use `resolve_exercises`; update tool-reference table to include new tool (10 tools total); revise the `LEGACY_MIGRATION_ERROR_MESSAGE` reference if it still mentions `get_exercise_details` for convention guidance |
| `CHANGELOG.md` | v0.5.0 entry — new tool + perf description |

### Component Responsibilities

**`resolveExercises.ts`** (new tool handler)
- Validates `args.queries`: must be non-empty array, length ≤ 50, every element is string (else returns `isError: true` with explicit message)
- Calls `supabase.rpc("resolve_exercises_batch", { queries })` once
- Groups returned rows by `query_idx`
- For each input query index 0..N-1:
  - Determine reason: empty/whitespace input → `"empty_query"`; otherwise no rows → `"no_match"`; matches present → `null`
  - Apply `isAmbiguous(matches)` → if true, attach top-1, top-2, top-3 with `ambiguous: true`; else attach only top-1
  - Map each row to `ResolvedExercise` with `weight_convention: formatWeightConvention(row.equipment)`
- Returns `{content: [{type: "text", text: JSON.stringify(response, null, 2)}]}`
- Auth: standard pattern from existing tools (early return on `!supabase` with `"Authentication required..."` text)

**`scoreGap.ts`** (pure helper)
- `isAmbiguous(matches: ScoredMatch[]): boolean` — returns true when `matches.length >= 2 && matches[0].score - matches[1].score < AMBIGUITY_GAP`
- No dependencies, no supabase, no I/O — pure function for clean unit tests
- Threshold constant `AMBIGUITY_GAP = 0.10` exported for tests
- NaN-safe (NaN comparisons are false → never returns true on bad data → defaults to top-1-only behavior, no crash)

**`resolve_exercises_batch`** (new Postgres RPC)
- `LANGUAGE plpgsql STABLE SECURITY INVOKER`
- Iterates query array via PL/pgSQL FOR loop; per query: normalize, skip empties, RETURN QUERY ranked top-3
- Reuses the same ranking expression as the existing `search_exercises` RPC (substring rank then similarity desc)
- Inherits RLS from the `exercises` table (scoped to authenticated user)

### Failure Mode Analysis

| Failure | Behavior |
|---|---|
| `queries` missing or not an array | Tool returns `isError: true` with text: `"queries must be a non-empty array of strings"` |
| `queries.length > 50` | Tool returns `isError: true` with text: `"queries exceeds max batch size of 50 (got N)"` |
| `queries.length === 0` | Tool returns `isError: true` (same message as missing) |
| Single empty/whitespace query in batch | That entry: `{query: "", matches: [], reason: "empty_query"}`; siblings unaffected |
| Single query matches zero exercises | That entry: `{query, matches: [], reason: "no_match"}`; siblings unaffected |
| All queries match zero exercises | Response: 100% `no_match` rows. Batch is still success (200, no `isError`) — agent reads and decides next move |
| RPC error (Postgres down, function permission missing) | Tool returns `isError: true` with the error message verbatim. Agent surfaces to user. |
| No auth (`!supabase`) | Standard `"Authentication required — please provide a valid Bearer token."` |
| Two queries with identical text | Each gets its own result row independently — no dedup across queries (agent's payload, agent's choice) |
| Catalog has zero exercises (fresh DB seed missing) | All queries → `no_match`; agent surfaces "no exercises found in catalog" gracefully |
| Agent sends 50 single-character queries (e.g. `["a", "b", ...]`) | Each returns ambiguous matches (substring collisions); response payload up to 50 × 3 rows = 150 rows. Bounded. |
| Score field is `NaN` (defensive — shouldn't happen from PG `real`) | `isAmbiguous` returns false (NaN comparisons are false) → tool emits top-1 only. No crash. |
| Catalog row with unknown `equipment` value | `formatWeightConvention` falls back to `"total"` and logs a warning (existing behavior). Tool response still well-formed. |
| Two adjacent matches with identical raw scores but different substring ranks | Score gap = 0 → ambiguous → both surfaced as alternates. Acceptable: ranking is recorded by row order; the agent gets to disambiguate. |
| Agent passes a non-string element (e.g. `[123, "bench"]`) | Caught in input validation: `isError: true` with `"queries[N] must be a string"` |
