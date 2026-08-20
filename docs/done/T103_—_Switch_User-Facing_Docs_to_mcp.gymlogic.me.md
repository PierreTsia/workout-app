# T103 — Switch User-Facing Docs to `mcp.gymlogic.me`

## Goal

Promote the brand URL `mcp.gymlogic.me` across every user-facing doc and skill that currently advertises the raw Supabase URL. After this ticket: any new user copy-pasting from a GymLogic doc into Claude Desktop / Cursor / Le Chat / OpenClaw uses the brand domain. Existing users on the Supabase URL keep working forever (per ADR 0001) — they just no longer find it documented as the canonical install URL.

Also fixes the embarrassing "nine tools" / "ten tools" inconsistency in `skills/gymlogic-mcp/SKILL.md` (lines 13 + 60 say nine, line 66 correctly says ten — the skill grew from 9 to 10 with #310's `resolve_exercises` and the prose was never updated).

Addresses Epic Brief story **15**: maintainer authoring docs wants every reference to point at `mcp.gymlogic.me` exclusively, with the tool count fixed.

**Position in PR**: commit 4 of 5 on `feat/296/publish-mcp-connectors-directory`.

## Mode

**AFK** — pure mechanical sweep with grep validation. No judgment calls.

## Slice

`skills/gymlogic-mcp/SKILL.md (URL + 9→10 prose × 2)` → `docs/mcp-connect/{claude-desktop,cursor,le-chat,openclaw,example-prompts}.md (URL substitution)` → grep sanity check

Single layer (docs only). End-to-end demoable: `rg "favusepjqwpcroiolvaz" docs/ skills/` returns 0 hits (excluding the intentional ADR 0001 glossary reference); `rg -i "nine\s+(tool|read)" skills/` returns 0 hits.

## Dependencies

- **T102** — Worker code must land before promoting `mcp.gymlogic.me` in user-facing docs. Between T103 merge and T105 deploy, the brand URL is documented but not yet resolving — acceptable risk because the only doc reader during that window is the maintainer (per Tech Plan Critical Constraints).

## Scope

### 1. Modify `file:skills/gymlogic-mcp/SKILL.md`

Three line edits, verified by `rg -i "nine\s+(tool|read)" skills/`:

| Line | Before | After |
|---|---|---|
| 13 | `each of the **nine tools** (seven reads, two writes)` | `each of the **ten tools** (eight reads, two writes)` |
| 57 | `https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp` | `https://mcp.gymlogic.me/functions/v1/mcp` |
| 60 | `All nine tools 401 if no auth context.` | `All ten tools 401 if no auth context.` |

Line 66 ("Ten tools total — eight reads, two writes") is **already correct** — leave it.

### 2. Modify `file:docs/mcp-connect/claude-desktop.md`

URL substitution: every `https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp` → `https://mcp.gymlogic.me/functions/v1/mcp`.

Pay attention to:
- The "Add custom connector" example URL block.
- Any `mcp-remote` JSON config snippets in the PAT alternative section (the URL appears inside the `args` array).
- Any "if your URL is …" troubleshooting copy.

After edit: `rg "favusepjqwpcroiolvaz" docs/mcp-connect/claude-desktop.md` should return 0 hits.

### 3. Modify `file:docs/mcp-connect/cursor.md`

URL substitution (same pattern). Cursor's MCP config goes in `~/.cursor/mcp.json`; verify the JSON example block reflects the brand URL.

### 4. Modify `file:docs/mcp-connect/le-chat.md`

URL substitution (same pattern).

### 5. Modify `file:docs/mcp-connect/openclaw.md`

URL substitution (same pattern).

### 6. Modify `file:docs/mcp-connect/example-prompts.md`

Verify and substitute if any URL appears. The file is probably URL-free (it's prompt examples), but check via `rg "supabase.co" docs/mcp-connect/example-prompts.md`.

### 7. Final sanity grep

After all 6 file edits land in the same commit:

```bash
rg "favusepjqwpcroiolvaz" docs/ skills/
# Expected: ONE hit, in docs/adr/0001-mcp-public-url-and-oauth-issuer.md
# (intentional glossary reference; do NOT change it).

rg -i "nine\s+(tool|read)" skills/
# Expected: 0 hits.
```

If either grep returns unexpected hits, fix and re-run before committing.

## Out of Scope

- `docs/Tech_Plan_—_A4_Connect_Claude_#302.md` — that's a planning doc for #302, will pick up the new URL on rebase per Tech Plan Critical Constraints. **Tag the #302 implementer in the PR description so they don't ship a stale URL in the MDX.**
- `web/src/content/connect/claude.mdx` — does not exist yet (#302 unblocks once this lands); will be authored against `mcp.gymlogic.me` from inception.
- The legacy `*.supabase.co` URL in `docs/adr/0001-*.md` — intentional glossary reference; **leave it**.
- Any internal/dev docs (e.g. `README.md`, deploy runbooks) — separate ticket if needed; user-facing surfaces only here.
- The MCP server's `description` field returned in the `initialize` response — not user-facing prose, no URL there.

## Acceptance Criteria

- [ ] `skills/gymlogic-mcp/SKILL.md` lines 13, 57, 60 fixed per the table above; line 66 unchanged.
- [ ] All 5 `docs/mcp-connect/*.md` files updated where applicable.
- [ ] `rg "favusepjqwpcroiolvaz" docs/ skills/` returns exactly 1 hit (the ADR 0001 reference).
- [ ] `rg -i "nine\s+(tool|read)" skills/` returns 0 hits.
- [ ] Demoable: open `skills/gymlogic-mcp/SKILL.md` in the IDE; visually confirm the URL on line 57 is the brand domain and the prose on line 13 says "ten tools".
- [ ] PR description tags the #302 implementer with a note about URL rebase.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Track A3, story 15)
- Tech Plan: `file:docs/Tech_Plan_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Modified Files: SKILL.md row, mcp-connect rows; Implementation Notes commit 4 with sanity grep)
- ADR: `file:docs/adr/0001-mcp-public-url-and-oauth-issuer.md` (Follow-ups section)
- Code anchors: `file:skills/gymlogic-mcp/SKILL.md`, `file:docs/mcp-connect/`
- Related epic: #302 (`file:docs/Tech_Plan_—_A4_Connect_Claude_#302.md` — line 525 of that doc hardcodes the Supabase URL; will rebase pickup)
