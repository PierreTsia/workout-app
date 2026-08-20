# T111 — Validate + Submit Plugin to Plugins Directory

## Goal

Final `claude plugin validate` pass against the packaged plugin from T110, then submit at `claude.com/plugins/submit` with cross-reference to the connector listing (T108). After this ticket: GymLogic appears in **both** Anthropic directories — Connectors and Plugins — installable in one click for either flow.

Addresses Epic Brief story **6** + Tracks **B2 + B3**.

## Mode

**HITL** — manual form fill. Validation step is mechanical but submission is UI-bound.

## Slice

`final claude plugin validate (against latest plugin code)` → `submission form at claude.com/plugins/submit` → `cross-reference connector listing` → `confirmation captured`

## Dependencies

- **T110** (plugin packaged + validates locally).
- **T108** (connector submission filed) — the plugin form has an "optional Skill" / "linked connector" field that takes the connector listing URL or ID. If T108 hasn't been approved yet, you can still submit the plugin with a "Pending: see directory submission ID <X>" reference.

## Scope

### 1. Final `claude plugin validate`

Run against the current plugin tip:

```bash
cd <plugin-root>   # plugins/gymlogic-claude OR PierreTsia/gymlogic-claude-plugin per T110 decision
claude plugin validate
```

Should be clean. If anything fails: fix in T110's repo, push, re-run.

### 2. Open submission form

Navigate to https://claude.com/plugins/submit (verify URL — Anthropic may iterate).

### 3. Form field mapping

Likely fields (verify against the live form):

| Field | Value | Source |
|---|---|---|
| Plugin name | `gymlogic-mcp` | `claude.json` manifest |
| Plugin repo URL | `https://github.com/PierreTsia/<repo>` (subfolder OR top-level per T110 choice) | T110 |
| Description | Same long description as connector submission (T108) — keep messaging consistent | T108 |
| Plugin version | `1.0.0` (matches manifest) | T110 |
| Linked connector / cross-reference | Connector submission ID from T108 OR the directory URL once approved | T108 |
| Author | Pierre Tsiakkaros, https://www.gymlogic.me | Maintainer |
| Logo | Same as T107 | T107 |
| Category / tags | Fitness, Health, Training, Productivity | Judgment |

### 4. Submit + capture confirmation

- Click Submit.
- Screenshot confirmation page.
- Confirmation email to `admin@gymlogic.me`.
- Note submission ID.

### 5. Document the submission

Add to maintainer's private log (alongside T108's connector log):

```
Plugin submission date: <YYYY-MM-DD>
Plugin submission ID: <from confirmation>
Plugin repo: <URL>
Plugin version: 1.0.0
Linked connector: <T108 submission ID>
Form URL used: claude.com/plugins/submit
```

This feeds D2 ops checklist (tracking) and T112 (post-approval doc updates may need to acknowledge plugin too).

## Out of Scope

- Any plugin code changes — T110 is the code surface.
- Marketing announcement — wait for both approvals.
- Plugin updates / versioning — separate ticket if/when v1.1 ships.

## Acceptance Criteria

- [ ] Final `claude plugin validate` passes against latest plugin tip.
- [ ] Submission form filled at https://claude.com/plugins/submit with all required fields.
- [ ] Linked-connector cross-reference populated (T108 ID or URL).
- [ ] Submission confirmation captured (screenshot + email).
- [ ] Plugin submission log entry saved alongside connector log in private notes.
- [ ] Demoable: paste plugin submission ID; verify it appears in Anthropic plugin dashboard as "pending review".

## References

- Epic Brief: `file:docs/Epic_Brief_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Tracks B2 + B3, story 6)
- Tech Plan: `file:docs/Tech_Plan_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Implementation Notes → Deferred ticket scope: B2 + B3)
- Anthropic plugin submission: https://claude.com/plugins/submit
- Predecessor: T110 (plugin packaging), T108 (connector submission)
