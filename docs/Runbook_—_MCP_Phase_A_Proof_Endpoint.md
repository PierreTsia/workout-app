# Runbook — MCP Phase A Proof Endpoint

Manual verification path for the Phase A proof endpoint
(`supabase/functions/mcp-phase-a-proof/`). Lets a maintainer prove, in one
copy/paste session, that GymLogic Edge Functions can act as an MCP client
against our own MCP server using a real user's Supabase JWT.

> **Phase A is preview-only.** The endpoint hard-rejects any
> `dry_run:false` request with HTTP 400 server-side. There is no path
> through this endpoint that writes to the database.

---

## Pre-flight

You need:

- The `supabase` CLI logged into the project
- A real GymLogic user account (so you can grab a JWT)
- `curl` and `jq`

### Deploy the function (once per change)

```bash
supabase functions deploy mcp-phase-a-proof --project-ref favusepjqwpcroiolvaz
```

The function picks up its MCP target via env vars:

- `MCP_URL` — explicit override (use this for staging/local MCP)
- otherwise it derives `${SUPABASE_URL}/functions/v1/mcp` automatically

If you want to point at a different MCP, set it before deploying:

```bash
supabase secrets set MCP_URL=https://my-staging-mcp.example/functions/v1/mcp \
  --project-ref favusepjqwpcroiolvaz
```

### Get a fresh user Bearer token

1. Open `https://gymlogic.me`, sign in.
2. DevTools → Application → Local Storage → find the `sb-*-auth-token` key.
3. Copy the `access_token` value. Export it for convenience:

```bash
export GYMLOGIC_TOKEN="eyJhbGciOi..."   # the access_token, NOT the refresh_token
export GYMLOGIC_PROOF_URL="https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp-phase-a-proof"
```

---

## Smoke 1 — Chain proof (no UUID lookup needed)

The cheapest smoke. Sends an empty `exercises` array, which `create_program`
will (correctly) reject with a validation message. The 422 round-trip
proves auth → persist guard → MCP transport → tool call → error mapping in
one shot, with no setup.

```bash
curl -s -X POST "$GYMLOGIC_PROOF_URL" \
  -H "Authorization: Bearer $GYMLOGIC_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-request-id: smoke_chain_$(date +%s)" \
  -d '{"name":"Phase A Chain","days":[{"label":"Push","exercises":[]}]}' \
  | jq .
```

**Expected (HTTP 422):**

```json
{
  "error": "tool_error",
  "message": "Invalid input: days[0].exercises must be a non-empty array."
}
```

That 422 is **the proof**. Anything else means a layer is broken:

- `401` → auth failed (token expired? wrong copy?)
- `502 transport_error` → couldn't reach MCP at all (`MCP_URL` config?)
- `502 rpc_error` → MCP responded but with a JSON-RPC envelope error (protocol mismatch?)
- `200` → `create_program` started accepting empty arrays without validation; that's an MCP bug, not ours

---

## Smoke 1b — Real preview (200 with snapshots)

Resolves a real exercise UUID via the existing `resolve_exercises` MCP
tool, then sends a 1-day, 1-exercise `create_program` dry-run. Proves the
success path returns a structured preview with catalog snapshots applied.

```bash
EXERCISE_ID=$(curl -s -X POST https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp \
  -H "Authorization: Bearer $GYMLOGIC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"resolve_exercises","arguments":{"queries":["bench press"]}}}' \
  | jq -r '.result.content[0].text' \
  | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
  | head -n 1)

[ -z "$EXERCISE_ID" ] && { echo "no UUID — try squat or pull up"; return; }
echo "Resolved → $EXERCISE_ID"

curl -s -X POST "$GYMLOGIC_PROOF_URL" \
  -H "Authorization: Bearer $GYMLOGIC_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-request-id: smoke_real_$(date +%s)" \
  -d "{\"name\":\"Phase A Real Smoke\",\"days\":[{\"label\":\"Push\",\"exercises\":[\"$EXERCISE_ID\"]}]}" \
  | jq .
```

**Expected (HTTP 200):**

The body is `{ "content": [ { "type": "text", "text": "<JSON preview>" } ] }`.
Pretty-print the inner text with `jq -r '.content[0].text' | jq .` — you
should see:

- `dry_run: true` echoed back from MCP
- A `program` object with the name you sent
- A `days[].workout_exercises[]` entry with **real catalog snapshots**
  (`name_snapshot`, `muscle_snapshot`, `emoji_snapshot`)
