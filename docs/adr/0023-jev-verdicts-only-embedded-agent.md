# ADR 0023 — Jev in GymLogic: verdicts only, entering by the Embedded Agent

- **Status:** Accepted
- **Date:** 2026-09-28
- **Decided in:** grilling round, HITL direction-lock on [#552](https://github.com/PierreTsia/workout-app/issues/552)
- **Amended:** 2026-09-28 (see § Correction) — credential state corrected; consent decision reconciled with [#287](https://github.com/PierreTsia/workout-app/issues/287)

## Correction (2026-09-28, follow-up to #552)

**Credential.** The Context bullet below and Decision 5 were written stating the
`system_one` credential answers **401**. That is stale. The credential
authenticates: `GET /zen/v1/models` returns 44 models with the key vs 82 without,
and `POST /zen/v1/systemone` returns 200 with the real `jev_core` body (measured
2026-09-28, [#552](https://github.com/PierreTsia/workout-app/issues/552)). The
*decision* stands — repair the credential rather than swap the model — but it is now
done. What is still missing is the product-side wire: no Jev client exists in this
repo (`file:supabase/functions/_shared/aiProviders.ts` knows Gemini/Groq only).
Credential state is an operational fact and lives on #552; this ADR keeps the
decision.

**Consent.** Decision 4 conflated two layers and called both "no new concept". The
reconciliation with [#287](https://github.com/PierreTsia/workout-app/issues/287):

- **Prompt contract** — the layer #287 recommended. `skills/gymlogic-mcp/SKILL.md`
  gains the anti-pattern: never flip `dry_run: false` in the same turn as
  `dry_run: true` without a human-confirmed preview between the calls. No server
  change, best-effort, and proven insufficient on its own (Claude Desktop + Iris
  both auto-applied, #287).
- **Server enforcement** — the layer that actually gates. MCP is stateless today:
  nothing links a `dry_run: true` to a later commit, and no preview is retained
  (`file:supabase/functions/_shared/mcpClient.ts`, `createProgram.ts`). Enforcing
  "the commit echoes the previewed payload unchanged" requires **stored server
  state** (preview + short TTL + byte-identical echo match). That *is* a new
  concept; Decision 4's "no new concept" is wrong as written.
- **The Jev Noul on the payload is not the gate.** A Noul scoring text the agent
  supplied is circular — it scores the agent's own account of consent. It may
  annotate; it cannot enforce.
- **The signed-token alternative stays rejected** — #287 path 3 is heavier than a
  stored-preview echo check for no extra guarantee.

Division of ownership: this ADR owns the *server* contract; #287 owns the *prompt*
hardening and its anti-pattern text.

## Context

**Jev** is a one-pass verdict service (System One): given a state and a sentence, it answers with a **Noul** (probability that a yes/no is true), a **Choice** (a set of options summing to 1) or a **Score** (an ordered scale). One pass, then the code opens exactly one branch. It is **not** a chat model and it does not produce prose.

mijote shipped the first two tranches of its own Jev introduction — the door on 2026-09-26, the photo on 2026-09-28. GymLogic has the same kind of terrain but a different shape, written up in `docs/Spike_—_Jev_dans_GymLogic.md` (PR #551):

- the **Embedded Agent** costs **one model call per turn**, for every turn, including questions the database can already answer (`get_training_stats`, `get_workout_history`, `list_programs`);
- the in-app write path already has a preview → commit gate, **twice** (`generate-quick-workout` / `commit-quick-workout`, and the agent's draft → preview → commit);
- MCP has **no** consent step: [#287](https://github.com/PierreTsia/workout-app/issues/287) records agents flipping `dry_run: false` in the same turn, and an MCP call carries no screen, so the server cannot tell where the user is;
- the `system_one` credential (Zen) answered **401** when this was written; it authenticates as of 2026-09-28 (see § Correction) — what remained was the product-side wire, not the credential.

Three insertion points followed from that: a door at the head of the embedded chat, a write-consent verdict on the MCP payload, and a server-resolved context to replace the missing screen. They do not serve the same user and do not cost the same when they are wrong, so the entry point had to be chosen before any tranche was cut.

## Decision

We will:

1. Enter **by the app first** — the **Embedded Agent** `/send` — not by MCP.
2. Make the first tranche **read-only**: `ask_progress` / `ask_history`, answered by the database with **zero model call**. `start_session` and `log_set` change the screen and get their own review once the wire is proven.
3. Keep Jev's frontier at **routing and gates only — never generation**. Whatever produces words stays with the model or the code.
4. Treat the MCP write consent ([#287](https://github.com/PierreTsia/workout-app/issues/287)) as **two layers**: the **prompt contract** (SKILL.md anti-pattern, no server change) and **server enforcement** — a commit must echo the previewed payload **unchanged**, which requires short-TTL stored preview state (a new server concept; see § Correction). Not a signed token. The Jev Noul on the payload annotates, it does not enforce.
5. **Repair** the `system_one` credential rather than swap Jev's model: the wire and the ops cookbooks are already written against it, and a second model means a second Jev behaviour to maintain. *(Repair done — credential verified 2026-09-28, see § Correction.)*

## Consequences

- **Positive:** the read-only branches delete model calls for questions the database already answers, and the door arrives where a wrong verdict costs a screen — recoverable — instead of data.
- **Negative:** the door adds a network hop in front of every turn, including the ones that still need the model; a wrong **Choice** silently picks the wrong branch, which makes the low-confidence posture (`block`, stay on the model) load-bearing, not decorative; the missing product-side Jev wire (§ Correction) remains a hard dependency of the whole line.
- **Follow-ups:** the MCP-first fork stays open (the spike's tranches 2–3); #287 stays open until the two-call protocol is checked against real clients; thresholds, prompt shape and branch set belong to the tranche 1 Tech Plan, not to this ADR.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **MCP first** | The blast radius is the product's own data: a wrong verdict either blocks a legitimate write or lets a bad one through, and it hangs on a consent decision (#287) not yet taken. The app costs a screen. |
| **A signed consent token per payload** | New concept, new surface, new failure mode — while the two-call shape is already proven twice in this codebase. |
| **Let Jev generate the short sentences too** | Unreviewable and duplicates the model's job; the frontier is what keeps a verdict auditable. |
| **Swap Jev's model instead of repairing the credential** | Two Jev behaviours to maintain, and the existing ops cookbooks (issue routing, PR desk) are written against the current wire. |
| **Do nothing until MCP is sorted** | Leaves every turn paying a model call, and leaves #287 with no product answer at all. |
