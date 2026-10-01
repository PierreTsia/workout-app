# ADR 0025 — Release mechanism: release-please, deploy gated on the release

- **Status:** Accepted
- **Date:** 2026-10-01
- **Decided in:** grilling session (`grill-with-docs`) for [#328](https://github.com/PierreTsia/workout-app/issues/328); amended 2026-10-01 for [#584](https://github.com/PierreTsia/workout-app/issues/584) (SPA displays the release version)

## Context

GymLogic is **live in production** (`gymlogic.me`) but has never been **released**: no git tag, no GitHub Release, and `package.json` sits at `0.0.0`. The only "ship" signal today is a push to `main`, and `.github/workflows/ci.yml` deploys the SPA to Vercel on every such push whose paths-filter reports a non-`web/` change — including a `docs/**` merge, which redeploys the PWA and busts its service-worker precache for byte-identical assets. Prod moves whether or not anything user-facing changed.

Two independent version counters already exist: the repo (`package.json` `0.0.0`, `web/package.json` `0.0.1`) and the **MCP server** (`supabase/functions/mcp/index.ts:19` → `SERVER_INFO = { version: "0.5.0" }`), which external **External MCP Client** agents read. Nothing ties them together, so an agent can see `0.5.0` while the repo says `0.0.0`.

[#328](https://github.com/PierreTsia/workout-app/issues/328) asks for a proper **SemVer** mechanism that **bundles several merged PRs into one release** (so a dependency bump or a doc PR does not cut a version), auto-generates release notes, and lets a release be cut deliberately.

## Decision

We will adopt **release-please** as the release tool, with one version for the whole repository.

1. **One version.** The release tag (`vX.Y.Z`) is the single source of truth and **drives `SERVER_INFO.version`** — `release-please` bumps `package.json` *and* `supabase/functions/mcp/index.ts` in the same release PR (`extra-files`). The number an **External MCP Client** reads is the number of the release that shipped it. The **SPA does not bake a release number**: it reads `SERVER_INFO.version` from the deployed MCP Edge Function at **runtime** (a public `GET …/version`, additive to the MCP HTTP surface, touching no MCP tool), with the build-time `package.json` version as an offline fallback only. The number the user sees therefore cannot lag a backend-only release, and `package.json` stays out of the SPA deploy triggers (§7) — the reason it was excluded is unchanged.
2. **Deliberate, batched releases.** `release-please` keeps a standing `chore(release): vX.Y.Z` PR open on `main`, accumulating the changes since the last tag. **Merging that PR cuts the release** — tag + GitHub Release + `CHANGELOG.md`. The trigger is therefore scriptable: an agent merges the PR with `gh pr merge`, a human merges it on GitHub, and the release workflow also exposes `workflow_dispatch` for a manual cycle.
3. **What cuts a release.** Only Conventional-Commit types that mean a user-facing change: `feat` → minor, `fix` → patch, `feat!` / `BREAKING CHANGE` → major. `docs`, `chore`, `ci`, `test` produce **no** release — merging doc-only PRs cannot cut a version, by construction.
4. **Deploy is gated on the release.** The production Vercel deploy (SPA and the `web/` mini-site) runs on **`on: release: published`**, not on every push to `main`. Merging to `main` no longer changes prod; only cutting a release does. Vercel **preview** deploys for `web/**` on PRs are unchanged.
5. **Start at `1.0.0`.** The repo's public surface (above all the **MCP** tool contract, which is never renamed and gated by ADR + test) is treated as stable, so `1.0.0` is honest. A one-off baseline tag `v1.0.0` is cut at the bootstrap commit (a short "Initial release" note); `release-please` then owns `1.0.1+`. Post-1.0 rules apply: a **BREAKING CHANGE** is a **major**.
6. **Release notes** live in `CHANGELOG.md` (root, English) and as the GitHub Release body, grouped **Breaking / Features / Bug Fixes**. They are generated, not written by hand.
7. **One event deploys every target, path-gated.** On a release the workflow deploys only the artefacts whose files changed since the nearest **tagged ancestor**: the **SPA** (`src/`, `public/`, `vite.config.ts`, …) to Vercel, the `web/` mini-site when `web/**` changed, and the changed **Supabase Edge Functions** (`supabase functions deploy`, gated on `supabase/functions/**` and authenticated with a `SUPABASE_ACCESS_TOKEN` CI secret) — **all** deployable functions when `supabase/functions/_shared/**` changed, since every consumer bundles it. A release therefore ships the app **and** the MCP server together, so `SERVER_INFO.version` reaches external agents with the release it names. Because a release created with the default `GITHUB_TOKEN` does **not** trigger an `on: release` workflow run, the release workflow **invokes the deploy workflow directly** (reusable `workflow_call`) when it creates a release; `release: published` stays a second trigger for a release cut by a human or another token. The **Cloudflare MCP proxy** stays manual: it is a stable upstream proxy, not a versioned artefact. `package.json` / `package-lock.json` are deliberately **not** SPA deploy triggers — release-please rewrites their version fields in the release commit itself, so counting them would redeploy the PWA on every release.

## Consequences

- **Positive:** a doc or dependency PR can no longer create a release or touch prod; releases bundle as many merged PRs as you like; exactly one version number exists and it matches what the MCP agents see; release notes are free and consistent. The SPA can show the live release number (and link its release notes) **without redeploying the PWA**: a backend-only release updates the displayed number the moment `SERVER_INFO.version` is read, so the single source of truth stays true from the browser too.
- **Negative:** no more continuous deploy — an urgent fix requires cutting a release, which costs one deliberate merge. The release PR can sit stale and must be merged. Wiring the release to `supabase functions deploy` puts a `SUPABASE_ACCESS_TOKEN` in CI and touches production Supabase automatically, so the workflow must deploy **only the functions changed since the last tag** and fail safe. The SPA's displayed version now depends on reaching the deployed MCP function: offline, it falls back to the last `package.json` value baked at build time, which may lag a backend-only release.
- **Follow-ups:** add `release-please-config.json` + `.release-please-manifest.json`, the release workflow, the `SUPABASE_ACCESS_TOKEN` secret, and move the prod deploy jobs out of `ci.yml` onto `on: release: published`; cut the `v1.0.0` baseline; document the flow (this ADR + `AGENTS.md`). For [#584](https://github.com/PierreTsia/workout-app/issues/584): expose `GET …/version` on the MCP Edge Function and display the fetched version + a releases link in `src/pages/AboutPage.tsx` and `src/pages/AccountPage.tsx` (i18n EN + FR, colocated tests).

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **Changesets** | Requires every PR author to add a changeset file — friction that a doc PR would have to remember to skip, and the exact opposite of "nothing to do on a doc PR". The repo's Conventional-Commit titles already carry the signal. |
| **release-drafter** | Fills draft notes continuously but does not own the version or the tag; we would still hand-roll the bump and the tag, and could not gate the deploy on a released version cleanly. |
| **Hand-rolled `workflow_dispatch` + git-cliff** | Most control, but it is a script we maintain forever (version math, notes, tag, release) for behaviour an off-the-shelf action gives us. |
| **Two versions (repo ≠ MCP server)** | A second counter to keep in sync by hand; the agent-facing number drifts from the shipped one, which is the ambiguity this ADR exists to remove. |
| **Keep deploying on every push, tag only for notes** | Leaves the original irritant: a doc merge still redeploys prod and churns the PWA cache. |
