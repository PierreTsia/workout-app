# Epic Brief — Bootstrap Astro Mini-Site (#299)

## Summary

A1 ships the foundation of the GymLogic public surface: an empty Astro site deployed at `docs.gymlogic.me`, decoupled from the React SPA on `gymlogic.me` (zero coupling on PWA, OAuth, or service-worker scope). It's the scaffolding that unblocks the Claude Desktop connector documentation (#296), the public ship write-up (#237), and the future Agent-Journalist content pipeline (#136). A1 itself ships no marketing copy, no doc content, no styling beyond a Tailwind smoke test — only the deployable shell.

---

## Context & Problem

**Who is affected:** the solo dev (Pierre); future GymLogic visitors discovering the project; the Anthropic Connectors Directory submission (#296); search engines that will eventually index the public surface.

**Current state:**
- The SPA at `gymlogic.me` carries the entire public surface today: app, OAuth flow, PWA, marketing pages (`file:src/pages/AboutPage.tsx`, `file:src/pages/PrivacyPage.tsx`).
- No public docs URL exists, blocking the Anthropic Directory submission (#296) which requires a stable, indexable connector page.
- No public surface for the ship write-up (#237) or future content (#136).
- Adding deep marketing/doc pages inside the SPA was rejected upstream (#298) because it would force a Supabase Site URL migration, PWA scope re-restriction, and re-test of the 4 MCP clients (cf. #292) — 3-6 weeks of risky work for a 3-user product.

**Pain points:**

| Pain | Impact |
|---|---|
| No public URL exists for the Claude Desktop connector doc | #296 submission blocked |
| Public pages mixed into the SPA bundle | SEO worse than SSG, harder to ship a "vitrine craft" portfolio |
| Any new public-facing page risks the OAuth/PWA migration trap (#292) | High cognitive cost per minor doc change |

---

## User Stories

1. As the **solo dev**, I want a deployed Astro site at `docs.gymlogic.me`, so that I can author the connector doc (A4) without touching the SPA.
2. As a **future visitor** typing `docs.gymlogic.me` between A1 and A4 shipping, I want a non-broken page over HTTPS, so that the first impression isn't a 404 or empty white screen.
3. As a **search engine crawler** indexing the public surface during the A1→A6 gap, I want the placeholder to declare `noindex`, so that the "coming soon" page doesn't pollute SERPs before real SEO lands in A6.
4. As a **future PR author** modifying `web/`, I want a Vercel preview URL posted on my PR, so that I can validate visual changes before merging to main.
5. As the **solo dev pushing a SPA-only change**, I want the new docs deploy/preview CI jobs to skip cleanly without blocking the merge, so that I don't wait on irrelevant builds and don't get stuck on required checks that never run.
6. As the **solo dev pushing a docs-only change**, I want the SPA Vercel deploy and PWA cache to stay untouched, so that doc edits don't bust the SPA's offline cache.
7. As a **future Astro page author**, I want Tailwind v4 utilities working out of the box (no postcss/v3 shim), so that I can style content immediately in A2.
8. As a **future maintainer**, I want `web/` to have its own `package.json` and `vercel.json`, so that Astro dependencies don't bleed into the SPA bundle and Vercel projects stay independent.
9. As the **SPA itself**, I want zero regression on `npm run build` at root and on the root ESLint pipeline, so that A1's sub-folder doesn't break production builds.

### Success measures

| Story # | Measure |
|---|---|
| 2 | `https://docs.gymlogic.me` returns HTTP 200 with valid TLS, response < 500ms p50 from EU |
| 4 | Preview URL posted on PR within 3 min of `web/**` push |
| 9 | Root `npm run build` time delta ≤ 2% vs. pre-A1 baseline (sanity check, not blocking) |

Stories 1, 3, 5, 6, 7, 8 are validated qualitatively.

---

## Scope

**In scope:**

1. Create `web/` sub-folder with own `package.json`. **No npm workspaces.**
2. Install Astro (latest 5.x) + Tailwind v4 via `@tailwindcss/vite` (the v4-recommended path, **not** the legacy `@astrojs/tailwind` integration which targets v3).
3. Astro `output: 'static'`. **No** `@astrojs/vercel` adapter (YAGNI — revisit when SSR is needed).
4. `web/src/pages/index.astro` — placeholder "Coming soon" page with one Tailwind class as smoke test, real `<title>`, `<meta description>`, and `<meta name="robots" content="noindex">`.
5. Provision second Vercel project `gymlogic-docs` with **Root Directory = `web/`**, GitHub integration **disabled** (`"github": { "enabled": false }` in `web/vercel.json`), domain `docs.gymlogic.me` linked.
6. CI: add `deploy-web` job in `file:.github/workflows/ci.yml` (push to main, paths-filter `web/**`, `vercel ... --prod` with `VERCEL_PROJECT_ID_WEB`).
7. CI: add `preview-deploy-web` job (pull_request, paths-filter `web/**`, `vercel deploy` without `--prod`, posts preview URL as PR comment via `actions/github-script`).
8. CI: add `web-checks-passed` summary job that always runs and depends on `preview-deploy-web`. It succeeds when the dependency either `success` or `skipped`. This is the required check for branch protection — solving the "stuck PR" problem on SPA-only PRs without dropping the gate on web-only PRs.
9. Branch protection on `main`: add `web-checks-passed` to required status checks (manual step M6).
10. Root `file:eslint.config.js`: add `'web/**'` to `globalIgnores` so root `eslint .` doesn't try to lint Astro files.

**Out of scope (deferred to listed downstream ticket):**

- MDX integration / content collections → A4 (#302)
- Layout, navigation, footer, design tokens → A2 (#300)
- Home page real content (pitch, demo embed, CTAs) → A3 (#301)
- Connector documentation MDX content → A4 (#302)
- Blog skeleton + RSS → A5 (#303)
- Sitemap, robots.txt (proper), OG tags, analytics, canonical → A6 (#304)
- About page → A7 (#305)
- ESLint / Prettier inside `web/` → A2 (when there's actual code worth linting)
- shadcn primitive replication → A2
- `@astrojs/vercel` adapter → never, until SSR is needed
- Custom 404 / error layouts → A2 or A6
- Removing the `noindex` meta → A6 (#304)
- Monitoring / alerting on the new Vercel project → not now
- `.vercelignore` on the SPA — unnecessary (SPA build runs from CI, not from Vercel git push)
- Adding paths-filter to the existing SPA jobs (`lint`, `type-check`, `unit`, `e2e`) — they tolerate running on docs-only PRs at the cost of ~5-8 min wasted CI on `e2e`. Acceptable for solo-dev cadence.

---

## Success Criteria

**Numeric / verifiable:**

- `https://docs.gymlogic.me` returns HTTP 200 over HTTPS with valid TLS cert
- Pushing to `main` with a change in `web/**` triggers `deploy-web`, which deploys the new Astro build to prod within 5 min
- Opening a PR with a change in `web/**` triggers `preview-deploy-web`, which posts a preview URL comment within 5 min
- Opening a PR with **no** change in `web/**` results in `preview-deploy-web` being `skipped` and `web-checks-passed` `success` — PR is not blocked
- `curl -s https://docs.gymlogic.me | grep noindex` returns the `<meta name="robots" content="noindex">` line
- Root `npm run build` succeeds with no new warnings or errors
- Root `npm run lint` succeeds without scanning `web/**`
- CI on main is green after merge

**Qualitative:**

- A SPA-only PR does **not** trigger `deploy-web` or `preview-deploy-web` (they are `skipped`)
- A docs-only PR does **not** redeploy the SPA Vercel project
- The Tailwind smoke class on the placeholder visibly applies (i.e., utilities pipeline works end-to-end in production build)

---

## Human Manual Steps

These cannot be automated by the agent. Pierre must perform them, **before merging the A1 PR** (otherwise the deploy job fails on first run with a missing-secret error, and the new required check blocks all PRs).

### M1 — DNS: add CNAME for the subdomain

In the registrar managing `gymlogic.me`:

| Field | Value |
|---|---|
| Type | `CNAME` |
| Host | `docs` |
| Value | `cname.vercel-dns.com` |
| TTL | `300` (5 min, fine for first setup) |

Verify propagation:

```bash
dig docs.gymlogic.me CNAME +short
# expected: cname.vercel-dns.com.
```

### M2 — Vercel: create the second project

In the Vercel dashboard:

1. **Add New → Project → Import** the existing repo `PierreTsia/workout-app`
2. Project name: `gymlogic-docs`
3. **Framework Preset:** Astro
4. **Root Directory:** `web/` ← critical, must be set to the sub-folder
5. **Build Command:** leave default (`npm run build`)
6. **Output Directory:** leave default (`dist`)
7. **Install Command:** leave default (`npm install`)
8. **Do not deploy yet** — disconnect Git auto-deploy first (next step)

### M3 — Vercel: disable Git integration on `gymlogic-docs`

In `gymlogic-docs` → **Settings → Git**:

- **Disconnect** the GitHub integration (or disable auto-deploy on push for all branches)
- This matches the SPA project's setup; deploys go through `ci.yml` only
- The `web/vercel.json` will additionally enforce `"github": { "enabled": false }`

### M4 — Vercel: link the custom domain

In `gymlogic-docs` → **Settings → Domains**:

- **Add domain** `docs.gymlogic.me`
- Vercel issues a Let's Encrypt cert automatically (takes ~1 min once DNS is live from M1)
- Confirm the green check before triggering the first deploy

### M5 — GitHub: add the new secret

In the repo's **Settings → Secrets and variables → Actions**:

| Secret | Value | Source |
|---|---|---|
| `VERCEL_PROJECT_ID_WEB` | (from Vercel) | `gymlogic-docs` → Settings → General → Project ID |

Existing secrets are **reused** — do **not** rotate them:

- `VERCEL_TOKEN` (already set)
- `VERCEL_ORG_ID` (already set)

### M6 — GitHub: update branch protection on `main`

In **Settings → Branches → Branch protection rules → `main`**:

- Under **Require status checks to pass before merging**, **add** `web-checks-passed` to the list of required checks
- **Do not** add `deploy-web` or `preview-deploy-web` directly — they are paths-filtered and will be `skipped` on SPA-only PRs, which would block those PRs forever if listed as required
- Existing required checks (`gate` and any others) stay as-is

### M7 — Post-deploy sanity check

After the first `deploy-web` job runs successfully on main:

```bash
curl -I https://docs.gymlogic.me
# expected: HTTP/2 200, content-type: text/html

curl -s https://docs.gymlogic.me | grep -i 'noindex'
# expected: <meta name="robots" content="noindex">
```

Open the next PR touching `web/` and confirm a Vercel preview URL is posted as a comment.

### M8 (deferred to A6) — remove `noindex`

Tracked as part of A6 (#304). Not required during A1.

---

## References

- Parent epic: #298 — Astro mini-site (foundation publique pour ship & marketplace)
- This ticket: #299 — A1 Bootstrap Astro + Tailwind v4 + Vercel deploy
- Sibling tickets (verified open):
  - #300 — A2 Layout / nav / footer (shared design primitives)
  - #301 — A3 Home page (pitch + demo embed + CTAs)
  - #302 — A4 Doc connecteur Claude page (MDX, stable URL for #296) — first real consumer of A1
  - #303 — A5 Skeleton blog (layout + index + RSS, no pipeline)
  - #304 — A6 SEO essentiels + analytics (sitemap, OG, robots, Plausible)
  - #305 — A7 About / How I work page
- Related epics that A1 unblocks: #237 (Ship publicly), #296 (Anthropic Connectors Directory), #136 (Agent-Journalist content pipeline)
- Coupling reference (why we don't put this on the apex domain): #292 (OAuth callback flash — illustrates the migration cost of touching the SPA's auth flow)
- SPA CI / deploy reference: `file:.github/workflows/ci.yml` (`deploy` job, `vercel.json` with `"github": { "enabled": false }`)
