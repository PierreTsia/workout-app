# Epic Brief — Release Mechanism

## Summary

Give GymLogic a real release mechanism: PRs merge to `main` freely (docs, chores, dependencies never bump a version), and a **deliberate** release — one action, scriptable by an agent or done on GitHub — bundles everything merged since the last tag into a single SemVer tag + GitHub Release + generated notes, and is the **only** thing that deploys production. One version number, shared by the repo and the **MCP** server that external agents read. See ADR [`docs/adr/0025-release-mechanism.md`](adr/0025-release-mechanism.md).

---

## Context & Problem

**Who is affected:** the maintainer (shipping), any agent asked to cut a release, and every **External MCP Client** that reads `SERVER_INFO.version`.

**Current state:**
- Live in prod (`gymlogic.me`) but **never released**: no git tag, no GitHub Release, root `package.json` = `0.0.0`.
- Four artefacts, deployed three different ways, three of them versionless:

| Artefact | Where | Version today | Deploy today | Trigger |
|---|---|---|---|---|
| SPA / PWA | `gymlogic.me` | none (`package.json` `0.0.0`) | Vercel project `prj_JiSP…` via CI `deploy` | push `main` if `spa` filter — **includes `docs/**`** |
| Docs mini-site | `docs.gymlogic.me` | `web/package.json` = `0.0.1` | Vercel project `…_WEB` via CI `deploy-web` | push `main` if `web/**` |
| Edge Functions (incl. MCP) | Supabase `favusepjq…` | none; MCP carries `SERVER_INFO.version = "0.5.0"` | **manual** `supabase functions deploy <name> --project-ref …` | out of band |
| Cloudflare MCP proxy | `mcp.gymlogic.me` | none | **manual** `wrangler deploy` | out of band |

- `ci.yml:287` deploys the SPA on every `main` push whose paths-filter reports a non-`web/` change — `docs/**` included, so a doc merge redeploys prod and busts the PWA service-worker precache (`registerType: "autoUpdate"`, workbox precache in `file:vite.config.ts`).
- Two version counters already drift: repo `0.0.0` vs MCP server `SERVER_INFO.version = "0.5.0"` (`file:supabase/functions/mcp/index.ts:19`), which external agents read.
- No `SUPABASE_ACCESS_TOKEN` in CI: nothing deploys the functions automatically.

**Pain points:**

| Pain | Impact |
|---|---|
| Every push to `main` ships to prod | A doc/config merge changes prod; no deliberate ship moment |
| No tags / releases | No history; can't tell an agent which release introduced a break |
| Two version numbers | An agent sees `0.5.0` while the repo says `0.0.0`; nobody knows which is truth |
| Functions & worker deployed by hand | The MCP contract can ship ahead of / behind the app silently |
| Hand-written notes | Drift; releases get skipped |

---

## User Stories

1. As the **maintainer**, I want to merge any number of PRs to `main` without bumping a version, so that trivial/doc/dependency PRs don't each cut a release.
2. As the **maintainer**, I want to cut a release with a single deliberate action, so that prod changes only when I decide.
3. As the **maintainer**, I want a release to bundle every change merged since the last tag into one version, so that a version means something.
4. As the **maintainer**, I want release notes generated from the merged PRs, so that I never hand-write a changelog.
5. As the **maintainer**, I want `docs`/`chore`/`ci`/`test` PRs to never bump the version nor appear in notes, so that a doc merge is inert.
6. As an **agent/automation**, I want to trigger a release programmatically (merge the release PR via `gh`/API), so that shipping can be automated.
7. As the **maintainer**, I want the version an External MCP Client reads (`SERVER_INFO.version`) to equal the released version, so that one number is truth.
8. As an **External MCP Client developer**, I want a breaking change to be a **major** release, so that I can pin safely.
9. As a **user**, I want prod to update only on a release, so that I receive a clean, intentional update rather than incremental churn.
10. As the **maintainer**, I want the SPA deploy gated on the release and only run when the SPA actually changed since the last tag, so that a doc or function-only release doesn't churn the PWA cache.
11. As the **maintainer**, I want the `web/` docs site to redeploy when `web/**` changed since the last tag, so docs stay current without a full redeploy otherwise.
12. As the **maintainer**, I want the release to deploy the **Supabase Edge Functions that changed since the last tag**, so that a release that bumps `SERVER_INFO.version` actually reaches the agents.
13. As the **maintainer**, I want a baseline `v1.0.0` marking today's prod, so that release history starts from a known point.
14. As the **maintainer**, if a deploy step fails, I want the release to fail loudly with no half-deployed state, so that recovery is trivial.
15. As the **maintainer**, I want the release flow documented (ADR + `AGENTS.md`), so that a future session knows how to cut one.

### Success measures

| Story # | Measure |
|---|---|
| 5 | A doc-only merge produces **0** tags, **0** releases, **0** prod deploys |
| 4 | 100 % of releases carry generated notes (non-empty, grouped) |
| 7 | root `package.json` version == git tag == `SERVER_INFO.version`, always |
| 12 | A release touching `supabase/functions/**` deploys those functions; a release that doesn't, deploys none |

---

## Scope

**In scope:**
1. `release-please-config.json` + `.release-please-manifest.json` + the release workflow (with `workflow_dispatch` for a manual cycle).
2. Conventional-Commit → bump mapping; `docs`/`chore`/`ci`/`test` excluded.
3. `extra-files` so the release PR also bumps `SERVER_INFO.version` (`file:supabase/functions/mcp/index.ts`).
4. A release-triggered deploy workflow (`on: release: published`), **path-gated vs the previous tag**: SPA → Vercel; `web/**` → Vercel docs project; `supabase/functions/**` → `supabase functions deploy` (needs `SUPABASE_ACCESS_TOKEN`).
5. Remove the prod deploy jobs from `ci.yml` (previews stay).
6. Baseline `v1.0.0` tag.
7. `CHANGELOG.md` + GitHub Release body (grouped notes).
8. Docs: ADR 0025 (done), `AGENTS.md` release section.

**Out of scope:**
- Automating the Cloudflare MCP proxy deploy (stable, manual).
- Versioning `web/package.json` (the docs site is a deploy target, not a versioned artefact).
- Changesets / release-drafter.
- Pre-release channels / hotfix branches (v1); a hotfix is a normal release.
- A two-version scheme (repo ≠ MCP) — rejected in ADR 0025.
- Paid pre-prod environment.

---

## Success Criteria

- **Numeric:** a doc-only merge to `main` cuts no version and deploys nothing; merging the release PR produces a `vX.Y.Z` tag + GitHub Release with notes, deploys **only** the artefacts whose files changed since the previous tag, and leaves root `package.json` / tag / `SERVER_INFO.version` in agreement.
- **Numeric:** a release that changes `supabase/functions/**` runs `supabase functions deploy` for the changed functions; a release that doesn't runs no function deploy.
- **Qualitative:** the flow is documented in `AGENTS.md`, and a release is triggerable from both GitHub and an agent.
