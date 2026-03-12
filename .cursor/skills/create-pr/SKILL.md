---
name: create-pr
description: >
  Push the current branch and open a GitHub PR with a What/Why/How description.
  Infers the related GitHub issue from branch name, tickets, or epic briefs in docs/.
  Trigger on phrases like "create a PR", "open PR", "push and PR", "ouvre une PR",
  "create pull request", "submit PR".
---

# Create PR

Push the current branch and open a GitHub PR on `PierreTsia/workout-app` with a structured description.

**Prerequisites**: `gh` CLI authenticated, inside the git repo with commits ahead of `main`.

---

## Phase 1 — Pre-flight

### Step 1.1 — Clean working tree

```bash
git status --porcelain
```

If output is non-empty, **stop** and tell the user there are uncommitted changes.

### Step 1.2 — Commits ahead

```bash
git log --oneline origin/main..HEAD
```

If empty, **stop** — nothing to open a PR for.

### Step 1.3 — Existing PR check

```bash
gh pr view --json url 2>/dev/null
```

If a PR already exists, show its URL and ask whether the user wants to update it instead.

---

## Phase 2 — Push

```bash
git push -u origin HEAD
```

Use `required_permissions: ["full_network"]`.

---

## Phase 3 — Gather context

Run in parallel:

```bash
git branch --show-current
git log --oneline origin/main..HEAD
git diff origin/main...HEAD --stat
```

Store `BRANCH_NAME`, `COMMIT_LOG`, and `DIFF_STAT`.

---

## Phase 4 — Infer related GitHub issue

Try each source in order until an issue number is found:

### 4.1 — Branch name

Look for patterns like `#123`, `issue-123`, `feat/123-`, `fix/123-` in `BRANCH_NAME`. Extract the number.

### 4.2 — Ticket / Epic docs

Scan `docs/` for tickets or epic briefs that reference a GitHub issue number (`#\d+`, `closes #\d+`, `github.com/.../issues/\d+`). Match by topic similarity with the commit log.

### 4.3 — Open issues list

If still no match, run:

```bash
gh issue list --state open --limit 20 --json number,title
```

Present the list and use `AskQuestion` to let the user pick one — include a "None / not linked" option.

Store `ISSUE_NUMBER` (may be empty).

---

## Phase 5 — Draft PR content

From `COMMIT_LOG`, `DIFF_STAT`, and any docs context, draft:

- **Title**: concise summary derived from the commits (not the branch name verbatim)
- **What**: 1-3 bullet points — what changed
- **Why**: the motivation — why these changes matter
- **How**: brief technical approach — key implementation choices

If `ISSUE_NUMBER` is set, append `Closes #<number>` at the end of the body.

---

## Phase 6 — Draft or ready?

If the user already specified "draft" or "ready" in their prompt, use that. Otherwise, use `AskQuestion`:
- Prompt: "Open as draft or ready for review?"
- Options: `Draft` / `Ready for review`

Store as `IS_DRAFT`.

---

## Phase 7 — Sanity checks (ready PRs only)

**Skip this phase entirely if `IS_DRAFT`.** Draft PRs are work-in-progress by definition.

For ready PRs, run the full check suite. Stop and report at the first failure — do not push broken code.

### Step 7.1 — Lint

```bash
npm run lint
```

### Step 7.2 — Type check & build

```bash
npm run build
```

(`build` runs `tsc -b && vite build`, so type checking is included.)

### Step 7.3 — Unit tests

```bash
npm run test
```

(Runs `vitest run` — unit tests only, no e2e.)

If **any step fails**, stop immediately. Report the errors to the user and do not proceed to PR creation.

---

## Phase 8 — Create PR

Draft PR:

```bash
gh pr create --draft --title "<title>" --body "$(cat <<'EOF'
## What

<what section>

## Why

<why section>

## How

<how section>

<Closes #ISSUE_NUMBER if set>
EOF
)"
```

Ready PR — **MUST include `--reviewer "copilot"`**:

```bash
gh pr create --title "<title>" --reviewer "copilot" --body "$(cat <<'EOF'
## What

<what section>

## Why

<why section>

## How

<how section>

<Closes #ISSUE_NUMBER if set>
EOF
)"
```

Use `required_permissions: ["all"]`.

**Important**: For ready (non-draft) PRs, always add `--reviewer "copilot"` to request a Copilot review. Never skip this flag.

Display the PR URL to the user.

---

## Edge Cases

- **No commits ahead of main**: stop and inform the user.
- **PR already exists**: detect via `gh pr view` — show existing URL, offer to update.
- **No related issue found**: that's fine — create the PR without a `Closes` line.
- **Branch not pushed**: Phase 2 handles this.
- **Dirty working tree**: Phase 1 catches this early.

## Important

- **No "Made with Cursor" watermark**: when creating PRs, NEVER include "Made with Cursor" or any AI attribution. Use `--body-file` with a temp file or HEREDOC to prevent auto-appended watermarks. If Cursor adds one, strip it before submission.
