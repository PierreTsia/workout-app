# T84 — CI YAML: Web Deploy Jobs + SPA Deploy Gating

## Goal

Modify `file:.github/workflows/ci.yml` to add 4 new jobs that deploy `web/` to the `gymlogic-docs` Vercel project (preview on PRs, prod on main), and gate the existing SPA `deploy` job on non-`web/**` changes so docs-only commits don't trigger a useless SPA redeploy.

This is the CI-surface slice of A1. The YAML works syntactically and runs as expected; the deploy jobs themselves will fail until T85 provisions the Vercel project + secret. That failure is **explicitly accepted** in this ticket's ACs.

Addresses **Epic Brief stories 4, 5, 6**.

## Mode

**AFK** — pure YAML edit on a single file. The verification is observable on a draft PR.

## Slice

`paths-filter outputs` → `preview-deploy-web` job → `deploy-web` job → `web-checks-passed` summary → SPA `deploy` job gating → workflow execution observability

## Dependencies

**T83** — needs a buildable `web/` project; otherwise `vercel build` fails for an unrelated reason (no Astro source) and verification is muddled.

## Scope

### New jobs in `file:.github/workflows/ci.yml`

| Job | Trigger | `if` condition | Purpose |
|---|---|---|---|
| `changes` | `push` + `pull_request` | always runs | `dorny/paths-filter@v3` emits boolean outputs `web` (true if `web/**` changed) and `spa` (true if anything outside `web/**` changed) |
| `preview-deploy-web` | `pull_request` only | `needs.changes.outputs.web == 'true'` | Vercel CLI 3-step flow (`pull → build → deploy --prebuilt`); captures preview URL; posts sticky PR comment via `actions/github-script@v7` |
| `deploy-web` | `push` to `main` | `needs.changes.outputs.web == 'true' && github.ref == 'refs/heads/main'` | Same flow with `--environment=production` and `--prod` |
| `web-checks-passed` | always (no `if`) | `if: always()` step-level check | `needs: [changes, preview-deploy-web]`; passes when `preview-deploy-web.result` is `success` OR `skipped` |

### Modified job in `file:.github/workflows/ci.yml`

| Job | Change |
|---|---|
| `deploy` (existing SPA deploy) | `needs: [gate]` → `needs: [gate, changes]`; `if: github.ref == 'refs/heads/main' && github.event_name == 'push'` → `if: github.ref == 'refs/heads/main' && github.event_name == 'push' && needs.changes.outputs.spa == 'true'` |

### Implementation notes

- All web jobs `cd web` before running `npm ci` and Vercel CLI commands (Vercel CLI auto-detects `web/.vercel/` via `vercel pull`)
- Vercel CLI installation: `npm i -g vercel@latest` (mirrors existing SPA deploy job)
- Auth env: `VERCEL_TOKEN`, `VERCEL_ORG_ID` (existing secrets), `VERCEL_PROJECT_ID_WEB` (new — provisioned in T85)
- Sticky PR comment idiom (in `preview-deploy-web`): use `actions/github-script@v7`. Look up existing comments on the PR by `github.actor === 'github-actions[bot]'` and a marker prefix `<!-- vercel-preview-docs -->`. If found, edit; else create.
- Preview URL capture: `vercel deploy --prebuilt --token=$VERCEL_TOKEN > /tmp/url.txt && echo "url=$(cat /tmp/url.txt)" >> $GITHUB_OUTPUT`
- `web-checks-passed` body: a single bash step that exits 0 if `needs.preview-deploy-web.result` is `success` or `skipped`, exits 1 otherwise. Accept that on `push` events `preview-deploy-web` doesn't run at all (event-mismatch) — handle that case explicitly.

### Job dependency wiring

```yaml
preview-deploy-web:
  needs: [changes]
  if: needs.changes.outputs.web == 'true' && github.event_name == 'pull_request'
  ...

deploy-web:
  needs: [changes]
  if: needs.changes.outputs.web == 'true' && github.ref == 'refs/heads/main' && github.event_name == 'push'
  ...

web-checks-passed:
  needs: [changes, preview-deploy-web]
  if: always() && github.event_name == 'pull_request'
  steps:
    - run: |
        if [[ "${{ needs.preview-deploy-web.result }}" == "success" || "${{ needs.preview-deploy-web.result }}" == "skipped" ]]; then
          exit 0
        else
          exit 1
        fi

deploy:
  needs: [gate, changes]
  if: github.ref == 'refs/heads/main' && github.event_name == 'push' && needs.changes.outputs.spa == 'true'
  ...
```

## Out of Scope

- Vercel project provisioning (`gymlogic-docs`) → T85 / M2-M4
- DNS CNAME for `docs.gymlogic.me` → T85 / M1
- `VERCEL_PROJECT_ID_WEB` GitHub secret addition → T85 / M5
- Branch protection rule update (`web-checks-passed` as required check) → T85 / M6
- End-to-end deploy verification (`curl https://docs.gymlogic.me`) → T85 / M7
- Adding paths-filter to other SPA jobs (`lint`, `type-check`, `unit`, `e2e`) — out of scope per Epic Brief
- Caching `node_modules` for `web/` — accepted ~10-15s install cost per run

## Acceptance Criteria

- [ ] `actionlint` (or `gh workflow validate` / GitHub's workflow parser) accepts the modified `ci.yml`
- [ ] On a draft PR that touches `web/` (e.g., changes the placeholder text in `web/src/pages/index.astro`):
  - `changes` job runs and outputs `web: true`
  - `preview-deploy-web` job runs (regardless of pass/fail)
  - `web-checks-passed` job runs and reports `success` if `preview-deploy-web` was `success`, `failure` otherwise
  - SPA jobs (`lint`, `type-check`, `unit`, `e2e`, `gate`) run as before
- [ ] On a draft PR that touches **only** `src/` (e.g., a tiny SPA change):
  - `changes` job outputs `web: false`, `spa: true`
  - `preview-deploy-web` is `skipped`
  - `web-checks-passed` is `success` (passes despite skipped dependency)
  - PR is **not blocked** by the new check
- [ ] On a docs-only commit pushed to `main`:
  - The existing SPA `deploy` job is `skipped`
  - `deploy-web` runs (success or failure depending on whether T85 secret exists)
- [ ] On a SPA-only commit pushed to `main`:
  - `deploy-web` is `skipped`
  - The existing SPA `deploy` job runs as before
- [ ] **Acknowledged**: `preview-deploy-web` and `deploy-web` may report `failure` until T85 provisions `VERCEL_PROJECT_ID_WEB`. This is expected and not a blocker for merging T84.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Bootstrap_Astro_Mini-Site_#299.md` (stories 4, 5, 6; in-scope items 6, 7, 8)
- Tech Plan: `file:docs/Tech_Plan_—_Astro_Bootstrap_#299.md` — sections "Data Model" (CI topology), "Component Responsibilities" (jobs), "Failure Mode Analysis"
- Existing CI: `file:.github/workflows/ci.yml`
- Existing SPA Vercel config: `file:vercel.json`
- Parent epic: #298
- This ticket: #299 (sub-task A1)
