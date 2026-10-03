# Architecture Decision Records

One file per decision, `NNNN-slug.md`, newest number highest. An ADR records a
decision and its alternatives; it is the source of truth for *why*, not for live
operational state (credential status, feature flags, quotas — those live on the
issue that measured them).

## Add one

1. Copy the shape of the latest ADR: `# ADR NNNN — Title`, then `Status`, `Date`,
   `Decided in`, `Context`, `Decision`, `Consequences`, `Alternatives considered`.
2. Take the next number. Never reuse or renumber a published ADR — cross-references
   are by number only.
3. Add a row to the index below in the same PR.

## Status values

- **Accepted** — in force.
- **Amended by ADR NNNN** — still in force except for the named section; the amending
  ADR wins there.
- **Superseded by ADR NNNN** — no longer in force; the replacing ADR wins.

As of 2026-09-28 no ADR in this corpus is fully **Superseded**. Three carry a
partial amendment, recorded inline as `Amended by`: 0007, 0008, 0016.

## Numbering: the `0006` collision

Two files share the number `0006`:

- `0006-decouple-template-from-progression-engine.md` — Template Prescription vs
  Progression Engine (#373). Committed first (`be60a00`, 2026-05-27).
- `0006-shared-timer-utilities.md` — shared timer/audio utilities (#374). Committed
  second (`13ada55`, 2026-05-27).

Bare `ADR 0006` references exist in both meanings across `docs/` and `src/`
(roughly thirty code comments mean the *decouple* one). Renumbering the
`shared-timer` file to `0024` would not disturb those code comments, but it would
rewrite references in `docs/CONTEXT.md` and two `docs/done/` tech plans — which are
historical records and should not be retro-edited.

**Standing recommendation:** renumber `shared-timer` to `0024` only in a PR that
also updates every reference (`docs/CONTEXT.md`, `docs/done/Tech_Plan_—_Eyes-off_Hold_Timer_Feedback.md`)
and say so in the description. Until then, do not write new bare `ADR 0006`
references — use the slug.

## Index

| # | Status | Date | Title | File |
|---|---|---|---|---|
| 0001 | Accepted | 2026-05-06 | MCP public URL and OAuth issuer | [0001-mcp-public-url-and-oauth-issuer.md](./0001-mcp-public-url-and-oauth-issuer.md) |
| 0002 | Accepted | 2026-05-10 | Quick Workout AI migrates to Embedded Agent + MCP | [0002-quick-workout-ai-mcp-migration.md](./0002-quick-workout-ai-mcp-migration.md) |
| 0003 | Accepted | 2026-05-12 | Additional program creation flow shape | [0003-additional-program-creation-shape.md](./0003-additional-program-creation-shape.md) |
| 0004 | Accepted | 2026-05-12 | `embedded_agent_threads.purpose` and multi-flow extensions | [0004-embedded-agent-thread-purpose-column.md](./0004-embedded-agent-thread-purpose-column.md) |
| 0005 | Accepted | 2026-05-27 | Batch progression suggestions per workout day | [0005-batch-progression-suggestions-per-day.md](./0005-batch-progression-suggestions-per-day.md) |
| 0006 | Accepted | 2026-05-27 | Decouple Template Prescription from the Progression Engine | [0006-decouple-template-from-progression-engine.md](./0006-decouple-template-from-progression-engine.md) |
| 0006 | Accepted | 2026-05-27 | Shared Timer Utilities *(duplicate number — see above)* | [0006-shared-timer-utilities.md](./0006-shared-timer-utilities.md) |
| 0007 | Accepted · amended by 0011 | 2026-06-13 | Exercise Blocks: rich structure, no progression engine (v1) | [0007-exercise-blocks-rich-structure-no-progression.md](./0007-exercise-blocks-rich-structure-no-progression.md) |
| 0008 | Accepted · amended by 0014 | 2026-06-17 | Circuit completion time: derived, not scored (v1) | [0008-circuit-completion-time-derived-not-scored.md](./0008-circuit-completion-time-derived-not-scored.md) |
| 0009 | Accepted | 2026-06-30 | AI Provider Fallback: Groq on Gemini unavailability only (v1) | [0009-ai-provider-fallback.md](./0009-ai-provider-fallback.md) |
| 0010 | Accepted | 2026-07-31 | Localize catalog labels at display time, not in snapshots | [0010-localize-catalog-at-display-time.md](./0010-localize-catalog-at-display-time.md) |
| 0011 | Accepted | 2026-08-04 | MCP Circuits via additive `exercises[]` Circuit Items | [0011-mcp-circuit-items-in-exercises-array.md](./0011-mcp-circuit-items-in-exercises-array.md) |
| 0012 | Accepted | 2026-08-07 | Scope Last Performance to the Exercise Slot | [0012-slot-scoped-last-performance.md](./0012-slot-scoped-last-performance.md) |
| 0013 | Accepted | 2026-08-11 | Product Tour is a separate `/tour` surface | [0013-product-tour-separate-from-homepage.md](./0013-product-tour-separate-from-homepage.md) |
| 0014 | Accepted | 2026-08-15 | AMRAP mode and persisted Block Runs | [0014-amrap-mode-and-block-runs.md](./0014-amrap-mode-and-block-runs.md) |
| 0015 | Accepted | 2026-08-15 | Benchmark Circuit catalog identity | [0015-benchmark-circuit-catalog-identity.md](./0015-benchmark-circuit-catalog-identity.md) |
| 0016 | Accepted · amended by 0018/0021 | 2026-08-16 | Meet Cindy is a Builder seed drop, not a home CTA | [0016-meet-cindy-builder-seed-drop.md](./0016-meet-cindy-builder-seed-drop.md) |
| 0017 | Accepted | 2026-08-16 | Pantheon seeds stay AMRAP and carry a display label | [0017-pantheon-amrap-seeds-and-label.md](./0017-pantheon-amrap-seeds-and-label.md) |
| 0018 | Accepted | 2026-08-16 | Circuit Catalog encyclopedia lives under Library | [0018-circuit-catalog-encyclopedia-under-library.md](./0018-circuit-catalog-encyclopedia-under-library.md) |
| 0019 | Accepted | 2026-08-17 | Circuit achievement Cast Clearing and Spidey rounds | [0019-circuit-achievement-cast-clearing-and-spidey.md](./0019-circuit-achievement-cast-clearing-and-spidey.md) |
| 0020 | Accepted | 2026-08-22 | Program identity URL and published score rubric | [0020-program-identity-and-score-rubric.md](./0020-program-identity-and-score-rubric.md) |
| 0021 | Accepted · amends 0016 | 2026-08-27 | Builder has one Add picker | [0021-builder-one-add-picker.md](./0021-builder-one-add-picker.md) |
| 0022 | Accepted | 2026-09-24 | Session orientation policy | [0022-session-orientation-policy.md](./0022-session-orientation-policy.md) |
| 0023 | Accepted | 2026-09-28 | Jev in GymLogic: verdicts only, entering by the Embedded Agent | [0023-jev-verdicts-only-embedded-agent.md](./0023-jev-verdicts-only-embedded-agent.md) |
| 0024 | Accepted | 2026-09-30 | Session orphan self-heal: close at boot, never `now()` | [0024-session-orphan-self-heal.md](./0024-session-orphan-self-heal.md) |
| 0025 | Accepted | 2026-10-01 | Release mechanism: release-please, deploy gated on the release | [0025-release-mechanism.md](./0025-release-mechanism.md) |
| 0026 | Accepted | 2026-10-01 | Deviation storage: dedicated table, referenced set, Jev-agnostic | [0026-deviation-storage.md](./0026-deviation-storage.md) |
| 0027 | Accepted | 2026-10-03 | MCP App views follow the standard MCP Apps contract, Nomos as visual source | [0027-agentic-view-contract.md](./0027-agentic-view-contract.md) |
