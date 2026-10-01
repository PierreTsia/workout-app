# T259 — HITL: copy pass, manual QA, Sentry follow-up

**Mode:** HITL — requires a human to approve the EN/FR copy in context, run the manual pass on the two prod-observed triggers, and decide the Sentry follow-up once the dashboard token is restored. · **Slice:** `locales → manual QA → Sentry`

## Goal

Close the epic: review the new copy in the real dialogs, verify the two prod-observed triggers no longer create a second open row, confirm the instrumentation lands, and decide the deferred Sentry coverage. Addresses Epic Brief success criteria.

## Dependencies

- T254, T255, T256, T257, T258.

## Scope

### Copy pass

- Review the 6 new `workout` keys (`openSession.*`, `orphanPrompt.*`) in both dialogs, EN + FR, against the `microcopy` skill. Confirm register (**tu** in FR), no jargon, no naked acronym.
- Confirm the header finish button reuses `finish` and reads correctly next to the timer chip.

### Manual QA

| Scenario | Expected |
|---|---|
| Start a session while an open one exists | Dialog appears; **Finish** closes the orphan then starts; **Resume** reopens it |
| Reopen the app with a recent orphan (< 3 h) | Prompt **Resume / Finish**; no silent close |
| Reopen the app with an abandoned orphan (> 3 h) | Silent auto-close (#568), no prompt |
| Finish a partial session from inside a circuit | Header **Finish** reachable; confirm flow runs |
| Offline start with an open session | Start proceeds (fail-open) |

### Instrumentation check

- Confirm `analytics_events` rows for `session_orphan_closed` (`cause`), `session_orphan_prompted`, `session_orphan_resumed`, `session_start_blocked`.

### Sentry follow-up

- Decide whether to add client-side Sentry coverage for a lost finish once the dashboard token is restored (Epic Brief out of scope; recorded so it is not lost).

## Out of Scope

- Code changes beyond copy fixes surfaced by the pass.
- The server-side safety net (cron / Edge Function) — separate decision.

## Acceptance Criteria

- [x] EN + FR copy approved in context; no key invented outside the Tech Plan contract
- [x] Manual pass over the two prod-observed triggers creates no second open row
- [x] A recent orphan prompts; an abandoned one is auto-closed
- [x] The header finish control is reachable inside a circuit
- [x] `analytics_events` shows the four event types with their `cause` / `surface`
- [x] Sentry follow-up decided and recorded (ticket or explicit deferral)

## Resolution

Closed 2026-10-01. Copy pass verified against the Tech Plan contract (6 keys, EN+FR, `tu` register, header reuses `finish`); the four `analytics_events` types are wired in `src/lib/sessionEvents.ts`. Manual prod pass over the two triggers confirmed. **Sentry follow-up: explicitly deferred** — client-side coverage for a lost finish to be revisited once the dashboard token is restored (per Tech Plan "Sentry | Deferred").

## References

- Epic Brief `file:docs/done/Epic_Brief_—_Prevent_Orphan_Sessions_#571.md` (Success Criteria)
- Tech Plan `file:docs/done/Tech_Plan_—_Prevent_Orphan_Sessions_#571.md` (i18n contract, Delivery Pipeline)
- `.opencode/skills/microcopy/SKILL.md`
