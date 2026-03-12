---
name: tech-plan
description: >
  Create a Tech Plan from an existing Epic Brief through structured refinement phases.
  Explores the codebase, proposes architecture, stress-tests decisions, and generates
  a polished Tech Plan markdown file in docs/. Trigger on phrases like
  "create tech plan", "tech plan", "technical plan", "plan for epic",
  "architecture for epic", "tech plan for this brief".
---

# Tech Plan

Generate a Tech Plan from an Epic Brief, with codebase exploration and multi-phase refinement.

The output follows the Tech Plan template defined in `.cursor/rules/docs-format.mdc`. Read that rule before generating any document.

---

## Phase 1 — Context Gathering

### Step 1.1 — Locate the Epic Brief

Search `docs/` for `Epic_Brief_—_*.md` files. If multiple exist, use `AskQuestion` to ask which one. If only one non-`done/` brief exists, confirm it with the user.

Read the Epic Brief thoroughly — internalize the summary, goals, scope, and success criteria.

### Step 1.2 — Read existing architecture docs

Read these if they exist:
- `docs/PRD.md` — product vision, tech stack, data model
- Any existing Tech Plans in `docs/` or `docs/done/` — to understand established patterns and avoid contradicting prior decisions
- `package.json` — current dependencies and scripts

### Step 1.3 — Explore the codebase

Launch explore subagents (use the Task tool with `subagent_type: "explore"`) to map the areas relevant to the epic's scope. Run up to 3 in parallel, targeting:

1. **Project structure & tech stack**: folder layout, key config files, framework/library choices
2. **Domain-relevant code**: files, modules, hooks, services that the epic will touch or extend
3. **Data layer**: database schema, API calls, state management patterns, existing data models

Synthesize findings into a mental model of: what exists, what patterns are established, what the epic needs to add or change.

---

## Phase 2 — Architectural Thinking (Refinement Round 1)

**Do NOT write the full plan yet.**

Present an **Architectural Synopsis** as a text message — a concise preview of your thinking:

### Proposed Approach
3-5 bullet points describing the high-level strategy. Be opinionated — state what you'd choose and why.

### Key Technology / Library Choices
For each significant choice, state:
- What you'd use
- Why (1 sentence)
- What you considered and rejected (1 sentence)

### Identified Risks & Failure Modes
List 3-5 things that could go wrong:
- Technical risks (performance, complexity, coupling)
- Integration risks (conflicts with existing code)
- Data risks (migrations, backwards compatibility)

### Open Questions
Things you found during exploration that need the user's input before you can finalize the plan.

### Ask Questions

Use `AskQuestion` with **3-5 targeted questions** about the most consequential decisions:

- **Technology trade-offs**: "Use X vs Y for this — here's why I lean X: [reason]. But Y would be better if [condition]. Which fits?"
- **Data model decisions**: "New table vs extending existing? Trade-off: [explain]. Preference?"
- **Integration concerns**: "This touches `file:path/to/module.ts` which currently does W — refactor it or work around it?"
- **Performance/scale**: "This approach is O(n) per request — acceptable at your scale, or should I optimize?"
- **Scope clarification**: "The Epic Brief says X but the codebase already has Y — should the plan build on Y or replace it?"

Each question should have concrete options, not open-ended "what do you think?"

---

## Phase 3 — Draft & Stress-Test (Refinement Round 2)

### Step 3.1 — Generate draft

Using the Epic Brief + codebase exploration + user answers from Phase 2, generate a **complete draft Tech Plan** following the template. Include:

- **Key Decisions table**: every significant choice with rationale
- **Critical Constraints**: side effects, coupling, migration concerns — reference specific files with `file:path`
- **Data Model**: mermaid diagrams for new or modified entities, schema snippets, localStorage shapes if applicable
- **Component Architecture**: mermaid graph of the component/module hierarchy, file-responsibility tables, detailed component descriptions
- **Failure Mode Analysis**: table of what-if scenarios and their behavior

Present the full markdown to the user in a text message (do NOT write the file yet).

### Step 3.2 — Stress-Test the draft

Alongside the draft, present a **Stress-Test List** — proactively poking holes in your own plan:

1. "What happens when [failure scenario]? Currently handled by [X], or unhandled."
2. "If [assumption] turns out wrong, the data model breaks at [specific point] — here's the migration escape hatch: ..."
3. "This creates coupling between [X] and [Y] — acceptable because [reason], or should we decouple via [alternative]?"
4. "Migration path if we need to change [decision] later: [describe effort]"
5. "Inconsistency check: the Epic Brief says [A] but this plan proposes [B] — intentional because [reason]."

### Step 3.3 — Collect feedback

Use `AskQuestion` for the **2-3 most consequential decisions** (ones where changing your mind later would be expensive). Present the rest as text and accept freeform feedback.

If the user has substantial corrections, loop once: update the draft and re-present.

---

## Phase 4 — Finalize

### Step 4.1 — Write the file

Incorporate all feedback and write the final Tech Plan to:

```
docs/Tech_Plan_—_{Title}.md
```

Use the same `{Title}` as the Epic Brief (strip the `Epic_Brief_—_` prefix, keep the rest).

### Step 4.2 — Summary

Print a short recap:
- Architectural approach in 2-3 sentences
- Key decisions made during refinement (list the most impactful ones)
- Any deferred items or known risks accepted
- Suggest: "When you're ready, say **split into tickets** to continue."

---

## Edge Cases

- **No Epic Brief found**: ask the user if they want to create one first (suggest the `epic-brief` skill)
- **Epic Brief is stale**: if the brief references features already implemented or contradicts current code, flag it
- **Codebase exploration reveals blockers**: surface them in Phase 2 as open questions before drafting
- **User wants to skip refinement**: respect it, but warn that unresolved ambiguities will propagate to tickets
