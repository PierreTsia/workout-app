# ADR 0028 — A view asks, the host arbitrates: view intention and the consent token

- **Status:** Accepted
- **Date:** 2026-10-04
- **Decided in:** grill + autopilot review for [#643](https://github.com/PierreTsia/workout-app/issues/643)
- **Amends:** ADR [0027](https://github.com/PierreTsia/workout-app/blob/main/docs/adr/0027-agentic-view-contract.md) §3 (a view never writes), ADR [0023](https://github.com/PierreTsia/workout-app/blob/main/docs/adr/0023-jev-verdicts-only-embedded-agent.md) (signed token rejected)

## Context

[#591](https://github.com/PierreTsia/workout-app/issues/591) shipped a read-only **MCP App View** (the **Session Card**). [#643](https://github.com/PierreTsia/workout-app/issues/643) opens the action: an agent proposes a program patch, the human validates **in the conversation**.

SEP-1865 gives a view two ways to reach the host: **`tools/call`** (the host proxies the call to the MCP server; a tool can be app-only via `_meta.ui.visibility: ["app"]`) and **`ui/message`** (the view sends a user turn; the model re-issues the call). Crucially, `visibility` is **host-enforced**, not server-enforced: a non-compliant host that ignores it exposes an app-only tool to the model, and the model writes without a click.

ADR 0027 §3 states "a view never writes". ADR 0023 rejected a **signed consent token** as heavier than a stored-preview echo — but that rejection was argued for the **model** two-call shape (`dry_run:true` then `dry_run:false` in the model's own turn), where an echo exists to match.

## Decision

We will:

1. **A view never writes *directly*.** It asks the host to call a tool (`tools/call`); the host arbitrates. The **user's click is the consent**.
2. **First vertical: `update_program`.** `dry_run:true` returns a **Decision Card** plus a server-signed **Preview Token**; the dedicated **`apply_program_patch`** tool (`_meta.ui.visibility: ["app"]`) requires that token. The token carries the **exact previewed patch** — what was shown is what applies, by construction.
3. **The token is the server guard** the host's `visibility` cannot provide. It rides `structuredContent` (SEP-1865: outside model context), so even a non-compliant host that exposes `apply_program_patch` cannot give the model a token it never sees. `visibility:["app"]` stays as defence in depth.
4. **Two consent roads** (amends **Write Consent**, ADR 0023): (a) the classic model echo + **Jev** Noul; (b) the view click + signed token. The token is not a forbidden "second concept" — it is the material proof of the click.
5. **`update_program{dry_run:false}` stays.** No propose-only in v1: Cursor / Le Chat / Iris are not MCP Apps hosts and would lose program editing. The claim "the model cannot self-apply" is **#287's**, not this epic's — this epic adds an *enforced path for the card*, it does not close #287 for non-Apps clients.

## Contradictions named

- **ADR 0023 §Alternatives** rejected the signed token. Reopened **for the view path only**: there is no model echo to match, and a stored-preview echo needs an authenticated caller to echo against — the token binds payload + user + expiry in one stateless string. The stored-preview echo remains the **model** path's future (#287), not replaced.
- **ADR 0027 §3** "never writes" is narrowed to "never writes *directly*"; the v1 Session Card stays read-only.

## Consequences

- **Positive:** the card path is enforced **server-side**, independent of host compliance; no database, no session state (Edge stays stateless); the protocol is the standard `tools/call`, not a bespoke bridge. The same `update_program` validation / diff / apply is reused — no duplicate write path.
- **Negative:** the patch travels base64url in the token — **signed, not encrypted**; acceptable because a program is not secret and tampering breaks the HMAC. Replaying a token within its TTL re-applies an **idempotent** patch. The model path (non-Apps hosts) remains unenforced — documented, tracked by #287.
- **Follow-ups:** generalise propose-only to `create_program` / `create_workout_day` only with MCP Apps capability negotiation (the server is stateless per request today); audit the doc blast radius (`README.md`, `docs/mcp-connect/*`) so nothing teaches a flow the server rejects.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **Rely on `visibility:["app"]` alone** | Host-enforced; a non-compliant host exposes the apply to the model, which writes without a click — violates the write-consent invariant. |
| **`ui/message` + the model re-issues the apply** | The echo is not guaranteed (drift); it needs a server guard anyway, and it keeps the model in the write loop. |
| **Make `update_program` propose-only globally** | Breaks every non-MCP-Apps client (Cursor, Le Chat, Iris) — loses program editing with no capability to gate on. |
| **Stored-preview echo (ADR 0023's model-path pick)** | Needs an authenticated caller to match the echo against; the view path has no model echo — the token is the lighter stateless equivalent. |
| **No token, digest computed at apply** | The digest is not signed; a caller could present a matching payload that was never previewed. The signed token *is* the server's proof a preview happened. |
