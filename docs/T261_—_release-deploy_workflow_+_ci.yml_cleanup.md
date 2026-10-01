# T261 — release-deploy workflow + remove prod deploy from `ci.yml` (AFK)

**Mode:** AFK · **Slice:** `.github/workflows/release-deploy.yml → .github/workflows/ci.yml`

## Goal

Deploy production only on a release, and only the artefacts that changed since the previous tag: SPA, `web/` docs, and the changed Supabase Edge Functions.

## Dependencies

- T260 (releases must exist for the event to fire).

## Scope

- `.github/workflows/release-deploy.yml` (new):
  - `on: release: types: [published]` + `workflow_dispatch` (input `tag`).
  - `fetch-depth: 0`; resolve `TAG` (release tag or input) and `PREV` (previous tag); `changed = git diff --name-only PREV..TAG` (all files when `PREV` is empty).
  - Jobs: `deploy-spa` (`src/**`, `public/**`, `index.html`, `vite.config.ts`, `package*.json`) → `vercel build/deploy --prod` (existing `deploy` recipe); `deploy-web` (`web/**`) → existing `deploy-web` recipe; `deploy-functions` (`supabase/functions/**`) → `supabase functions deploy` for the changed function dirs, skipped with a warning when `SUPABASE_ACCESS_TOKEN` is unset.
- `.github/workflows/ci.yml` — remove the `deploy` and `deploy-web` prod jobs; keep `changes`, `preview-deploy-web`, `gate`, `subproject-checks-passed`, and all PR checks.

## Out of Scope

- Automating the Cloudflare worker deploy.
- The secrets themselves (T263).

## Acceptance Criteria

- [ ] `ci.yml` no longer deploys to prod on `main` push; PR checks unchanged.
- [ ] `release-deploy.yml` deploys the SPA only when SPA paths changed, docs only when `web/**` changed, functions only when `supabase/functions/**` changed.
- [ ] `deploy-functions` no-ops (warning, no failure) when the secret is absent.
- [ ] Workflow YAML is valid (lint/actionlint if available).

## References

- Tech Plan `file:docs/Tech_Plan_—_Release_Mechanism_#328.md`
- ADR `file:docs/adr/0025-release-mechanism.md`
