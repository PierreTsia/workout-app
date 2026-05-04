# T85 — Provision `docs.gymlogic.me` Deployment Ops

## Goal

Complete all manual ops M1-M7 from the Epic Brief — DNS, Vercel project provisioning, GitHub secret, branch protection — and verify end-to-end that `https://docs.gymlogic.me` returns the placeholder over HTTPS with `noindex`, that PR previews work, and that docs-only commits don't redeploy the SPA.

This is the operational slice of A1. **No code changes, no PR.** Acceptance is verified via observation, curl, and a deliberate test PR.

Addresses **Epic Brief stories 2, 3, 4, 6** (all the ones that require infra to actually be provisioned).

## Mode

**HITL** — every step requires Pierre's credentials:
- M1 → domain registrar admin
- M2-M4 → Vercel dashboard admin
- M5 → GitHub repo admin (Secrets)
- M6 → GitHub repo admin (Branch protection)
- M7 → no credentials, but only meaningful after M1-M6

## Slice

DNS CNAME → Vercel project provisioning → GitHub secret → branch protection rule → end-to-end sanity check via curl + test PR

## Dependencies

**T83** must be merged (Astro project exists in `web/` for Vercel to build).
**T84** must be merged (CI YAML uses `VERCEL_PROJECT_ID_WEB` and emits `web-checks-passed`).

**Recommended order** during execution:

1. Land T83 → `web/` exists, builds locally, root unaffected
2. Do M1-M5 from this ticket → DNS, Vercel project, secret in place
3. Land T84 → CI's first run succeeds because the secret exists
4. Do M6-M7 from this ticket → branch protection enforced, sanity check passes

Pierre may reorder if pragmatic, but **M5 must precede M6** (otherwise the new required check `web-checks-passed` blocks all PRs because `preview-deploy-web` fails on missing secret — self-DoS).

## Scope

### M1 — DNS CNAME

In the registrar managing `gymlogic.me`:

| Field | Value |
|---|---|
| Type | `CNAME` |
| Host | `docs` |
| Value | `cname.vercel-dns.com` |
| TTL | `300` (5 min) |

Verify:
```bash
dig docs.gymlogic.me CNAME +short
# expected: cname.vercel-dns.com.
```

### M2 — Vercel: create the second project

Vercel dashboard:

1. **Add New → Project → Import** repo `PierreTsia/workout-app`
2. Project name: `gymlogic-docs`
3. **Framework Preset:** Astro
4. **Root Directory:** `web/` ← non-negotiable, must be set
5. Build / Output / Install commands: leave defaults
6. **Do not deploy yet** — disconnect Git auto-deploy first (M3)

### M3 — Vercel: disable Git integration

In `gymlogic-docs` → **Settings → Git**:

- **Disconnect** the GitHub integration (or disable auto-deploy on push for all branches)
- This matches the SPA project's setup; deploys go through `ci.yml` only

### M4 — Vercel: link the custom domain

In `gymlogic-docs` → **Settings → Domains**:

- **Add domain** `docs.gymlogic.me`
- Vercel issues a Let's Encrypt cert automatically (~1 min after DNS is live from M1)
- Confirm the green check before triggering the first deploy

### M5 — GitHub: add the new secret

**Settings → Secrets and variables → Actions:**

| Secret | Value | Source |
|---|---|---|
| `VERCEL_PROJECT_ID_WEB` | (from Vercel) | `gymlogic-docs` → Settings → General → Project ID |

Existing secrets `VERCEL_TOKEN` and `VERCEL_ORG_ID` are reused — **do not rotate them**.

### M6 — GitHub: update branch protection on `main`

**Settings → Branches → Branch protection rules → `main`:**

- Under **Require status checks to pass before merging**, **add** `web-checks-passed` to the list of required checks
- **Do not** add `deploy-web` or `preview-deploy-web` directly — they're paths-filtered and `skipped` on SPA-only PRs would block those PRs forever
- Existing required checks (`gate` + others) stay as-is

### M7 — Post-deploy sanity check

After T84 has merged AND the first `deploy-web` run on main has succeeded:

```bash
curl -I https://docs.gymlogic.me
# expected: HTTP/2 200, content-type: text/html

curl -s https://docs.gymlogic.me | grep -i 'noindex'
# expected: <meta name="robots" content="noindex">
```

Then open a test PR touching `web/` (e.g., trivial whitespace change in `web/src/pages/index.astro`) and confirm:
- `preview-deploy-web` runs and succeeds
- A bot comment with the Vercel preview URL appears on the PR
- The preview URL renders the placeholder with the Tailwind class applied

Then make a deliberate docs-only commit on `main` and confirm in the GH Actions UI that the SPA `deploy` job is `skipped`.

## Out of Scope

- **No code changes in this ticket.** All work is dashboard / DNS provider / repo-settings.
- Adding the `noindex` page meta to a sitemap exclusion — out of scope, A6 problem.
- Removing `noindex` once real content lands — A6 (#304) M8 from the brief.
- `.vercelignore` on the SPA — unnecessary (SPA build runs from CI, not from Vercel git push).
- Monitoring / alerting on the new Vercel project — not now.

## Acceptance Criteria

- [ ] `dig docs.gymlogic.me CNAME +short` returns `cname.vercel-dns.com.`
- [ ] Vercel dashboard shows the `gymlogic-docs` project with Root Directory = `web/`, GitHub integration disabled, and `docs.gymlogic.me` linked with a green cert badge
- [ ] GitHub repo Settings → Secrets shows `VERCEL_PROJECT_ID_WEB` (timestamp recent)
- [ ] GitHub repo Settings → Branches → `main` shows `web-checks-passed` listed as a required status check
- [ ] `curl -I https://docs.gymlogic.me` returns `HTTP/2 200`
- [ ] `curl -s https://docs.gymlogic.me | grep -i noindex` matches the `<meta name="robots" content="noindex">` line
- [ ] A test PR touching `web/` shows a Vercel preview URL comment posted by `github-actions[bot]`, and the preview URL renders the placeholder
- [ ] After a deliberate docs-only commit lands on `main`, the GH Actions run shows the SPA `deploy` job as `skipped` and `deploy-web` as `success`
- [ ] After a deliberate SPA-only PR is opened, `preview-deploy-web` is `skipped` and `web-checks-passed` is `success` — the PR is not blocked

## References

- Epic Brief: `file:docs/Epic_Brief_—_Bootstrap_Astro_Mini-Site_#299.md` — entire "Human Manual Steps" section (M1-M7), stories 2/3/4/6
- Tech Plan: `file:docs/Tech_Plan_—_Astro_Bootstrap_#299.md` — Critical Constraints (first-deploy ordering), Failure Mode Analysis
- Parent epic: #298
- This ticket: #299 (sub-task A1)
- Predecessor tickets: T83 (scaffold), T84 (CI YAML)
