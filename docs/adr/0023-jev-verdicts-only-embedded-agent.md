# ADR 0023 — Jev in GymLogic: verdicts only, entering by the Embedded Agent

- **Status:** Accepted
- **Date:** 2026-09-28
- **Decided in:** grilling round, HITL direction-lock on [#552](https://github.com/PierreTsia/workout-app/issues/552)

## Context

**Jev** is a one-pass verdict service (System One): given a state and a sentence, it answers with a **Noul** (probability that a yes/no is true), a **Choice** (a set of options summing to 1) or a **Score** (an ordered scale). One pass, then the code opens exactly one branch. It is **not** a chat model and it does not produce prose.

mijote shipped the first two tranches of its own Jev introduction — the door on 2026-09-26, the photo on 2026-09-28. GymLogic has the same kind of terrain but a different shape, written up in `docs/Spike_—_Jev_dans_GymLogic.md` (PR #551):

- the **Embedded Agent** costs **one model call per turn**, for every turn, including questions the database can already answer (`get_training_stats`, `get_workout_history`, `list_programs`);
- the in-app write path already has a preview → commit gate, **twice** (`generate-quick-workout` / `commit-quick-workout`, and the agent's draft → preview → commit);
- MCP has **no** consent step: [#287](https://github.com/PierreTsia/workout-app/issues/287) records agents flipping `dry_run: false` in the same turn, and an MCP call carries no screen, so the server cannot tell where the user is;
- the `system_one` credential (Zen) answers **401** today — no verdict is executable at all.

Three insertion points followed from that: a door at the head of the embedded chat, a write-consent verdict on the MCP payload, and a server-resolved context to replace the missing screen. They do not serve the same user and do not cost the same when they are wrong, so the entry point had to be chosen before any tranche was cut.

## Decision

We will:

1. Enter **by the app first** — the **Embedded Agent** `/send` — not by MCP.
2. Make the first tranche **read-only**: `ask_progress` / `ask_history`, answered by the database with **zero model call**. `start_session` and `log_set` change the screen and get their own review once the wire is proven.
3. Keep Jev's frontier at **routing and gates only — never generation**. Whatever produces words stays with the model or the code.
4. Treat the MCP write consent ([#287](https://github.com/PierreTsia/workout-app/issues/287)) as **two mandatory calls**: `dry_run: true`, then a commit of the payload **echoed unchanged**, plus a Noul on the payload. No new token, no new concept.
5. **Repair** the `system_one` credential rather than swap Jev's model: the wire and the ops cookbooks are already written against it, and a second model means a second Jev behaviour to maintain. Until it answers, no tranche ships.

## Consequences

- **Positive:** the read-only branches delete model calls for questions the database already answers, and the door arrives where a wrong verdict costs a screen — recoverable — instead of data.
- **Negative:** the door adds a network hop in front of every turn, including the ones that still need the model; a wrong **Choice** silently picks the wrong branch, which makes the low-confidence posture (`block`, stay on the model) load-bearing, not decorative; the 401 remains a hard dependency of the whole line.
- **Follow-ups:** the MCP-first fork stays open (the spike's tranches 2–3); #287 stays open until the two-call protocol is checked against real clients; thresholds, prompt shape and branch set belong to the tranche 1 Tech Plan, not to this ADR.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **MCP first** | The blast radius is the product's own data: a wrong verdict either blocks a legitimate write or lets a bad one through, and it hangs on a consent decision (#287) not yet taken. The app costs a screen. |
| **A signed consent token per payload** | New concept, new surface, new failure mode — while the two-call shape is already proven twice in this codebase. |
| **Let Jev generate the short sentences too** | Unreviewable and duplicates the model's job; the frontier is what keeps a verdict auditable. |
| **Swap Jev's model instead of repairing the credential** | Two Jev behaviours to maintain, and the existing ops cookbooks (issue routing, PR desk) are written against the current wire. |
| **Do nothing until MCP is sorted** | Leaves every turn paying a model call, and leaves #287 with no product answer at all. |