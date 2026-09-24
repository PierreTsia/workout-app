# T250 — ADR 0022 + glossary term

**Epic:** `file:docs/Epic_Brief_—_Session_Portrait_Guard_#501.md` · **Tech Plan:** `file:docs/Tech_Plan_—_Session_Portrait_Guard_#501.md`

- **Mode:** AFK — content is pre-written in the Tech Plan §ADR Summary and Epic Brief decision record.
- **Slice:** `docs (ADR 0022 + CONTEXT term) — no code`
- **Dependencies:** None (docs can land before or with T248/T249)

## Goal

Record the orientation policy so the iOS/Android divergence and the "why not manifest / why not Floor HUD" choices are discoverable — story 8.

## Scope

- New `file:docs/adr/0022-session-orientation-policy.md`, structure of `file:docs/adr/0021-builder-one-add-picker.md`:
  - `# ADR 0022 — Session orientation policy` · Status: Accepted · Date: 2026-09-24 · Decided in: HITL direction-lock on #501.
  - **Context:** phone-on-the-floor rotates the PWA mid-**Session**; portrait-only `WorkoutPage`; iOS ignores every lock API; #501 forbids the manifest quick win.
  - **Decision (We will:):** (1) v1 is **Prevent**, not Floor HUD. (2) Scope = active **Session** only (predicate `sessionAtom.isActive && startedAt != null`, mounted in AppShell). (3) Best-effort `screen.orientation.lock("portrait")` where supported + landscape⇒rotate CSS fallback on coarse pointers everywhere else. (4) Manifest stays without `orientation`. (5) **Eyes-off Feedback** remains the eyes-off story — no duplication.
  - **Consequences:** Positive / Negative / Follow-ups (Floor HUD stays the other fork; angle-unavailable upside-down worst case; vaul drawer cosmetic risk).
  - **Alternatives considered** table: Floor HUD; manifest `orientation: portrait`; freeze-without-rotate; designed nudge overlay — why each was not picked (Tech Plan §ADR Summary).
- New glossary term in `file:docs/CONTEXT.md` (**Session Orientation Guard**): one-sentence definition (session-scoped orientation policy: OS lock where available, rotate-to-portrait CSS fallback where not, `<html>` marker class + `data-gl-rot`), following file conventions (bold term, `→ file:` anchors to the hook + globals.css).

## Out of Scope

- Any code, tests, or CSS.

## Acceptance Criteria

- [ ] ADR 0022 exists with the five decision bullets and the alternatives table.
- [ ] CONTEXT.md contains **Session Orientation Guard** with file anchors; no other glossary terms paraphrased.
- [ ] Epic Brief decision-record line and ADR cross-reference each other (`#501`, ADR 0022).
- [ ] No code files touched (`git diff --stat` shows docs only for this ticket's commit).

## References

Epic Brief story 8 + decision record · Tech Plan §ADR Summary, §Key Decisions.
