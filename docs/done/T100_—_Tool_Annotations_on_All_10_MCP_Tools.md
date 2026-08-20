# T100 — Tool Annotations on All 10 MCP Tools

## Goal

Add MCP-spec `annotations` (per the [2025-03-26 spec](https://modelcontextprotocol.io/specification/2025-03-26/server/tools)) to every tool in the registry, so Claude Desktop / Claude.ai / Cursor / Le Chat can apply the right consent model — auto-allow read-only tools, always-prompt destructive ones, treat idempotent tools as retry-safe. Lock the contract with two property-style assertions in `tools/registry_test.ts` and fix the silent CI gap that currently keeps `tools/*_test.ts` out of the `deno-unit` job.

Addresses Epic Brief stories **1, 10, 11**: directory-reviewer verification + Claude consent-model selection + idempotency-aware retry behavior.

**Position in PR**: commit 1 of 5 on `feat/296/publish-mcp-connectors-directory`.

## Mode

**AFK** — every annotation field, every tool's hint matrix, the test shape, and the CI glob change are pinned in the Tech Plan and ADR 0001. No mid-flight design choices.

## Slice

`tools/registry.ts (ToolAnnotations type + ToolDefinition.annotations field)` → `tools/<each>.ts × 10 (inline annotations literal)` → `tools/registry_test.ts (2 property assertions)` → `.github/workflows/ci.yml (deno-unit glob extension)`

End-to-end demoable: after merge, an MCP client calling `tools/list` sees an `annotations` object on every tool with at minimum a `title`. Deno test runs in CI on every push.

## Dependencies

None. First commit on the branch.

## Scope

### 1. Modify `supabase/functions/mcp/tools/registry.ts`

Add `ToolAnnotations` interface and make it required on `ToolDefinition`.

| Item | Detail |
|---|---|
| New interface | `export interface ToolAnnotations { title: string; readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean }` |
| Modified interface | `ToolDefinition` gains `annotations: ToolAnnotations` (required, not optional) |
| Comment | One line above the interface: `// Per MCP spec 2025-03-26 — see ADR 0001 for the per-tool matrix.` |
| `openWorldHint` | **Skipped** — uniformly false for our closed-world tools, explicit-everywhere is noise. |
| `toolRegistry.list()` | No code change — already spreads `...schema`, which now includes `annotations`. Tests in section 3 lock this in. |

### 2. Modify the 10 tool files — annotations matrix

Inline `annotations` field at each tool's call site. Per ADR 0001 + Tech Plan Data Model section 2:

| File | `annotations` literal |
|---|---|
| `file:supabase/functions/mcp/tools/searchExercises.ts` | `{ title: "Search exercise catalog", readOnlyHint: true, idempotentHint: true }` |
| `file:supabase/functions/mcp/tools/resolveExercises.ts` | `{ title: "Resolve exercise names to catalog ids", readOnlyHint: true, idempotentHint: true }` |
| `file:supabase/functions/mcp/tools/getExerciseDetails.ts` | `{ title: "Get exercise details", readOnlyHint: true, idempotentHint: true }` |
| `file:supabase/functions/mcp/tools/getWorkoutHistory.ts` | `{ title: "Get workout history", readOnlyHint: true, idempotentHint: true }` |
| `file:supabase/functions/mcp/tools/getTrainingStats.ts` | `{ title: "Get training stats", readOnlyHint: true, idempotentHint: true }` |
| `file:supabase/functions/mcp/tools/getUpcomingWorkouts.ts` | `{ title: "Get upcoming workouts", readOnlyHint: true, idempotentHint: true }` |
| `file:supabase/functions/mcp/tools/listPrograms.ts` | `{ title: "List training programs", readOnlyHint: true, idempotentHint: true }` |
| `file:supabase/functions/mcp/tools/getProgramDetails.ts` | `{ title: "Get program details", readOnlyHint: true, idempotentHint: true }` |
| `file:supabase/functions/mcp/tools/createProgram.ts` | `{ title: "Create or replace active program", destructiveHint: true, idempotentHint: false }` |
| `file:supabase/functions/mcp/tools/updateProgram.ts` | `{ title: "Update existing program (preserves history)", destructiveHint: true, idempotentHint: true }` |

**Atomic edit**: the type change in step 1 + the 10 annotations in step 2 land in the **same commit**. Sequencing them separately leaves intermediate states where `tsc -b` fails. Run `npx tsc -b` (or `deno check`) locally before committing — green TS = all 10 tools annotated.

**`resolveExercises` reminder**: the issue body's annotation table omitted `resolve_exercises` (the issue was authored before #310 shipped). Include it; the matrix is 10 entries, not 9.

### 3. New file — `supabase/functions/mcp/tools/registry_test.ts`

Deno test (matches Deno convention `_test.ts`). Two property assertions:

```ts
import { toolRegistry } from "./registry.ts"

Deno.test("registry: every tool exposes annotations.title via list()", () => {
  for (const tool of toolRegistry.list()) {
    if (
      !tool.annotations ||
      typeof tool.annotations.title !== "string" ||
      tool.annotations.title.length === 0
    ) {
      throw new Error(`${tool.name} has missing or empty annotations.title`)
    }
  }
})

Deno.test("registry: no tool claims both readOnlyHint and destructiveHint", () => {
  for (const tool of toolRegistry.list()) {
    const a = tool.annotations
    if (a?.readOnlyHint && a?.destructiveHint) {
      throw new Error(`${tool.name} cannot be both readOnly and destructive — pick one`)
    }
  }
})
```

**Why these two assertions** (per Tech Plan):
- TS already enforces `title: string` shape; the runtime test catches the regression where a future refactor strips `annotations` from `list()`'s output.
- TS can't see the coherence invariant (`readOnlyHint && destructiveHint` is incoherent); the runtime test catches author mistakes.

### 4. Modify `file:.github/workflows/ci.yml` (line 76)

The `deno-unit` job's glob currently misses `tools/*_test.ts` — `updateProgram_test.ts` already exists but doesn't run in CI today. Fix the glob:

```yaml
# Before
- run: deno test "supabase/functions/mcp/lib/*_test.ts" --allow-env

# After
- run: deno test "supabase/functions/mcp/lib/*_test.ts" "supabase/functions/mcp/tools/*_test.ts" --allow-env
```

Verify locally before committing:

```bash
deno test "supabase/functions/mcp/lib/*_test.ts" "supabase/functions/mcp/tools/*_test.ts" --allow-env
```

Should pass — `lib/*_test.ts` already passes today; `tools/updateProgram_test.ts` should still pass; `tools/registry_test.ts` (new) passes by construction once steps 1-3 land.

## Out of Scope

- Updating `skills/gymlogic-mcp/SKILL.md` to document the annotations — covered by **T103** (URL + 9→10 sweep).
- `openWorldHint` field — uniformly false, deferred per Tech Plan Q2 grilling.
- Centralizing annotations into a constant map or constructor helper — premature DRY per Tech Plan Q3 grilling.
- Updating MCP server `version` in `index.ts` — not required (annotation addition is backward-compatible from the client's perspective).
- Worker-side changes — covered by **T101** (helper extraction) + **T102** (Worker package).

## Acceptance Criteria

- [ ] `ToolAnnotations` interface defined in `registry.ts` with `title: string` (required) + 3 optional booleans.
- [ ] `ToolDefinition.annotations` is required (compilation fails if any tool literal omits it).
- [ ] All 10 tool files include `annotations` matching the matrix above.
- [ ] `tools/registry_test.ts` exists with 2 property assertions.
- [ ] `.github/workflows/ci.yml` `deno-unit` glob includes both `lib/*_test.ts` and `tools/*_test.ts`.
- [ ] Local `deno test "supabase/functions/mcp/lib/*_test.ts" "supabase/functions/mcp/tools/*_test.ts" --allow-env` passes.
- [ ] Local `npx tsc --noEmit` passes (or equivalent — function code uses Deno types).
- [ ] Demoable: a curl `tools/list` against the local supabase function returns `annotations.title` for each of the 10 tools.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Track A1)
- Tech Plan: `file:docs/Tech_Plan_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Key Decisions: tool annotation shape, hint scope, annotation placement, registry test, CI scope extension; Data Model section 1+2; Implementation Notes commit 1)
- ADR: `file:docs/adr/0001-mcp-public-url-and-oauth-issuer.md` (follow-ups: SKILL.md 9→10 fix)
- Glossary: `file:docs/CONTEXT.md` (Tool Annotation entry)
- MCP spec: https://modelcontextprotocol.io/specification/2025-03-26/server/tools
- Code anchors: `file:supabase/functions/mcp/tools/registry.ts`, all `tools/*.ts`
