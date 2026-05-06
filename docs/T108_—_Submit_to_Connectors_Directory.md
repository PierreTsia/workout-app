# T108 — Submit MCP Server to Anthropic Connectors Directory

## Goal

File the connector submission at `clau.de/mcp-directory-submission` with all required fields, including the optional Allowed Link URIs (`https://gymlogic.me`, `https://www.gymlogic.me`) so links inside tool responses skip Claude's external-link confirm prompt.

After this ticket: GymLogic is in Anthropic's review queue. Approval is reactive (variable wall-clock; D2 ops checklist tracks the dashboard).

Addresses Epic Brief stories **1, 7, 12** + Tracks **A8 + A9**.

## Mode

**HITL** — manual UI form fill; impossible to automate.

## Slice

`form fill at clau.de/mcp-directory-submission` → `submission ID + confirmation email` → `note in private maintainer log`

## Dependencies

- **T104** (privacy policy MCP disclosure) merged + deployed — the submission form's privacy URL field needs `https://www.gymlogic.me/privacy` to be content-complete.
- **T105** (Worker deployed) — the submitted server URL is `https://mcp.gymlogic.me/functions/v1/mcp`; this MUST resolve.
- **T106** (test account seeded with PAT) — supplies the test credentials field.
- **T107** (branding assets) — supplies logo + screenshots.
- **T109** (MCP Inspector pass) — pre-empts reviewer findings; ship with confidence.
- (Soft) **#302** A4 page deployed at `https://docs.gymlogic.me/connect/claude` — Anthropic's docs URL field. If #302 hasn't shipped, fall back to `https://www.gymlogic.me` root and add a note.

## Scope

### 1. Pre-submission checklist

Verify ALL of:

- [ ] `https://mcp.gymlogic.me/functions/v1/mcp` returns valid OAuth metadata (`curl /.well-known/oauth-protected-resource` returns proper JSON with `resource: https://mcp.gymlogic.me/...`).
- [ ] `https://www.gymlogic.me/privacy` renders the new MCP disclosure paragraph.
- [ ] `https://docs.gymlogic.me/connect/claude` returns 200 (or fallback URL ready).
- [ ] Test account credentials + PAT in password manager.
- [ ] Logo URL + favicon URL + 2-3 screenshots ready (per T107).
- [ ] T109 inspector pass cleared without significant red flags.

### 2. Open the submission form

Navigate to https://clau.de/mcp-directory-submission (also https://claude.com/docs/connectors/building/submission).

### 3. Form field mapping

Fill out all fields. Likely fields (verify against the live form — Anthropic may iterate):

| Field | Value | Source |
|---|---|---|
| Connector name | `GymLogic` | Brand |
| Server URL | `https://mcp.gymlogic.me/functions/v1/mcp` | T105 deploy |
| OAuth issuer / authorization server | (auto-discovered via `.well-known`; if asked explicitly: the URL the function advertises in `authorization_servers[0]`) | Per ADR 0001, this is `${SUPABASE_URL}/auth/v1` — partial domain match, acknowledged risk |
| Description (short, ~100 chars) | "Personalized strength training co-pilot. Build programs, log workouts, track progress with Claude as your coach." | Polish during fill |
| Description (long, ~500 chars) | Highlight: 10 tools (8 read + 2 write), OAuth + PAT auth, propose-confirm-act handshake on writes, dry-run preview for new programs, idempotent updates | Use `skills/gymlogic-mcp/SKILL.md` intro as raw material |
| Privacy policy URL | `https://www.gymlogic.me/privacy` | T104 |
| Documentation URL | `https://docs.gymlogic.me/connect/claude` (fallback: `https://www.gymlogic.me`) | #302 |
| Logo | URL or file upload | T107 |
| Screenshots | 2-3 WebP files / URLs | T107 |
| **Allowed Link URIs** (optional) | `https://gymlogic.me`, `https://www.gymlogic.me` | Skips Claude's external-link confirm prompt for in-chat links to these hosts (story 12) |
| Test credentials / how to test | T106 snippet (account + OAuth) + offer to share PAT via secure channel | T106 |
| Contact email | `admin@gymlogic.me` | Per privacy policy |

### 4. Submit + capture confirmation

- Click Submit.
- **Screenshot the confirmation page** (submission ID, expected review timeline if shown).
- Confirmation email should arrive at `admin@gymlogic.me` within minutes.
- If no email after 30 min: check spam; if still nothing, document the lack of confirmation and proceed (the dashboard at `claude.com/dashboard/connectors` should show pending status).

### 5. Document the submission

Add to maintainer's private log:

```
Submission date: <YYYY-MM-DD>
Submission ID: <from confirmation page>
Form URL used: clau.de/mcp-directory-submission
Confirmation email received: yes/no
Dashboard URL: <link to Anthropic dashboard if accessible>
Allowed Link URIs declared: gymlogic.me, www.gymlogic.me
Description used (long): <paste verbatim>
```

This feeds D2 ops checklist (tracking) and T112 (post-approval doc update).

## Out of Scope

- Plugin Directory submission — separate (T111).
- Marketing announcement post-submission — wait for approval.
- Following up if review stalls past 3 weeks — that's D2 (informal ops, not a ticket).
- Re-submitting if rejected — would be a new ticket triggered by the rejection.

## Acceptance Criteria

- [ ] Pre-submission checklist passed (all 6 items verified).
- [ ] Form filled at https://clau.de/mcp-directory-submission with all required fields.
- [ ] Allowed Link URIs (`https://gymlogic.me`, `https://www.gymlogic.me`) declared.
- [ ] Submission confirmation captured (screenshot + email).
- [ ] Submission log entry saved in password manager / private notes.
- [ ] Demoable: paste the submission ID + Anthropic dashboard URL; reviewer can see "GymLogic — pending review" in the queue.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Track A8 + A9, stories 1, 7, 12)
- Tech Plan: `file:docs/Tech_Plan_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Implementation Notes → Deferred ticket scope: A8 + A9)
- ADR: `file:docs/adr/0001-mcp-public-url-and-oauth-issuer.md` (partial domain match acknowledgement)
- Anthropic submission form: https://clau.de/mcp-directory-submission
- Anthropic review criteria: https://claude.com/docs/connectors/building/review-criteria
- Predecessor tickets: T104, T105, T106, T107, T109
- Skill (raw material for description): `file:skills/gymlogic-mcp/SKILL.md`
