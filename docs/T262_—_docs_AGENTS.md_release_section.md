# T262 — docs: `AGENTS.md` Release section + README pointer (AFK)

**Mode:** AFK · **Slice:** `AGENTS.md → README.md`

## Goal

Document the release flow so a future session (or agent) knows how to cut a release and what it deploys.

## Dependencies

- T260, T261.

## Scope

- `AGENTS.md` — a "Release" subsection: merge the standing `chore(release)` PR to cut a version (`gh pr merge` or GitHub); what it deploys (path-gated SPA / docs / functions); the baseline `v1.0.0`; that `docs/chore/ci/test` never release.
- `README.md` — a one-line pointer from the CI/CD row to the release flow.

## Out of Scope

- Copy deck / user-facing changelog page.

## Acceptance Criteria

- [ ] `AGENTS.md` explains how to cut a release and what it deploys.
- [ ] README points to the flow.
- [ ] No invented behavior — matches ADR 0025 / T260 / T261.

## References

- ADR `file:docs/adr/0025-release-mechanism.md`
- Tech Plan `file:docs/Tech_Plan_—_Release_Mechanism_#328.md`
