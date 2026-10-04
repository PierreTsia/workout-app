# ADR 0028 — The docs mini-site deploys on merge, not on a release

- **Status:** Accepted · amends 0025 (§4, for `web/**` only)
- **Date:** 2026-10-04
- **Decided in:** the delivery of a blog post, after the post merged to `main` and stayed 404 on `docs.gymlogic.me`

## Context

ADR 0025 §4 gates the whole production deploy on a release, the `web/` mini-site included, and §3 makes `docs`-typed commits produce no release. Read together, they leave a content change to the docs site with no path to production:

- a blog post merges to `main`;
- `release-please` opens no release PR, so no release is ever cut. Verified on the two `docs` merges of 2026-10-04 (`#640`, `#641`): the workflow ran and succeeded both times, and neither produced a release PR. The manifest still reads `1.5.4`;
- `deploy-web` therefore never runs, and `web/vercel.json` carries `{"github": {"enabled": false}}`, so Vercel's own Git integration does not cover the gap either.

The result is a green merge, a post that is correct in `main`, and a 404 on `docs.gymlogic.me` with nothing scheduled to fix it.

The gate is right for what §4 was written about. The SPA is a versioned artefact whose service-worker precache a byte-identical redeploy busts, and the MCP server's `SERVER_INFO.version` has to name the release that shipped it, because external agents read it. Neither argument transfers to the docs mini-site: it is static content, with no service worker, no version and no runtime contract. Its only version is its content.

## Decision

1. **The `web/` mini-site deploys on merge.** `deploy-web.yml` runs on pushes to `main` that touch `web/**`, and on `workflow_dispatch`. It does exactly what the `deploy-web` job in `release-deploy.yml` does, with the same secrets: `vercel pull`, then `vercel deploy --prod`, against `VERCEL_PROJECT_ID_WEB`.
2. **The release gate still holds for the SPA and the Edge Functions.** §4 and §7 of ADR 0025 are untouched for them; this amendment is scoped to `web/**`.
3. **The two deploy paths cannot overlap.** The new workflow joins the `release-deploy` concurrency group, so a release and a content merge never deploy the same Vercel project at once. A release that also changed `web/**` still runs its own `deploy-web` job; that second deploy is idempotent and is deliberately left in place.
4. **No version is created.** A docs deploy cuts no tag, writes no changelog entry and changes no `package.json`. Content ships without version churn, which is what §3 existed to protect.

## Consequences

- **Positive:** a post or a docs page goes live when it merges, instead of waiting for an unrelated `feat` or `fix` to land; the docs pipeline stops being coupled to the app's release cadence; nothing about the SPA's precache reasoning is weakened, because the SPA's triggers are unchanged.
- **Negative:** the mini-site now moves on every `web/**` merge, so a bad content deploy is live immediately and rolls back only by revert. That surface now deserves the same care a release gets.
- **Unverified until its first run.** The `deploy-web` job has never executed: the two `release-deploy` runs recorded on 2026-10-01 skipped it through the paths filter, and the repository has spawned no release that touched `web/**` since. This workflow's first execution is therefore the first exercise of that Vercel path. That the job runs from the repository root assumes the Vercel project's Root Directory is configured to `web/`, which is inferred from the job's shape rather than observed. Watch the first run, and roll it back if `vercel deploy` ships the wrong directory.
- **Follow-up, and a contradiction to settle.** §4 of ADR 0025 states that "Vercel preview deploys for `web/**` on PRs are unchanged", while `web/vercel.json` disables the Git integration for this project, which would turn previews off as well. One of the two is stale. Decide which behaviour is wanted and fix the other in a later PR.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **Type the content commit `feat(blog):`** so release-please cuts a release | Relabels a documentation change as a user-facing feature to game the pipeline: a false entry in `CHANGELOG.md`, a minor bump, and a tag for a blog post. It also leaves the next docs merge in the same hole. |
| **Deploy by hand: `workflow_dispatch` on `release-deploy`** | The workflow needs a tag, and the tags that exist predate the change, so the paths diff reports `web=false` and the job skips. Cutting a tag by hand desyncs the `release-please` manifest. |
| **Turn the Vercel Git integration back on for this project** | Moves the deploy policy into a dashboard, outside the repository and outside review, and reintroduces deploys nobody can read in a diff. |
| **Deploy the mini-site from the laptop with the Vercel CLI** | Works once, leaves no trace in the repository, and does not survive the laptop closing — the opposite of the loop this repository is built around. |
| **Treat the docs site as a releasable package** (own release-please config) | A second version counter to keep in sync, for content that has no meaningful version. ADR 0025 already rejected two counters for a stronger reason. |
