# T109 — MCP Inspector Validation Pass

## Goal

Pre-empt Anthropic reviewer findings by running the same validation tool reviewers will run: [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector). Connect to `mcp.gymlogic.me` with the test account's PAT, invoke each of the 10 tools, and confirm every response is meaningful and non-error. Bugs surfaced get filed as separate issues; this ticket completes when Inspector + every tool returns clean output.

Addresses Epic Brief story **5** (success measure: zero `Authentication required` or generic 5xx on the validation pass) + Track **D1**.

## Mode

**HITL** — judgment required on tool response quality (is the output actually useful, not just "no error"?). Bug triage during the pass is a human task.

## Slice

`MCP Inspector launch (web UI or CLI)` → `connect to mcp.gymlogic.me with PAT auth` → `tools/list shows 10 tools with annotations` → `invoke each tool with realistic inputs` → `record outputs + flag bugs`

## Dependencies

- **T105** (Worker deployed at `mcp.gymlogic.me`).
- **T106** (test account with PAT + realistic data).

## Scope

### 1. Launch MCP Inspector

Two options:

**(a) Web UI** (easier):
- Navigate to https://modelcontextprotocol.io/inspector OR https://github.com/modelcontextprotocol/inspector for the official launcher.
- Configure transport: `Streamable HTTP` → URL: `https://mcp.gymlogic.me/functions/v1/mcp`.
- Auth: `Bearer Token` → paste test account's PAT (from T106).

**(b) CLI** (more reproducible):

```bash
npx @modelcontextprotocol/inspector --transport http \
  --url https://mcp.gymlogic.me/functions/v1/mcp \
  --header "Authorization: Bearer $TEST_PAT"
```

### 2. Verify connection + tool listing

Inspector should show:
- Connection status: ✅ Connected
- Server name + version (from `initialize` response)
- 10 tools listed in the tool browser, each showing:
  - `name`
  - `description`
  - `annotations.title` (newly visible thanks to T100)
  - `inputSchema`

If any tool is missing or malformed: regression — fix before proceeding.

### 3. Invoke each tool — validation matrix

Run each tool with a realistic input. Expected: meaningful output, no errors.

| Tool | Input | Expected output |
|---|---|---|
| `search_exercises` | `{ query: "bench press" }` | Array of catalog matches with names, equipment, muscle groups |
| `resolve_exercises` | `{ queries: ["bench press", "squat", "deadlift"] }` | Array of `ResolvedExercise` with status: `matched` for all 3 |
| `get_exercise_details` | `{ exercise_id: <UUID from search>}` | Full details: instructions, weight_convention, default_duration, etc. |
| `get_workout_history` | `{ days: 14 }` | ≥10 sessions from T106's seeded data |
| `get_training_stats` | `{ days: 30 }` | Numeric stats: total sessions, volume, top muscle groups |
| `get_upcoming_workouts` | `{ days: 7 }` | Upcoming sessions from active program |
| `list_programs` | `{}` | Active program + any drafts/archived from T106 |
| `get_program_details` | `{ program_id: <UUID from list_programs> }` | Full program structure with days/exercises/sets |
| `create_program` | `{ name: "Inspector Test", days: [...], dry_run: true }` | Dry-run preview, no DB write |
| `update_program` | `{ program_id: <draft program UUID>, patch: { name: "Updated via Inspector" } }` | Updated program returned, real DB write |

For destructive tools (`create_program`, `update_program`): use `dry_run: true` first. Only follow up with real writes if you want to validate the full flow + cleanup after.

### 4. Record outcomes

For each tool, capture:
- Status: ✅ pass / ⚠️ partial / ❌ fail
- Response time (Inspector shows latency)
- Output snippet (paste 5-10 lines of meaningful response)
- Any anomaly noticed (e.g. truncated output, missing fields, weird formatting)

### 5. Triage anomalies

For each issue surfaced:
- **Trivial** (typo, weird whitespace): file as a follow-up bug ticket; doesn't block this ticket.
- **Material** (tool returns 5xx, output is wrong, annotation missing): block T108 submission until fixed. File a hotfix ticket linked to this PR.

If anything blocks: pause the epic at this gate, do NOT submit to Anthropic with known broken tools — they WILL find them.

### 6. Save the validation log

Add to maintainer's private notes:

```
MCP Inspector pass — <YYYY-MM-DD>
Tools tested: 10 / 10
Pass rate: X / 10
Bugs filed: <list issue numbers>
Submission gate: GO / NO-GO
```

If GO: proceed to T108. If NO-GO: fix bugs, re-run Inspector, update this log.

## Out of Scope

- Fixing the bugs Inspector surfaces — separate tickets per bug.
- Performance benchmarking of tools — Inspector shows latency informationally, not a tuning exercise.
- Testing edge cases beyond the realistic-input matrix above — focus on what reviewers will see.
- OAuth flow validation (covered by T105's smoke test).

## Acceptance Criteria

- [ ] MCP Inspector connected to `https://mcp.gymlogic.me/functions/v1/mcp` with PAT auth.
- [ ] All 10 tools listed in Inspector with `annotations.title` visible.
- [ ] All 10 tools invoked with realistic inputs (per matrix in section 3).
- [ ] Validation log saved with per-tool status + bugs filed (if any).
- [ ] Submission gate decision recorded (GO / NO-GO).
- [ ] Demoable: walk through Inspector with a colleague; show all 10 tools returning meaningful data live.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Track D1, story 5)
- Tech Plan: `file:docs/Tech_Plan_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Implementation Notes → Deferred ticket scope: D1)
- MCP Inspector: https://modelcontextprotocol.io/docs/tools/inspector
- MCP spec — Tools: https://modelcontextprotocol.io/specification/2025-03-26/server/tools
- Skill (intent → tool table): `file:skills/gymlogic-mcp/SKILL.md`
