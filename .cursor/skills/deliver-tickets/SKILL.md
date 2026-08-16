---
name: deliver-tickets
description: >
  Orchestrates AFK ticket delivery from the pinged thread: one subagent per
  AFK ticket, TDD for all code, one commit per AFK ticket, HITL surfaced as a
  concise human action while the rest continues. Use when the user says
  "deliver tickets", "orchestrate tickets", "ship the tickets", "run T191",
  "execute the epic", "livrer les tickets", or pings a chat to drive
  split-tickets output.
---

# Deliver Tickets

The **pinged thread is the orchestrator**. It does not implement tickets. It reads the ticket map, spawns workers, verifies commits, and unblocks the DAG.

## Golden rules

1. **1 ticket AFK = 1 commit.** Unless HITL: you continue.
2. **All code is `/tdd`.** Follow `.cursor/skills/tdd/SKILL.md` (this repo). Vertical slices: one test → one implementation. Behavior through public interfaces. No horizontal "all tests then all code".
3. **AFK workers have full authorization.** They must not prompt the user. No `AskQuestion`. No "may I commit?". No waiting for sandbox approval — every Shell that might touch git, network, or the sandbox uses `required_permissions: ["all"]`.
4. **HITL is not a stop.** Emit a concise action for the human and keep shipping every AFK ticket that does not depend on that HITL.

Verbatim: 1 ticket afk = 1 commit, unless hitl, you continue.

---

## Orchestrator (this thread)

### 1. Load the map

- Ticket files `docs/T{n}_—_*.md` for the epic (and Epic Brief + Tech Plan if present).
- Build the DAG from each ticket's **Dependencies** and **Mode** (`AFK` | `HITL`).
- Do not re-grill. Do not rewrite tickets.

### 2. Spawn workers

- **1 AFK ticket = 1 `Task` subagent.** Never two tickets in one worker.
- Parallelize every AFK ticket whose dependencies are already committed.
- Prompt the worker with: ticket path, epic/tech-plan paths, this golden rule, TDD path, and the commit authorization below.
- Tell the worker it is **fully authorized** (AFK). It must not ping the user.

HITL tickets: **do not** spawn an implementation worker. Output the HITL action (template below) and continue the AFK frontier.

### 3. After each worker

- Confirm **exactly one new commit** on the current branch (`git log -1`, `git status` clean for that slice).
- If the worker failed or didn't commit: resume that worker once with the error; do not steal the ticket into this thread unless the worker cannot run.
- Then spawn the next AFK tickets whose deps are now met.

### 4. Stop conditions

- All AFK tickets committed and every HITL action has been printed.
- Do **not** `git push` unless the user explicitly asked.

---

## Worker (AFK subagent)

Read, in order: the ticket, `.cursor/skills/tdd/SKILL.md`, `docs/CONTEXT.md`, relevant ADRs, `.cursor/rules/*.mdc`.

**TDD override for AFK:** skip "ask the user to approve behaviors / interface". The ticket **Acceptance Criteria** + Tech Plan **are** the approved plan. Still: tracer bullet, observe real RED, then GREEN, then refactor. Quote the failing test output in the worker's final message.

**Commit override for AFK:** the workspace "no commit without permission" rule is **lifted for this one ticket**. When AC are green:

1. Stage only files that belong to this ticket.
2. `git commit` with a HEREDOC message (repo style: why, not what). One commit. No amend, no push, no `--no-verify`.
3. `git status` must be clean of that slice.

If the ticket is docs-only (e.g. skill copy), TDD does not apply; still 1 commit.

Return to the orchestrator: ticket id, commit sha, AC checklist, leftover risks. Do not start the next ticket.

---

## HITL output

When the next work is HITL, print **only** this block (keep it short):

```
HITL T{n} — {one-line job}
Do this:
1. {concrete action}
2. {concrete action}
Reply "{done phrase}" when finished.
```

No essay. No second plan. Then continue AFK tickets that don't depend on it.

---

## Anti-patterns

- Orchestrator writing production code "to go faster"
- One worker implementing T191+T192
- Committing two tickets together "because they're small"
- Stopping the DAG to wait on HITL when other AFK tickets are free
- Asking the user to confirm a commit, a test list, or sandbox permission
- TDD Phase 1 interview inside an AFK worker
- `npx tsc --noEmit` (vacuous here — use `npx tsc -p tsconfig.app.json --noEmit` or `npx tsc -b`)
- Vitest without stripping Supabase env when the tree imports the client (see `.cursor/rules/build-sandbox-caveat.mdc`)
