# T102 — Cloudflare Worker Proxy Package + CI Worker-Unit Job

## Goal

Add the public-URL frontend at `mcp.gymlogic.me` as an isolated Cloudflare Worker package at `infra/cloudflare/mcp-proxy/`. The Worker is a near-pure passthrough: forwards every request to the Supabase Edge Function, stamps `X-Forwarded-Host` so the function (via T101's helper) can rewrite OAuth metadata, and exposes a dashboard-flippable `KILL_SWITCH` env var that returns `503` for **POST requests only** (kills MCP RPC; lets `.well-known/*` GETs through so OAuth metadata stays accessible during incident triage). Plus the matching CI gate so future passthrough/kill-switch regressions don't ship silently.

This ticket ships the **code**, not the deployment. Actual `wrangler deploy` + custom domain TLS provisioning happens in T105 post-merge.

Addresses Epic Brief stories **2, 8, 9, 13, 14**: brand domain, URL legitimacy, backward compat, kill switch, future migration invisibility.

**Position in PR**: commit 3 of 5 on `feat/296/publish-mcp-connectors-directory`.

## Mode

**AFK** — Worker shape (passthrough + kill switch + log), env model (`UPSTREAM_URL` in wrangler.toml, `KILL_SWITCH` in dashboard), kill switch semantics (POST-only), test framework (vanilla vitest, not pool-workers), and CI integration (paths-filter pattern mirroring `web-type-check`) are all pinned in the Tech Plan + ADR 0001.

## Slice

`infra/cloudflare/mcp-proxy/{wrangler.toml, package.json, tsconfig.json}` → `src/index.ts (~50 LOC fetch handler)` → `src/index.test.ts (vitest, ~5 cases)` → `.github/workflows/ci.yml (changes filter, worker-unit job, web-checks-passed → subproject-checks-passed rename)`

End-to-end demoable (locally, no production deploy yet): `cd infra/cloudflare/mcp-proxy && npm install && npx wrangler dev` proxies localhost:8787 → production Supabase function URL with `X-Forwarded-Host` stamped.

## Dependencies

- **T101** — the function side reads `X-Forwarded-Host` via `getPublicMcpUrl(req, ...)`. Without T101, the Worker stamps the header but the function ignores it; the brand URL "works" but `.well-known` still advertises `*.supabase.co`. T101 must merge before this ticket's smoke test passes meaningfully.

## Scope

### 1. New file — `infra/cloudflare/mcp-proxy/wrangler.toml`

```toml
name = "gymlogic-mcp-proxy"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[[routes]]
pattern = "mcp.gymlogic.me/*"
custom_domain = true

[vars]
UPSTREAM_URL = "https://favusepjqwpcroiolvaz.supabase.co"
```

**Critical**: do NOT add `KILL_SWITCH` to `[vars]`. It must be set as a runtime variable via the Cloudflare dashboard (Settings → Variables) so it can be flipped without redeploying. See ADR 0001 + Tech Plan Key Decisions row "Worker env var management".

### 2. New file — `infra/cloudflare/mcp-proxy/package.json`

| Field | Value |
|---|---|
| `name` | `"gymlogic-mcp-proxy"` |
| `private` | `true` |
| `type` | `"module"` |
| `scripts` | `dev: "wrangler dev"`, `deploy: "wrangler deploy"`, `test: "vitest run"`, `test:watch: "vitest"` |
| `devDependencies` | `wrangler` (latest), `@cloudflare/workers-types` (latest), `vitest` (latest), `typescript` (matching root version) |

No runtime dependencies. Use `npm install` (NOT `npm ci`) when first creating the package — `npm ci` requires a pre-existing `package-lock.json`. After first install, `npm ci` is what CI uses.

### 3. New file — `infra/cloudflare/mcp-proxy/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

Excludes itself from the root `tsconfig.json` references — the root `tsc -b` does not compile this folder.

### 4. New file — `infra/cloudflare/mcp-proxy/.gitignore`

```
node_modules/
.wrangler/
dist/
.dev.vars
*.log
```

### 5. New file — `infra/cloudflare/mcp-proxy/src/index.ts`

```ts
interface Env {
  /** Upstream Supabase function base URL (e.g. https://favusepjqwpcroiolvaz.supabase.co). Set in wrangler.toml [vars]. */
  UPSTREAM_URL: string
  /** Kill switch — when "true", returns 503 for POST requests only. Set via Cloudflare dashboard (Settings → Variables), NOT wrangler.toml. */
  KILL_SWITCH?: string
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    // Kill switch — POST only. Lets .well-known/* GETs through so OAuth metadata stays accessible during incident triage.
    if (env.KILL_SWITCH === "true" && req.method === "POST") {
      return new Response("Service temporarily unavailable", {
        status: 503,
        headers: { "Retry-After": "60" },
      })
    }

    // Construct upstream URL — preserve full path + query, replace host.
    const incomingUrl = new URL(req.url)
    const upstreamBase = new URL(env.UPSTREAM_URL)
    const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, upstreamBase)

    // Forward request, stamping X-Forwarded-Host so the function can rewrite .well-known and WWW-Authenticate.
    const headers = new Headers(req.headers)
    headers.set("X-Forwarded-Host", incomingUrl.host)

    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body: req.body,
    })

    // Minimal observability — Cloudflare retains last 7 days of console.log on the free tier.
    console.log(JSON.stringify({
      method: req.method,
      path: incomingUrl.pathname,
      status: upstreamResponse.status,
    }))

    return upstreamResponse
  },
} satisfies ExportedHandler<Env>
```

**Single-responsibility**: brand the URL, stamp `X-Forwarded-Host`, provide kill switch. No business logic. No CORS handling (the upstream function already returns CORS headers — see `file:supabase/functions/mcp/index.ts:6-11`).

### 6. New file — `infra/cloudflare/mcp-proxy/src/index.test.ts`

Vitest against `Request`/`Response` mocks. Required cases:

| Case | Assertion |
|---|---|
| Passthrough preserves method + path + query | Stub `globalThis.fetch`; call handler with `POST /functions/v1/mcp?foo=bar`; assert upstream `fetch` was called with same method, same path, same query, same body |
| `X-Forwarded-Host` is stamped | Assert upstream `fetch` is called with `X-Forwarded-Host` header equal to the incoming `host` |
| Kill switch blocks POST when `KILL_SWITCH=true` | Returns `503` with `Retry-After: 60`; upstream `fetch` is NOT called |
| Kill switch does NOT block GET to `.well-known/*` even when `KILL_SWITCH=true` | Returns 200 from upstream; upstream `fetch` IS called |
| Errors from upstream propagate as-is | Stub upstream `fetch` returning 500; assert handler returns 500 (no error transformation) |

Use vanilla vitest, mocking `globalThis.fetch` per-test. **No** `@cloudflare/vitest-pool-workers` — the Worker uses no Worker-specific APIs (no KV, no Durable Objects, no Queues), so the heavier setup buys nothing.

### 7. Modify `file:.github/workflows/ci.yml` — Worker CI integration

Four changes to `ci.yml`:

**(a)** Extend the `changes` job's `paths-filter` with a `worker` output:

```yaml
changes:
  runs-on: ubuntu-latest
  outputs:
    web: ${{ steps.filter.outputs.web }}
    spa: ${{ steps.filter.outputs.spa }}
    worker: ${{ steps.filter.outputs.worker }}  # NEW
  steps:
    - uses: actions/checkout@v4
    - uses: dorny/paths-filter@v3
      id: filter
      with:
        filters: |
          web:
            - 'web/**'
          spa:
            - '**'
            - '!web/**'
            - '!infra/**'  # NEW — exclude infra/ from SPA gate
          worker:           # NEW
            - 'infra/cloudflare/**'
```

**(b)** Add a new `worker-unit` job:

```yaml
worker-unit:
  needs: [changes]
  if: needs.changes.outputs.worker == 'true'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: lts/*
        cache: npm
        cache-dependency-path: infra/cloudflare/mcp-proxy/package-lock.json
    - run: cd infra/cloudflare/mcp-proxy && npm ci
    - run: cd infra/cloudflare/mcp-proxy && npm test
```

**(c)** Rename `web-checks-passed` to `subproject-checks-passed` and extend its `needs:` array:

```yaml
subproject-checks-passed:
  needs: [changes, preview-deploy-web, web-type-check, worker-unit]  # ADD worker-unit
  if: always() && github.event_name == 'pull_request'
  runs-on: ubuntu-latest
  steps:
    - name: Verify subproject checks
      run: |
        preview="${{ needs.preview-deploy-web.result }}"
        types="${{ needs.web-type-check.result }}"
        worker="${{ needs.worker-unit.result }}"
        echo "preview-deploy-web: $preview"
        echo "web-type-check: $types"
        echo "worker-unit: $worker"
        if [[ ("$preview" == "success" || "$preview" == "skipped") && \
              ("$types"   == "success" || "$types"   == "skipped") && \
              ("$worker"  == "success" || "$worker"  == "skipped") ]]; then
          exit 0
        else
          exit 1
        fi
```

**(d)** Verify locally with [actionlint](https://github.com/rhysd/actionlint) if installed (or just push and watch CI). Worker test runs only when `infra/cloudflare/**` changes; SPA-only PRs skip it cleanly.

## Out of Scope

- **Actual production deploy** — `wrangler deploy`, custom domain TLS provisioning, Cloudflare dashboard env var setup all happen in **T105**.
- **Branch protection rule update** — renaming the required check from `web-checks-passed` to `subproject-checks-passed` is a GitHub admin action handled in T105.
- **Auto-deploy on merge to main** — explicitly deferred per Tech Plan smoke-test strategy (Q10 grilling). Manual `wrangler deploy` from the maintainer's machine.
- **Wrangler-pool vitest** — vanilla vitest is sufficient at 50 LOC.
- **`.dev.vars` for local KILL_SWITCH testing** — set the env in your shell or paste into `.dev.vars` ad-hoc; do not commit.
- **Additional Worker features** (rate limiting, custom error pages, IP-based blocking, etc.) — explicitly minimal Worker per ADR 0001 Decision row 2.

## Acceptance Criteria

- [ ] `infra/cloudflare/mcp-proxy/{wrangler.toml, package.json, tsconfig.json, .gitignore, src/index.ts, src/index.test.ts}` all exist.
- [ ] `cd infra/cloudflare/mcp-proxy && npm install` succeeds.
- [ ] `cd infra/cloudflare/mcp-proxy && npm test` passes all 5 vitest cases.
- [ ] `cd infra/cloudflare/mcp-proxy && npx wrangler dev` starts a local server (manual smoke; not automated).
- [ ] `.github/workflows/ci.yml` has the 4 changes: `worker` filter output, `worker-unit` job, `subproject-checks-passed` rename, body update.
- [ ] CI passes on this branch — `worker-unit` runs (since `infra/cloudflare/**` is in the diff) and the new `subproject-checks-passed` aggregator returns success.
- [ ] Demoable: `wrangler dev` locally + `curl -X POST http://localhost:8787/functions/v1/mcp -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'` returns the upstream's tools list. Toggling `KILL_SWITCH=true` (via `.dev.vars`) returns 503 for POSTs but lets `.well-known/*` GETs through.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Track A2.1, A2.4)
- Tech Plan: `file:docs/Tech_Plan_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Key Decisions: Worker shape, kill switch granularity, env var management, testing strategy, deployment binding; Data Model section 3; Component Responsibilities; Implementation Notes commit 3)
- ADR: `file:docs/adr/0001-mcp-public-url-and-oauth-issuer.md` (Decision rows 1, 3, 4)
- Glossary: `file:docs/CONTEXT.md` (MCP Public URL, MCP Edge Function URL)
- Code anchor: `file:.github/workflows/ci.yml` (existing `web-type-check` and `web-checks-passed` patterns to mirror)
- Cloudflare docs: [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [Wrangler config](https://developers.cloudflare.com/workers/wrangler/configuration/)
