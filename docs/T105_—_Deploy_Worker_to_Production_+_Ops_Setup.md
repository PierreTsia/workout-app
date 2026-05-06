# T105 — Deploy Cloudflare Worker to Production + Ops Setup

## Goal

Take the Worker code shipped by T102 (in PR #322) live at `https://mcp.gymlogic.me/functions/v1/mcp`. This ticket is the post-merge ops work: `wrangler deploy` from the maintainer's machine, Cloudflare custom-domain TLS provisioning wait, dashboard env-var configuration (`KILL_SWITCH` declared but unset), GitHub branch protection rule rename (`web-checks-passed` → `subproject-checks-passed`), and a full smoke pass — including a fresh Claude Desktop install pointing at the brand URL to verify the OAuth flow completes end-to-end.

After this ticket: every downstream HITL ticket in this epic (T106 test account, T108 connector submission, T109 MCP Inspector pass) becomes unblocked.

Addresses Epic Brief stories **2, 8, 9, 13, 14**: brand domain live, URL legitimacy in non-Claude clients, existing-user backward compat verified, kill switch reachable, future Supabase migration is now invisible.

## Mode

**HITL** — TLS provisioning is wall-clock-bound (5-15 min); Cloudflare dashboard configuration is admin UI work; OAuth smoke requires a real Claude Desktop install; branch protection rule edit requires repo-admin permissions on GitHub.

## Slice

`wrangler login (one-time)` → `wrangler deploy` → `Cloudflare dashboard config` → `wait for TLS` → `curl smoke (both URLs)` → `Claude Desktop install + OAuth flow` → `GitHub branch protection rule rename`

Ops-only — no code changes in this ticket.

## Dependencies

- **T100** + **T101** + **T102** all merged to `main` — the function reads `X-Forwarded-Host` (T101) and the Worker stamps it (T102), with annotations live (T100). Without T101, the Worker "works" but `.well-known` still advertises the Supabase URL.
- **T103** (docs URL sweep) merged so the brand URL is consistent across docs by the time we deploy.
- Cloudflare account with admin access to the `gymlogic.me` zone (already managed per `file:docs/done/T55_—_Resend_Cloudflare_DNS_&_Domain_Setup_(No-Code).md`).
- GitHub repo-admin access for the branch protection rule edit.
- A working Claude Desktop install on the maintainer's machine.

## Scope

### 1. Wrangler authentication + first deploy

```bash
cd infra/cloudflare/mcp-proxy
npm ci
npx wrangler login   # opens browser, one-time
npx wrangler deploy
```

Expected output: deploy succeeds, Worker URL logged (e.g. `https://gymlogic-mcp-proxy.<account-subdomain>.workers.dev`).

### 2. Cloudflare dashboard — custom domain + env var setup

Navigate to **Workers & Pages → gymlogic-mcp-proxy**.

**(a) Custom domain** (should auto-bind from `wrangler.toml`):

- Verify under **Triggers → Custom Domains**: `mcp.gymlogic.me` listed with status `Active`.
- If not auto-bound, click **Add Custom Domain → mcp.gymlogic.me**.
- **Wait 5-15 minutes** for TLS cert provisioning. The status will be `Pending` initially.

**(b) Environment variable: KILL_SWITCH**:

- Navigate to **Settings → Variables**.
- Add a new variable: `Name: KILL_SWITCH`, `Value: ` (empty), Type: **plaintext** (NOT secret — needs to be flippable without redeploy).
- Save. The variable now exists; setting it to `"true"` later will activate the kill switch within ~60s.

### 3. TLS provisioning wait — verification

Poll until ready:

```bash
curl -I https://mcp.gymlogic.me/functions/v1/mcp
# Initially: SSL handshake error or 522.
# After ~5-15 min: HTTP 200 / 405 (depending on method) with valid Cloudflare SSL.
```

Do **not** proceed to step 4 until TLS is provisioned.

### 4. Smoke tests — both URLs return identical responses

```bash
TEST_PAT="<your test PAT, fetched from /account/api-tokens>"

# tools/list against both URLs — should return identical tool arrays
for url in \
  "https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp" \
  "https://mcp.gymlogic.me/functions/v1/mcp"; do
  echo "=== $url ==="
  curl -s -X POST "$url" \
    -H "Authorization: Bearer $TEST_PAT" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
    | jq '.result.tools | map({name, annotations})'
done
# Expected: identical output on both URLs.

# .well-known/oauth-protected-resource — each URL should advertise itself
for url in \
  "https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp" \
  "https://mcp.gymlogic.me/functions/v1/mcp"; do
  echo "=== $url ==="
  curl -s "$url/.well-known/oauth-protected-resource" | jq '.resource'
done
# Expected:
#   "https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp"
#   "https://mcp.gymlogic.me/functions/v1/mcp"
```

If `.well-known/oauth-protected-resource.resource` does NOT reflect the host being curled against, the `X-Forwarded-Host` header is being dropped somewhere — switch to a custom header name like `X-MCP-Forwarded-Host` (rename in both Worker and function). See Tech Plan Failure Mode "X-Forwarded-Host header dropped in transit".

### 5. End-to-end OAuth flow via Claude Desktop

1. **Remove** any existing GymLogic connector from Claude Desktop (Settings → Connectors → click GymLogic → Remove).
2. **Add Custom Connector** → URL: `https://mcp.gymlogic.me/functions/v1/mcp` → Name: `GymLogic`.
3. Click "Add" → Claude Desktop opens browser to the OAuth flow.
4. **Verify**: browser hits `gymlogic.me/oauth/consent` (or `*.supabase.co/auth/v1/authorize` redirecting through it), user accepts, browser redirects back to Claude Desktop, connector shows `Connected` status.
5. **Test a tool call**: open a chat, click the hammer icon, confirm 10 tools listed (including `resolve_exercises`), each with the new `annotations.title` visible. Invoke `search_exercises` with a known query — verify a meaningful response.

If anything fails: flip `KILL_SWITCH=true` in Cloudflare dashboard (kills POST but leaves OAuth metadata GETs alive), investigate, redeploy if needed.

### 6. GitHub branch protection rule rename

Navigate to **GitHub → Repository → Settings → Branches → main → Edit protection rule**.

Find the required check `web-checks-passed` and:
- Remove `web-checks-passed`.
- Add `subproject-checks-passed`.

Save. Verify by reopening the protection rule — only `subproject-checks-passed` should appear in the required-checks list (no `web-checks-passed`).

This is necessary because T102's CI changes renamed the aggregator job. PRs that landed before T102's merge used `web-checks-passed`; PRs after use `subproject-checks-passed`. The rule rename closes the gap.

### 7. Document the deploy

Add a short note to the PR description (or open a follow-up comment on PR #322) capturing:
- Deploy timestamp
- Worker version ID (from `wrangler deploy` output)
- Smoke test results (paste curl outputs)
- Any anomalies observed

Updating the runbook (if you have one): no formal runbook today; this ticket's scope section IS the runbook for future re-deploys.

## Out of Scope

- Auto-deploy CI/CD for the Worker — explicitly out per Tech Plan (Q10 grilling). Manual deploy stays the convention.
- Kill switch flip drill — separate manual one-off; verify the runbook works at a less stressful moment.
- Migrating existing user PATs to the brand URL — PATs aren't URL-bound; same PAT works on both URLs.
- Updating user-facing comms about the URL change — current users (≈ maintainer + 0-1 beta testers) get a heads-up via Slack/DM rather than a formal announcement.

## Acceptance Criteria

- [ ] `wrangler deploy` succeeded; Worker version logged in PR description.
- [ ] `mcp.gymlogic.me` resolves with valid TLS cert (Cloudflare-issued).
- [ ] `KILL_SWITCH` env var declared in Cloudflare dashboard (empty value initially).
- [ ] Smoke test 4: `tools/list` returns identical responses on both URLs.
- [ ] Smoke test 4: `.well-known/oauth-protected-resource.resource` correctly reflects each host.
- [ ] Smoke test 5: fresh Claude Desktop install pointing at `mcp.gymlogic.me` completes OAuth and lists 10 tools with annotations.
- [ ] GitHub branch protection rule updated: `subproject-checks-passed` is required, `web-checks-passed` removed.
- [ ] PR description (or follow-up comment) documents deploy details + smoke results.
- [ ] Demoable: install GymLogic in a colleague's Claude Desktop using only `mcp.gymlogic.me` (no Supabase URL fallback needed) → success.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Track A2.3, success criteria)
- Tech Plan: `file:docs/Tech_Plan_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Implementation Notes "First Worker deploy", smoke test commands; Failure Mode Analysis: TLS provisioning, custom-domain binding, `X-Forwarded-Host` dropping)
- ADR: `file:docs/adr/0001-mcp-public-url-and-oauth-issuer.md`
- Predecessor work: T55 (DNS/Cloudflare for `gymlogic.me` zone — `file:docs/done/T55_—_Resend_Cloudflare_DNS_&_Domain_Setup_(No-Code).md`)
- Cloudflare docs: [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [Environment Variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- Code anchors: `file:infra/cloudflare/mcp-proxy/wrangler.toml` (deploy target config)
