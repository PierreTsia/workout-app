# T263 — HITL: secret, baseline, first release cycle

**Mode:** HITL — a human sets the CI secret and cuts the baseline tag. · **Slice:** `GitHub secrets → git tag → first release PR`

## Goal

Close the epic: enable the function deploy, seed the `v1.0.0` baseline, and confirm the first automatic release PR + deploy behave.

## Dependencies

- T260, T261, T262 merged.

## Scope

1. **Secret** — add `SUPABASE_ACCESS_TOKEN` (a Supabase personal access token) to the repo Actions secrets. Without it `deploy-functions` no-ops. Decision: set it now, or defer and keep function deploys manual.
2. **Baseline** — create the `v1.0.0` tag + GitHub Release at the setup commit (manifest already `1.0.0`), so release-please starts from `1.0.1+`.
3. **Verify** — merge a `feat`/`fix` PR, confirm the release PR opens; merge it, confirm tag + release + notes + path-gated deploys; confirm `package.json` == tag == `SERVER_INFO.version`; confirm a doc-only merge produces nothing.

## Out of Scope

- Automating the Cloudflare worker deploy.

## Acceptance Criteria

- [ ] `SUPABASE_ACCESS_TOKEN` set (or explicit decision to keep function deploys manual).
- [ ] `v1.0.0` baseline tag + release exist.
- [ ] A `feat`/`fix` merge opens the release PR; merging it cuts `vX.Y.Z` and deploys only what changed.
- [ ] A doc-only merge cuts nothing and deploys nothing.
- [ ] `package.json` / tag / `SERVER_INFO.version` agree.

## References

- Epic Brief `file:docs/Epic_Brief_—_Release_Mechanism_#328.md`
- ADR `file:docs/adr/0025-release-mechanism.md`