- Default prescription applied: 3×10 × 0 kg × 90s rest
- Progression bounds (`rep_range_min/max`, `set_range_min/max`)
- A `note` from MCP saying "Re-call with dry_run false to persist."

> **Verify nothing was persisted.** Check your account in the app — no
> new "Phase A Real Smoke" program. If one appears, the `dry_run` guarantee
> is broken at the MCP layer (file a P0 against `create_program`, not this
> endpoint).

The success path emits **no** logs by design — silent success means the
chain worked.

---

## Smoke 2 — Persist attempt rejected (the Phase A guarantee)

```bash
curl -s -i -X POST "$GYMLOGIC_PROOF_URL" \
  -H "Authorization: Bearer $GYMLOGIC_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-request-id: smoke_persist_$(date +%s)" \
  -d '{ "name": "Should Not Persist", "dry_run": false }'
```

**Expected:**

- HTTP `400`
- Body `{"error":"persist_not_allowed"}`
- A structured log event in Supabase function logs:
`{"level":"error","feature":"mcp-phase-a-proof","error_kind":"persist_not_allowed","request_id":"smoke_persist_...","user_id":"<your-uuid>"}`

If you get a 200 here, **stop**. The persist guard is broken.

---

## Smoke 3 — Auth required

```bash
curl -s -i -X POST "$GYMLOGIC_PROOF_URL" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:**

- HTTP `401`
- Body `{"error":"missing_authorization"}`
- Log event with `error_kind=auth_missing`, no `user_id`.

```bash
curl -s -i -X POST "$GYMLOGIC_PROOF_URL" \
  -H "Authorization: Bearer not-a-real-jwt" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:**

- HTTP `401`
- Body `{"error":"invalid_session"}`
- Log event with `error_kind=invalid_session`, no `user_id`.

---

## Where to find the structured logs

Supabase Dashboard → Edge Functions → `mcp-phase-a-proof` → Logs.

Each failure path emits a single-line JSON event with these fields:


| Field        | Always present           | Notes                                                                                                          |
| ------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `ts`         | yes                      | ISO timestamp                                                                                                  |
| `level`      | yes                      | `"error"` (Phase A) — `"warn"` reserved for Phase B                                                            |
| `feature`    | yes                      | always `"mcp-phase-a-proof"`                                                                                   |
| `error_kind` | yes                      | one of: `auth_missing`, `invalid_session`, `persist_not_allowed`, `tool_error`, `rpc_error`, `transport_error` |
| `request_id` | yes                      | echoes the `x-request-id` header if you sent one, otherwise a server-generated UUID                            |
| `user_id`    | only after auth succeeds | absent on `auth_missing`/`invalid_session`                                                                     |
| `message`    | only for MCP errors      | the underlying tool/RPC/transport message                                                                      |


The success path emits **no** logs. Silent success is a feature: if you see
no log for a `request_id` you sent, the call worked.

---

## Common failure modes


| HTTP | `error` body field       | Meaning                                                           | Look at                                                             |
| ---- | ------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| 401  | `missing_authorization`  | No Bearer header                                                  | The `Authorization: Bearer ...` line                                |
| 401  | `invalid_session`        | JWT did not pass `auth.getUser()`                                 | Token expired or copy-pasted wrong (refresh_token vs access_token)  |
| 400  | `persist_not_allowed`    | Body sent `dry_run:false`                                         | This is by design. Phase A cannot persist.                          |
| 422  | `tool_error`             | MCP `create_program` rejected the input                           | The `message` field tells you why (missing exercises, bad shape, …) |
| 502  | `rpc_error`              | MCP returned a JSON-RPC level error (method not found, malformed) | Usually means the MCP server is on a different protocol version     |
| 502  | `transport_error`        | Could not reach MCP at all                                        | Check `MCP_URL` and the MCP function's own logs                     |
| 500  | `mcp_url_not_configured` | Neither `MCP_URL` nor `SUPABASE_URL` env var present              | Wrapper-level — should not happen on a normal Supabase deploy       |
| 405  | `Method not allowed`     | You used `GET` (or anything but `POST`/`OPTIONS`)                 | Use `POST`                                                          |


---

## What this proves (and what it doesn't)

**Proves:**

- Edge Functions can call our MCP server with a user JWT and get a typed response
- Persist is impossible from this endpoint by construction (server-enforced `dry_run:true`)
- Failure paths are observable via structured logs

**Does not prove:**

- That the Embedded Agent UX works end-to-end (Phase B / #336)
- That MCP `create_program` produces good drafts (covered by the MCP test suite + Phase B happy-path tests)
- That quota enforcement is in place (Phase B owns quota — this endpoint is unmetered)

