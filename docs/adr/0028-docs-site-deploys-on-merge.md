# ADR 0028 — The docs mini-site deploys on merge, not on a release

- **Status:** Accepted · amends 0025 (§4 and §7, for `web/**` only)
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

1. **The `web/` mini-site deploys on merge.** `deploy-web.yml` runs on pushes to `main` that touch `web/**`, and on `workflow_dispatch`. It keeps the release path's secrets and commands — `vercel pull`, then `vercel deploy --prod`, against `VERCEL_PROJECT_ID_WEB` — and differs only in its trigger and in where its sources come from: the pushed commit, never a tag.
2. **The release gate still holds for the SPA and the Edge Functions.** §4 and §7 of ADR 0025 are untouched for them; this amendment is scoped to `web/**`.
3. **The docs site has exactly one deployment path.** `release-deploy.yml` stops deploying `web/`: its `deploy-web` job and the `web` output of its `targets` job are removed. The new workflow carries its own `deploy-web` concurrency group instead of joining `release-deploy`'s. Two independent reasons, both raised in the review of the first version of this change, which shared the release group and left the release job in place:
   - **A shared group does not queue a release, it can replace it.** `cancel-in-progress: false` protects a *running* deploy, not a *pending* one. A content merge landing while a release deploy waits for the lock cancels that pending run, skipping its SPA and Edge Function jobs and breaking ADR 0025 §7, which this ADR has no business touching.
   - **The release path deploys a tag, so it can promote stale content.** `release-deploy.yml` checks out `ref: ${{ needs.targets.outputs.tag }}`. A delayed or retried release would then deploy the tag's copy of `web/`, overwriting a page that had already shipped from a newer commit. A lock prevents overlap; it does not prevent a stale promotion.
4. **No version is created.** A docs deploy cuts no tag, writes no changelog entry and changes no `package.json`. Content ships without version churn, which is what §3 existed to protect.

## Consequences

- **Positive:** a post or a docs page goes live when it merges, instead of waiting for an unrelated `feat` or `fix` to land; the docs pipeline stops being coupled to the app's release cadence; nothing about the SPA's precache reasoning is weakened, because the SPA's triggers are unchanged.
- **Negative:** the mini-site now moves on every `web/**` merge, so a bad content deploy is live immediately and rolls back only by revert. That surface now deserves the same care a release gets.
- **Unverified until its first run.** No release has ever exercised this Vercel path: the two `release-deploy` runs recorded on 2026-10-01 skipped the docs job through the paths filter, and no release has touched `web/**` since. This workflow's first execution is therefore the first real exercise of `vercel deploy --prod` against `VERCEL_PROJECT_ID_WEB`. That it runs from the repository root assumes the Vercel project's Root Directory is configured to `web/` — inferred from the removed job's shape, not observed. Watch the first run; if it ships the wrong directory, the deploy is wrong, not merely noisy.
- **Two review findings changed this design, and are recorded here rather than in a thread.** The first version of this change joined the `release-deploy` concurrency group and left that workflow's `deploy-web` job in place, on the reasoning that a second deploy would be idempotent. It would not have been: the release path deploys a tag, and the shared lock could have cancelled a pending release. Both were raised by Copilot's review of PR #642 and are addressed by decision 3.
- **Previews are untouched, and the apparent contradiction is not one.** §4 of ADR 0025 says Vercel previews for `web/**` on PRs are unchanged, while `web/vercel.json` carries `{"github": {"enabled": false}}`. That flag disables the Vercel *dashboard's* Git integration only; previews are deployed from `ci.yml`'s `preview-deploy-web` job, with the Vercel CLI and a sticky PR comment. Both statements hold. Nothing to settle.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **Type the content commit `feat(blog):`** so release-please cuts a release | Relabels a documentation change as a user-facing feature to game the pipeline: a false entry in `CHANGELOG.md`, a minor bump, and a tag for a blog post. It also leaves the next docs merge in the same hole. |
| **Deploy by hand: `workflow_dispatch` on `release-deploy`** | The workflow needs a tag, and the tags that exist predate the change, so the paths diff reports `web=false` and the job skips. Cutting a tag by hand desyncs the `release-please` manifest. |
| **Turn the Vercel Git integration back on for this project** | Moves the deploy policy into a dashboard, outside the repository and outside review, and reintroduces deploys nobody can read in a diff. |
| **Deploy the mini-site from the laptop with the Vercel CLI** | Works once, leaves no trace in the repository, and does not survive the laptop closing — the opposite of the loop this repository is built around. |
| **Treat the docs site as a releasable package** (own release-please config) | A second version counter to keep in sync, for content that has no meaningful version. ADR 0025 already rejected two counters for a stronger reason. |
