---
name: pr-review
description: >
  Fetch and address GitHub PR review comments tagged with an "eyes" reaction on the current branch's pull request.
  Applies fixes, runs quality checks, commits, and posts resolution replies on GitHub.
  Trigger on phrases like "address PR comments", "review comments", "process PR feedback",
  "handle reviewer feedback", "traite les commentaires de la PR", "adresse les retours de review".
---

# PR Review Comments

Process reviewer comments on the current branch's PR that are tagged with a 👀 reaction, fix each one, commit, and confirm resolution on GitHub.

**Prerequisites**: `gh` CLI authenticated, working directory inside the git repo with an open PR.

---

## Phase 1 — Discovery

Use `required_permissions: ["all"]` for every `gh` call.

### Step 1.1 — PR metadata

```bash
gh pr view --json number,url,labels
```

If this fails with "no pull requests found", tell the user and stop.

Store `PR_NUMBER`, `PR_URL`, `PR_LABELS`.

### Step 1.2 — Related issue number

Extract the issue number from the branch name (convention: `type/<number>/description`):

```bash
git branch --show-current
```

Parse with pattern `(feat|fix|perf|refactor|chore|docs)/(\d+)/`. Store group 2 as `ISSUE_NUMBER`.

If no match, check the PR body for `Closes #\d+` or `Fixes #\d+`. If still nothing, store as empty — it's not blocking.

### Step 1.3 — Issue labels (if issue found)

If `ISSUE_NUMBER` is set:

```bash
gh issue view <ISSUE_NUMBER> --json labels -q '.labels[].name'
```

Store as `ISSUE_LABELS` — used later for tagging commits.

### Step 1.4 — Authenticated user

```bash
gh api user -q .login
```

Store as `CURRENT_USER`.

### Step 1.5 — Fetch review comments (code-level)

```bash
gh api repos/{owner}/{repo}/pulls/{PR_NUMBER}/comments --paginate
```

### Step 1.6 — Fetch issue comments (conversation-level)

```bash
gh api repos/{owner}/{repo}/issues/{PR_NUMBER}/comments --paginate
```

### Step 1.7 — Filter candidates

From both lists, keep only comments where `reactions.eyes > 0`.

### Step 1.8 — Confirm your eyes reaction

For each candidate, verify `CURRENT_USER` reacted with `eyes`:

**Review comment:**
```bash
gh api repos/{owner}/{repo}/pulls/comments/{COMMENT_ID}/reactions
```

**Issue comment:**
```bash
gh api repos/{owner}/{repo}/issues/comments/{COMMENT_ID}/reactions
```

Look for `user.login == CURRENT_USER` and `content == "eyes"`. Discard comments that don't match.

---

## Phase 2 — Planning

If no comments survived filtering, tell the user: "No 👀-tagged comments found on this PR." and stop.

Present a summary table:

| # | Author | Type | File / Line | Comment (truncated) |
|---|--------|------|-------------|---------------------|
| 1 | alice  | review | `src/Foo.tsx:42` | "This should use useMemo..." |
| 2 | bob    | conversation | — | "Can we add a test for..." |

For each comment:
1. Read the full comment body
2. If it's a review comment, read the referenced file around the mentioned line
3. **Critically analyze** — do NOT blindly accept:
   - Does the suggestion actually improve the code?
   - Is the reviewer correct, or did they misunderstand context?
   - Are there trade-offs the reviewer missed?
   - Would you implement it differently?
4. Present your assessment with a verdict:
   - ✅ **Agree** — valid, will implement (describe the fix)
   - 🔄 **Agree, but differently** — concern is valid, different solution (explain)
   - ⚠️ **Debatable** — matter of taste / trade-off; present both sides
   - ❌ **Disagree** — suggestion is incorrect or would make things worse (explain why)

Ask the user to confirm which comments to address before proceeding.

Create a todo list with one item per comment.

---

## Phase 3 — Implementation Loop

For each confirmed comment, in order:

### Step 3.1 — Make the code change

Apply the fix as confirmed in Phase 2.

### Step 3.2 — Quality gate

Before committing, run checks on the changed files:

```bash
npm run lint
npm run build
npm run test
```

Fix any errors before proceeding. Do not commit code that fails checks.

### Step 3.3 — Commit

```bash
git add -A && git commit -m "$(cat <<'EOF'
<commit message describing the fix>

Addresses PR review comment by <author>
EOF
)"
```

### Step 3.4 — Get commit SHA

```bash
git rev-parse --short HEAD
```
Store as `SHORT_SHA`.

```bash
git rev-parse HEAD
```
Store as `FULL_SHA`.

### Step 3.5 — Add thumbs-up reaction

**Review comment:**
```bash
gh api repos/{owner}/{repo}/pulls/comments/{COMMENT_ID}/reactions -f content="+1"
```

**Issue comment:**
```bash
gh api repos/{owner}/{repo}/issues/comments/{COMMENT_ID}/reactions -f content="+1"
```

### Step 3.6 — Post reply with commit SHA

**Review comment** (threaded reply):
```bash
gh api repos/{owner}/{repo}/pulls/{PR_NUMBER}/comments/{COMMENT_ID}/replies -f body="Addressed in \`{SHORT_SHA}\` ({FULL_SHA})"
```

**Issue comment** (new comment quoting the original):
```bash
gh api repos/{owner}/{repo}/issues/{PR_NUMBER}/comments -f body="> @{AUTHOR}: {FIRST_LINE_OF_COMMENT}...

Addressed in \`{SHORT_SHA}\` ({FULL_SHA})"
```

### Step 3.7 — Mark todo complete and move to next

---

## Phase 4 — Push & label

### Step 4.1 — Push all commits

```bash
git push
```

Use `required_permissions: ["full_network"]`.

### Step 4.2 — Add issue labels to PR (if available)

If `ISSUE_LABELS` is non-empty and the PR doesn't already have those labels, add them:

```bash
gh pr edit {PR_NUMBER} --add-label "<label1>,<label2>"
```

Only add labels that actually exist on the repo. Skip silently if no labels to add.

### Step 4.3 — Summary

Present a final summary:

| # | Comment | Verdict | Commit | Status |
|---|---------|---------|--------|--------|
| 1 | alice: "Use useMemo..." | ✅ Agree | `abc1234` | addressed |
| 2 | bob: "Add a test..." | 🔄 Differently | `def5678` | addressed |
| 3 | carol: "Rename this..." | ❌ Disagree | — | skipped |

---

## Edge Cases

- **No PR for current branch**: stop and inform the user.
- **No 👀-tagged comments**: stop and inform the user.
- **API rate limiting**: if `gh api` returns HTTP 403/429, wait 30s and retry once. If still failing, stop.
- **Comment on deleted file**: skip, mark as "skipped — file no longer exists".
- **Ambiguous comment**: ask the user for clarification before proceeding.

## Important

- **No "Made with Cursor" watermark**: when posting any GitHub content (replies, comments, reactions), NEVER include "Made with Cursor" or any AI attribution. Use `gh api` with explicit `-f body=` to prevent auto-appended watermarks.
