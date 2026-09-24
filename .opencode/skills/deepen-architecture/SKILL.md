---
name: deepen-architecture
description: >
  Audit the codebase for shallow modules and propose deepening opportunities —
  refactors that hide complexity behind smaller, more testable interfaces.
  Improves agent-navigability by concentrating knowledge instead of scattering
  it. Run periodically (e.g. after a feature push) or before tackling a complex
  area. Trigger on phrases like "review architecture", "deepen modules",
  "improve codebase", "refactor opportunities", "audit code", "agent friendly",
  "rends le code plus testable".
---

# Deepen Architecture

Surface architectural friction in the codebase and propose **deepening opportunities** — refactors that turn shallow modules into deep ones.

The goal: make the code (a) more testable through behavior-first tests, and (b) easier for both humans and agents to navigate without bouncing between many tiny files to understand a single concept.

---

## Glossary — use these terms exactly

Consistency is the point. Don't drift into "service", "boundary", "layer".

- **Module** — anything with an interface and an implementation: function, hook, component, lib file, supabase function, slice of Jotai state.
- **Interface** — everything a caller must know to use the module: types, invariants, error modes, ordering, config. Not just the type signature.
- **Implementation** — what's inside.
- **Depth** — leverage at the interface. **Deep** = small interface, rich implementation, lots of behavior earned per concept exposed. **Shallow** = interface nearly as complex as the implementation, almost a pass-through.
- **Seam** — a place where behavior can be altered without editing in place (e.g. a hook that swaps strategies, a component that takes children). Not the same as "layer".
- **Locality** — the maintainer property: when a concept changes, the change is concentrated in one place rather than rippling across many files.

### Two diagnostic principles

- **Deletion test**: imagine deleting the module. If complexity vanishes, it was a pass-through (shallow). If complexity reappears across N callers because they each have to do the work themselves, it was earning its keep (deep).
- **The interface is the test surface.** If a module is hard to test through its public interface, that's not a testing problem — that's an interface design problem.

---

## Process

### Phase 1 — Pick the area

Ask the user (`AskQuestion`) what to audit, with concrete options:

- A specific area (e.g. *"workout session", "exercise library", "supabase MCP edge functions", "onboarding"*)
- "Recently changed code" — last N commits or current branch diff
- "Whole codebase, hot spots only" — broader sweep

Don't audit everything every time. Pick a focused scope.

### Phase 2 — Explore

Launch one or more `Task` subagents with `subagent_type: "explore"` (`thoroughness: medium` by default, `very thorough` if the user asked for a deep audit). The exploration brief:

> Map the module structure of `<area>`. For each module, note: file path, public interface (exported symbols), what callers use, and whether its complexity is concentrated or scattered. Flag any of the following: pure functions extracted purely for testability, files smaller than ~30 lines that exist only to break up another file, components/hooks that take more props than they have lines of body, files that re-export from another file with no transformation, anywhere understanding one concept requires reading 4+ files.

While waiting, also read:

- The relevant `.cursor/rules/*.mdc` files for the area (e.g. `prefer-functional-style`, `react-no-unnecessary-effects`) so you don't suggest refactors that contradict house style.
- Any `Tech_Plan_—_*.md` or `Epic_Brief_—_*.md` in `docs/` that references the area, plus the same files in `docs/done/` to understand prior decisions.

### Phase 3 — Look for friction (organic, not checklist-driven)

Walk the area noting where you experience friction:

- **Where does understanding one concept require bouncing between many small files?**
- **Where are modules shallow** — interface nearly as complex as the implementation?
- **Where have pure functions been extracted just for testability**, while real bugs hide in how they're called (no locality)?
- **Where do tightly-coupled modules leak across their seams** — e.g. a "presentational" component that secretly mutates an atom or fires a side effect?
- **Which parts are untested or hard to test through the current interface?**
- **Where do props or hook arguments balloon** because the interface is doing the work of N concepts at once?

Apply the **deletion test** to anything you suspect is shallow: would deleting this module concentrate complexity (shallow → delete) or scatter it (deep → keep).

### Phase 4 — Present candidates

Present a numbered list of deepening opportunities. **Do not propose new interfaces yet** — that comes after the user picks one. For each candidate:

```
N. <One-line title>

  Files:
    - file:src/.../foo.ts (currently 12 LoC, 4 callers)
    - file:src/.../bar.ts (currently 18 LoC, same 4 callers)

  Problem:
    Concrete description of the friction. Reference the diagnostic
    that triggered it (deletion test failure, scattered concept,
    hard-to-test interface, etc.).

  Solution sketch:
    Plain English description of the deepening — "merge the two,
    expose only `<thing>(input): output`, hide the intermediate
    representation". No code yet.

  Benefits:
    - Locality: <what change becomes 1-place instead of N-places>
    - Leverage: <what callers stop having to do themselves>
    - Tests: <how the test surface improves — fewer mocks, clearer
      behavior names, fewer brittle setup steps>

  Cost / risk:
    Be honest. Migration cost, behavior risk, who else touches it.

  Conflicts (if any):
    "Contradicts the data-model decision in
    docs/Tech_Plan_—_X.md — worth revisiting because <reason>."
    Only flag if the friction genuinely warrants reopening the decision.
```

Then ask (`AskQuestion`): **"Which of these would you like to explore?"** — present them as options, let the user pick one (or multiple).

### Phase 5 — Grill the chosen candidate

Drop into a focused interrogation about the picked candidate. **Use the `grill-me` skill explicitly here** — same posture: walk the design tree, one question at a time, recommend a default for each.

Cover at minimum:

- **Constraints** — what callers exist, what's their access pattern, any external API guarantees.
- **The deepened interface** — what's the smallest set of types/functions the caller needs? What's hidden inside?
- **Tests that survive** — which existing tests still make sense post-refactor? Which become redundant? Which new behavior tests does the interface enable?
- **Migration path** — incremental (introduce alongside, then swap) or atomic (PR replaces the old in one shot)?
- **Reversibility** — if this turns out wrong, how expensive to undo?

### Phase 6 — Decide and document

Three possible outcomes:

1. **Go ahead now**: hand off to the user with a concrete plan. Suggest: *"Say **start branch** and we can implement, ideally with the **tdd** skill driving."*
2. **Defer with a reason**: stash the candidate. If the reason is load-bearing (something a future explorer would need to know to avoid re-suggesting it), offer to capture it: *"Want me to add a section to `docs/PRD.md` under 'Architectural Constraints' so this doesn't get re-proposed?"* Skip this for ephemeral reasons ("not worth it right now") and self-evident ones.
3. **Reject**: the candidate doesn't actually help. Note why, move on to the next.

---

## Edge cases

- **No clear friction found**: that's a valid outcome. Print *"audited <area>, no deepening opportunities worth the cost. Architecture is healthy here."* and stop.
- **Candidate touches >10 files**: split it into smaller deepening steps before presenting. A single deepening should fit in 1-2 PRs.
- **User wants to skip Phase 5 grilling**: respect it, but warn that under-specified deepenings tend to balloon mid-implementation.
- **Conflict with a recent rule or pattern**: surface it. Don't quietly contradict house style.

---

## How often to run this

- After a feature push that added significant code (post-merge audit).
- Before tackling a complex area you haven't touched in a while.
- When you notice the same area showing up repeatedly in `tech-plan` exploration as "messy".

Don't run it weekly out of habit — run it when there's a reason.
