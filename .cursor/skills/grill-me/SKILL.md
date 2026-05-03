---
name: grill-me
description: >
  Interview the user relentlessly about a plan, idea, or design until reaching
  shared understanding. Walks down each branch of the design tree, resolves
  dependencies between decisions, and explores the codebase whenever a question
  can be answered there instead of asked. Trigger on phrases like "grill me",
  "challenge ce plan", "stress test cette idée", "interroge-moi", "design tree",
  "let's nail this down".
---

# Grill Me

Interview the user **relentlessly** about every aspect of the plan or idea until you reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one by one. For every question, **provide your recommended answer with rationale**.

**Ask one question at a time.** No batches. No multi-question dumps.

**If a question can be answered by exploring the codebase, explore the codebase instead.** Don't ask the user something you can find out yourself in 30 seconds.

---

## Operating principles

1. **No premature artifact.** Do NOT write a PRD, Epic Brief, Tech Plan, ticket, or code while grilling. The output of this skill is a shared mental model — nothing else.
2. **Walk the design tree.** Every decision opens new branches. Don't skip ahead. Resolve the current node before descending.
3. **Recommend, don't just ask.** Each question must come with your default answer ("I'd lean X because Y — agree?"). The user disagrees? Branch. The user agrees? Move on.
4. **Be opinionated.** Push back on vague answers. "Make it fast" → "Fast for whom? p50 < 200ms or p95 < 500ms? On what device class?"
5. **Stop conditions.** Stop when (a) the user explicitly says "ok let's write it / on a fait le tour", or (b) you genuinely have no more meaningful questions. **Never stop just because it feels long.** A real grilling can last 30+ questions.

---

## Question patterns that work

- **Forced trade-off**: "X or Y? You can't have both because Z."
- **Boundary probe**: "What happens at the edge — empty list? offline? race condition?"
- **Scope cut**: "If we shipped half of this, which half?"
- **Reverse goal**: "What would a successful version look like 3 months after launch?"
- **Cost surfacing**: "This adds [X complexity] — is it worth it vs [cheaper alternative]?"
- **Existing-code check**: before asking, search the repo. "Found `file:src/.../foo.ts` does Y already — extend or replace?"

## Anti-patterns to avoid

- Multi-question dumps ("here are 5 questions")
- "What do you think?" with no recommendation attached
- Skipping branches because they feel boring
- Asking things you can grep for
- Writing a doc the moment the user gives 2-3 confident answers

---

## When done

Print a short recap as plain text:

- **Decisions locked in** (numbered list)
- **Branches deferred** (anything we agreed to revisit later)
- **Open assumptions** (things we agreed to without verifying)
- **Suggested next step**: e.g. "Say **create epic brief** to write this up", or "Say **create tech plan** if you already have a brief".

Do NOT write any file. The next skill in the chain handles that.
