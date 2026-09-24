---
name: grill-with-docs
description: >
  Like `grill-me`, but plugged into the codebase's shared language. Loads
  `docs/CONTEXT.md` (the ubiquitous-language glossary) before grilling, sharpens
  fuzzy terms against it as you talk, updates the glossary live, and writes a
  lightweight ADR whenever a non-obvious / hard-to-reverse decision is made.
  Default skill when grilling about anything that touches the GymLogic codebase
  (sessions, programs, exercises, MCP, achievements…). Trigger on phrases like
  "grill with docs", "grill avec le contexte", "grille-moi avec les docs",
  "stress-test with glossary", "shared language grilling", "ddd grill".
---

# Grill With Docs

Same relentless interview as `grill-me`, but **grounded in the project's shared language and decision history**. Use this whenever the topic touches the codebase — which, for GymLogic, is almost always.

If the conversation is purely abstract (a eulogy, a non-code product brainstorm, a personal life decision), use `grill-me` instead.

---

## Why this exists

`grill-me` is great at producing a shared mental model — but the model evaporates the moment the chat ends, and the AI has to re-learn fuzzy terms ("the suggestion", "that thing on the strip") in every new session.

This skill fixes both problems by leaning on two artifacts borrowed from domain-driven design:

1. **`docs/CONTEXT.md`** — a ubiquitous-language glossary. The same vocabulary used by the code, by you, and by anything you'd explain to a non-developer (a coach, a tester, a future you). Single file for the whole repo for now; we can split into bounded contexts later if it grows unwieldy.
2. **`docs/adr/NNNN-kebab-title.md`** — Architectural Decision Records. One markdown file per non-obvious decision.

Together, every grilling session leaves the codebase a little more navigable for the next one.

---

## Operating principles

The **core grilling loop is identical to `grill-me`** — read that skill first if you haven't. The rules below are deltas / additions.

