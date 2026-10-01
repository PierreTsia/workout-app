# T260 — release-please config + workflow + `SERVER_INFO` annotation (AFK)

**Mode:** AFK · **Slice:** `release-please-config.json → .release-please-manifest.json → .github/workflows/release-please.yml → supabase/functions/mcp/index.ts → CHANGELOG.md`

## Goal

Wire release-please so a merged Conventional-Commit PR accumulates into a single standing release PR, and merging that PR cuts the tag + GitHub Release + changelog. Bump `SERVER_INFO.version` in the same commit so the agent-facing number equals the released one.

## Dependencies

- ADR `file:docs/adr/0025-release-mechanism.md`.

## Scope

- `release-please-config.json` — `release-type: node`, `bootstrap-sha` = the setup commit (`f8ceb14`), package `"."`, `include-component-in-tag: false`, `extra-files` generic on `supabase/functions/mcp/index.ts`, `changelog-sections` with `docs/chore/ci/test/deps` hidden.
- `.release-please-manifest.json` — `{ ".": "1.0.0" }`.
- `.github/workflows/release-please.yml` — `on: push: branches: [main]` + `workflow_dispatch`; `permissions: contents: write, pull-requests: write`; `googleapis/release-please-action@v4`.
- `supabase/functions/mcp/index.ts` — set `SERVER_INFO.version` to `1.0.0` (baseline) and add `// x-release-please-version` to the line.
- `package.json` + `package-lock.json` — seed `version` to `1.0.0` so the baseline tag matches (`tag == package.json == SERVER_INFO.version`).
- `CHANGELOG.md` — seed a `1.0.0 — Initial release` section.

## Out of Scope

- The deploy workflow (T261).
- Setting the `SUPABASE_ACCESS_TOKEN` secret and cutting `v1.0.0` (T263).

## Acceptance Criteria

- [ ] `release-please-config.json` + `.release-please-manifest.json` valid; manifest at `1.0.0`.
- [ ] The release-please workflow runs on `main` push and `workflow_dispatch`.
- [ ] `SERVER_INFO.version` line carries the `x-release-please-version` annotation (the generic updater target).
- [ ] `CHANGELOG.md` exists with the `1.0.0` seed.
- [ ] No change to app behavior; `npm test` still green.

## References

- Epic Brief `file:docs/Epic_Brief_—_Release_Mechanism_#328.md`
- Tech Plan `file:docs/Tech_Plan_—_Release_Mechanism_#328.md`
- ADR `file:docs/adr/0025-release-mechanism.md`
