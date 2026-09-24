---
name: start-branch
description: >
  Create a new branch from a GitHub issue. Checks out main, pulls latest,
  and creates a branch following the convention type/issue-number/description.
  Fetches open issues if no number is provided. Trigger on phrases like
  "start branch", "new branch", "branch from issue", "start issue",
  "init branch", "commence le ticket", "nouvelle branche".
---

# Start Branch from Issue

Check out `main`, pull latest, and create a new branch tied to a GitHub issue.

**Branch convention**: `<type>/<issue-number>/<short-description>`

Examples: `feat/18/exercise-seed-data`, `fix/23/offline-sync-race-condition`, `perf/31/reduce-bundle-size`

**Prerequisites**: `gh` CLI authenticated, inside the git repo.

---

## Phase 1 — Resolve the issue

### Step 1.1 — Issue number provided?

If the user already gave an issue number (e.g. "start branch for #18", "new branch issue 18"), store it as `ISSUE_NUMBER` and skip to Step 1.3.

### Step 1.2 — Pick from open issues

If no number was provided, fetch the list:

```bash
gh issue list --state open --limit 20 --json number,title,labels
```

Use `AskQuestion` to present the issues as options. Format each option as `#<number> — <title>`. Do **not** include a "None" option — a branch must be tied to an issue.

Store the selected `ISSUE_NUMBER`.

### Step 1.3 — Fetch issue details

```bash
gh issue view <ISSUE_NUMBER> --json title,labels,body
```

Store `ISSUE_TITLE`, `ISSUE_LABELS`, and `ISSUE_BODY`.

---

## Phase 2 — Determine branch type

Infer the branch type prefix from issue labels and title:

| Label or keyword             | Prefix  |
|------------------------------|---------|
| `enhancement`, `feature`     | `feat`  |
| `bug`                        | `fix`   |
| `performance`                | `perf`  |
| `documentation`, `docs`      | `docs`  |
| `refactor`                   | `refactor` |
| `chore`, `maintenance`       | `chore` |

If ambiguous or no label matches, use `AskQuestion`:
- Prompt: "What type of change is this?"
- Options: `feat` / `fix` / `perf` / `refactor` / `chore` / `docs`

Store as `BRANCH_TYPE`.

---

## Phase 3 — Build branch name

### Step 3.1 — Generate description slug

From `ISSUE_TITLE`, produce a short kebab-case slug:
- Lowercase
- Replace spaces with hyphens
- Strip special characters (parentheses, ampersands, quotes, etc.)
- Truncate to ~5 words max for readability

Example: "Exercise Content & Seed Data" → `exercise-content-seed-data`

### Step 3.2 — Assemble

```
BRANCH_NAME = "<BRANCH_TYPE>/<ISSUE_NUMBER>/<slug>"
```

Example: `feat/18/exercise-content-seed-data`

---

## Phase 4 — Checkout and create

### Step 4.1 — Clean working tree

```bash
git status --porcelain
```

If non-empty, **stop** and tell the user there are uncommitted changes. Suggest stashing or committing first.

### Step 4.2 — Switch to main and pull

```bash
git checkout main && git pull origin main
```

Use `required_permissions: ["full_network"]`.

### Step 4.3 — Create and checkout the new branch

```bash
git checkout -b <BRANCH_NAME>
```

### Step 4.4 — Confirm

Tell the user:
- Branch created: `<BRANCH_NAME>`
- Issue: `#<ISSUE_NUMBER> — <ISSUE_TITLE>`
- Quick summary of the issue body (1-2 sentences)

---

## Edge Cases

- **Dirty working tree**: Phase 4.1 catches this — suggest `git stash` or committing.
- **Already on the target branch**: if `BRANCH_NAME` already exists locally, inform the user and ask whether to check it out or pick a different name.
- **Main is behind remote**: `git pull` in Phase 4.2 handles this.
- **Issue not found**: `gh issue view` will fail — report and stop.
- **No open issues**: inform the user there are no open issues to work on.