1. **No premature artifact (still).** Do NOT write a PRD, Epic Brief, Tech Plan, ticket, or production code while grilling. The only files this skill ever touches are `docs/CONTEXT.md` and `docs/adr/*.md`.
2. **Walk the design tree, one question at a time.** Recommend an answer with rationale every time. Push back on vague language.
3. **Search the codebase before asking.** If a question can be answered by `Grep`, `Glob`, or reading a file, do that first.
4. **Use the glossary actively.** Whenever the user (or you) reaches for a term:
   - If the term is **in `CONTEXT.md`** → use it precisely as defined; flag any drift between the user's usage and the existing definition.
   - If the term is **fuzzy or new** → propose a sharper name + a one-sentence definition; ask the user to confirm before locking it in.
   - If two terms **collide** (same word, different meanings or vice-versa) → surface the collision explicitly and force a decision before moving on (cf. the article's "Standalone Video" vs "Pitched Video" example).
5. **ADR-worthy decisions get flagged in real time.** When a decision is hard to reverse, surprising-without-context, or involved a real trade-off — say so out loud the moment it lands. Don't wait until the end.
6. **Stop conditions** — same as `grill-me`: explicit user signal ("on a fait le tour" / "ok let's write it") or genuinely no more meaningful questions. A real grilling can last 30+ questions.

---

## Phase 0 — Load the context

Before asking your first question:

1. **Read `docs/CONTEXT.md`** if it exists. Skim the whole file; you'll need to spot collisions.
2. **List `docs/adr/`** if it exists. Read titles only at this stage; pull individual ADRs into context only when relevant.
3. **If `docs/CONTEXT.md` is missing** → tell the user once, in one line:
   > *"No `docs/CONTEXT.md` yet — I'll bootstrap one as we go. Say "skip docs" if you'd rather just grill without writing anything."*
   Do not block on this. Start grilling. The first time you sharpen a term, propose creating the file.
4. **If `docs/adr/` is missing** → same posture. Bootstrap on first ADR-worthy decision.

Do not dump the loaded context back at the user. Just absorb it and use it.

---

## Phase 1 — Grill (the core loop)

For each branch of the design tree:

1. **Identify the next undecided node.** Don't skip ahead.
2. **Frame one question** with your recommended default and a one-line rationale.
3. **Inspect the codebase** if the question can plausibly be answered there. Cite the file with `file:src/.../foo.ts` syntax.
4. **Cross-check the glossary.** If any term in the question is in `CONTEXT.md`, link the definition into your framing so the user sees you're using the canonical sense.
5. **Listen for fuzzy language** in the user's reply. When you hear it:
   - Quote it back: *"You said 'the strip' — do you mean the **Exercise Strip** (horizontal scroller on the workout screen) or the **Day Strip** (program builder day picker)?"*
   - Get to a precise term. Update or queue an update to `CONTEXT.md`.
6. **Flag ADR-worthy decisions on the spot.**
7. **Move to the next branch.** Repeat.

### Question patterns that work

Inherit all from `grill-me` (forced trade-off, boundary probe, scope cut, reverse goal, cost surfacing, existing-code check). Plus, specific to this skill:

- **Glossary collision**: "You're using *suggestion* but `CONTEXT.md` already defines **Load Suggestion**. Same thing, or a new concept?"
- **Term sharpening**: "Ground 'the AI flow' for me — is this **AI Quick Workout** or **AI Program Generation**? Different code paths."
- **Reversibility check**: "Once we ship X, can we walk it back? If not, this is an ADR."

### Anti-patterns

All from `grill-me`, plus:

- Adding a term to `CONTEXT.md` without confirming the definition with the user
- Writing an ADR for a decision the user hasn't actually committed to
- Asking about something the existing glossary already answers

---

## Phase 2 — Live glossary updates

When a sharpened or new term lands:

1. Confirm definition with the user in one line (*"Locking in: **Pitched Workout** = a session whose `program_id` is null but `pitch_id` is set. Good?"*).
2. If `docs/CONTEXT.md` exists → patch it now (one term at a time, so the user sees each diff).
3. If `docs/CONTEXT.md` does not exist → on the first locked-in term, create it with the skeleton below, then add the term.

### `docs/CONTEXT.md` skeleton

```markdown
# GymLogic — Ubiquitous Language

Shared vocabulary used by the codebase, the product team, and anything we'd explain to a domain expert (a coach, a beta tester, a future-you). When you find yourself writing a term in a doc, a variable name, or a chat message, the canonical definition lives here.

> Out of scope for now: a multi-context map. Single context, single file. Split later if it grows beyond ~150 terms.

## Conventions

- **Bold** for the canonical term, exactly as it should appear in code (`PascalCase` types, `camelCase` fields) and in docs (Title Case prose).
- One-sentence definition first; expand only when needed.
- Cross-reference other terms with **bold**; never paraphrase.
- Add a `→ file:src/.../foo.ts` link when a term has an obvious code anchor.

---

## Sessions & sets

(empty — fill on demand)

## Programs & cycles

(empty — fill on demand)

## Exercises & catalog

(empty — fill on demand)

## MCP

(empty — fill on demand)

## Achievements

(empty — fill on demand)
```

Section list above mirrors the README's feature areas. Add a section only when you need it.

### Term entry format

```markdown
**Term Name**:
One-sentence definition. Cross-reference other **Terms** in bold. Optional second sentence for an edge case or non-obvious nuance.
→ `file:src/path/to/anchor.ts` (optional)
```

---

## Phase 3 — ADRs for non-obvious decisions

### When to write an ADR

Three triggers — at least **one must be clearly true**, or skip:

1. **Hard to reverse** — schema migration, public API shape, third-party integration choice, RLS policy.
2. **Surprising without context** — anyone reading the code six months from now would ask "why?" (e.g. "we use `ON DELETE RESTRICT` for programs to force conscious detachment").
3. **Real trade-off with downstream consequences** — picking option A explicitly closes door B in a way that matters.

If the decision is just taste or easily reversed (renaming a local variable, choosing between two interchangeable utility libs that aren't yet installed), **do not write an ADR**.

### ADR file location & naming

```
docs/adr/NNNN-kebab-title.md
```

- `NNNN` = next 4-digit number (find with `ls docs/adr/ 2>/dev/null | sort | tail -1`). Start at `0001` if the folder is empty.
- Title is short, action-oriented kebab-case (`0007-restrict-pitch-deletion.md`).

### ADR template

```markdown
# ADR NNNN — {Title}

- **Status:** Accepted
- **Date:** YYYY-MM-DD
- **Decided in:** chat / pairing session / PR #NNN (whatever applies)

## Context

What's the situation? What forces are at play (tech, product, user, ops)? Reference **glossary terms** in bold so the reader can resolve them in `docs/CONTEXT.md`.

## Decision

The decision in 1-3 sentences. Active voice. "We will…".

## Consequences

- **Positive:** what this unlocks or simplifies.
- **Negative:** what this costs us, what we give up.
- **Follow-ups:** anything that needs to happen because of this (migration, doc, code change, future ADR).

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| ... | ... |
```

### When to write the ADR

- **Lightweight decisions** → at the end of the session, in Phase 4, batched.
- **Heavy decisions** (schema, auth, public surface) → propose writing the ADR immediately so the user can sanity-check the framing before the conversation moves on.

Either way, **always confirm with the user** before creating the file: *"This feels ADR-worthy because [reason]. Want me to draft `docs/adr/0008-...`?"*

---

## Phase 4 — Wrap-up

When the user signals stop, print a recap as plain text — same shape as `grill-me`'s, plus the doc deltas:

- **Decisions locked in** (numbered)
- **Branches deferred**
- **Open assumptions**
- **Glossary updates** (terms added / sharpened, with file path)
- **ADRs written** (path + one-line rationale each)
- **Suggested next step**:
  - If we just produced fresh shared language but no plan yet → *"Say **create epic brief** to write this up — the new glossary terms will keep it concise."*
  - If we already have an Epic Brief → *"Say **create tech plan**."*
  - If the grilling exposed a refactor opportunity → *"Say **deepen architecture** to audit the affected modules."*

Do **not** write the Epic Brief / Tech Plan / tickets here. Hand off cleanly.

---

## Decision matrix — which grilling skill?

| Situation | Skill |
|---|---|
| Topic touches the GymLogic codebase (sessions, programs, exercises, MCP, achievements, infra…) | `grill-with-docs` |
| Pure product / strategy / personal brainstorm with no code surface | `grill-me` |
| Already grilled, ready to write a brief | `epic-brief` |
| Already have a brief, ready to architect | `tech-plan` |

Even at the start of a brand-new feature, prefer `grill-with-docs` — that's exactly when establishing shared language pays the most.
