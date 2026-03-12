---
name: epic-brief
description: >
  Create an Epic Brief from a GitHub issue through structured refinement phases.
  Fetches the issue, performs gap analysis, challenges assumptions, and generates
  a polished Epic Brief markdown file in docs/. Trigger on phrases like
  "create epic brief", "new epic", "epic from issue", "brief from issue #42",
  "epic brief", "brief this issue".
---

# Epic Brief

Generate an Epic Brief from a GitHub issue, with multi-phase refinement.

The output follows the Epic Brief template defined in `.cursor/rules/docs-format.mdc`. Read that rule before generating any document.

---

## Phase 1 — Intake

### Step 1.1 — Get the issue reference

If the user did not provide a GitHub issue number, use `AskQuestion`:
- Prompt: "Which GitHub issue? (number or URL)"

### Step 1.2 — Fetch the issue

Run via Shell:

```bash
gh issue view {number} --json title,body,labels,comments,assignees
```

Extract and store:
- `TITLE`: issue title
- `BODY`: issue body (the raw brief / feature request)
- `LABELS`: labels for context
- `COMMENTS`: any discussion that adds detail

If the body is very short (< 80 chars) or just a title restatement, check the comments for additional context. If still thin, flag it as a gap in Phase 2.

### Step 1.3 — Read existing docs

Scan `docs/` for any existing Epic Briefs, Tech Plans, or PRD that might overlap or provide context. Read the PRD (`docs/PRD.md`) if it exists — it contains the product vision and roadmap.

---

## Phase 2 — Gap Analysis (Refinement Round 1)

**Do NOT write any document yet.**

Analyze the issue content and produce a structured **Gap Analysis** as a text message to the user. Organize findings into four categories:

### Ambiguities
Things that are vague or open to interpretation:
- Undefined scope boundaries ("improve performance" — of what? by how much?)
- Unclear target audience or user impact
- Vague success criteria

### Missing Information
Things the Epic Brief needs but the issue doesn't provide:
- No success criteria or measurable goals?
- No mention of what's explicitly out of scope?
- No constraints (timeline, tech, compatibility)?
- No mention of affected systems or dependencies?

### Implicit Assumptions
Things the issue takes for granted:
- Assumes a specific tech choice without stating it
- Assumes familiarity with existing architecture
- Assumes certain features already exist

### Contradictions
Anything that conflicts:
- Within the issue itself
- With existing docs in `docs/`
- With the current codebase (if you explored it)

### Ask Questions

After presenting the gap analysis, use `AskQuestion` with **3-5 targeted questions** derived from the most critical gaps. Rules:
- Each question should have **concrete options** when possible, not just "please clarify"
- Include a "I'll decide later / skip" option for non-blocking questions
- Prioritize questions that would change the epic's scope or goals

**Example:**
```
Question: "The issue mentions 'offline support' — what's the scope?"
Options:
  a) Queue writes only (read requires network)
  b) Full offline-first (reads from cache, writes queued)
  c) I'll define this later
```

---

## Phase 3 — Draft & Challenge (Refinement Round 2)

### Step 3.1 — Generate draft

Using the issue content + user answers from Phase 2, generate a **complete draft Epic Brief** following the template. Present the full markdown to the user in a text message (do NOT write the file yet).

### Step 3.2 — Challenge the draft

Alongside the draft, present a **Challenge List** — a numbered list of assumptions and decisions you made that the user should validate:

1. "I assumed X because of Y — correct?"
2. "Scope includes Z but the issue doesn't mention it — should I remove it?"
3. "Goal G has no measurable success criterion — I suggest: [specific metric]. Agree?"
4. "This overlaps with [existing doc] — should we reference it or deduplicate?"
5. "I set [thing] as out of scope — but it might belong in scope. Your call."

### Step 3.3 — Collect feedback

Use `AskQuestion` for the **2-3 most critical challenges** (ones that would materially change the brief). Present the rest as a text list and accept freeform feedback.

If the user has substantial corrections, loop: update the draft and re-present. One additional round max — avoid infinite loops.

---

## Phase 4 — Finalize

### Step 4.1 — Write the file

Incorporate all feedback and write the final Epic Brief to:

```
docs/Epic_Brief_—_{Title}.md
```

Where `{Title}` is derived from the epic's name: spaces become underscores, special chars are preserved (ampersands, parentheses OK).

### Step 4.2 — Summary

Print a short recap:
- What the epic covers (1-2 sentences)
- Key decisions made during refinement
- Any deferred questions or known gaps that should be resolved before the Tech Plan phase
- Suggest: "When you're ready, say **create tech plan** to continue."

---

## Edge Cases

- **Issue not found**: inform the user and stop
- **Issue is actually a bug report**: suggest it might not need an epic — ask if they want a ticket instead
- **Multiple related issues**: ask which one is the primary scope, reference others in Context
- **Overlaps with existing epic**: flag it, ask whether to extend or create a new one
