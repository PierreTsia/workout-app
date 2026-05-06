# T110 — Plugin Packaging (Research + Structure)

## Goal

Research-shaped: figure out Anthropic's plugin format, decide repo structure (subfolder of `workout-app` vs separate `PierreTsia/gymlogic-claude-plugin` repo), package the existing `skills/gymlogic-mcp/SKILL.md` into a valid plugin layout, and run `claude plugin validate` until it passes locally.

This is the gating ticket for Track B (Plugin Submission). The output is **either a working plugin layout** (commit-ready) **or a mini-Tech-Plan documenting why the format is more involved than expected** and what T110a should look like.

Addresses Epic Brief story **6** + Tracks **B1 + B2**.

## Mode

**HITL** — research-shaped: format spec may demand judgment we can't predict. Decision on repo structure (subfolder vs separate) involves trade-offs. Mid-flight, this could split into T110 (research → mini Tech Plan) + T110a (implement) if format complexity warrants.

## Slice

`Anthropic plugin format research (docs + reference plugins)` → `repo structure decision (ADR 0002 if non-trivial)` → `package skill per format` → `claude plugin validate passes locally`

## Dependencies

None technically — could start in parallel with T105 deploy. Realistically: do this after PR #322 merges so the codebase is stable.

## Scope

### 1. Research Anthropic plugin format

Reference docs:
- https://docs.claude.com/en/docs/claude-code/plugins
- https://docs.claude.com/en/docs/claude-code/skills (the plugin format extends Cursor-style skills)
- Existing reference plugins: search GitHub for `topic:claude-plugin` or `topic:anthropic-plugin` if any are public.

Document findings:
- Required files: `claude.json` (manifest), `commands/*.md`, `agents/*.md`, `skills/*.md` — which are required vs optional?
- Manifest schema: name, description, version, dependencies, etc.
- Validation: what does `claude plugin validate` check?
- Submission: format expected by `claude.com/plugins/submit` (zip? GitHub repo URL? both?).

### 2. Repo structure decision

Two options:

| Option | Path | Pros | Cons |
|---|---|---|---|
| **A. Subfolder** | `plugins/gymlogic-claude/` in `PierreTsia/workout-app` | Single source of truth; CI gates apply; skill can `import`/`require` from `skills/gymlogic-mcp/SKILL.md` if format permits cross-references | Plugin's repo URL is a sub-path; some validators may not accept |
| **B. Separate repo** | `PierreTsia/gymlogic-claude-plugin` | Clean repo URL for submission form; independent versioning; conventional plugin layout | Two repos to keep in sync; manual copy of skill content; CI duplication |

**Decision criterion**: if Anthropic's submission form accepts subfolder URLs (`https://github.com/PierreTsia/workout-app/tree/main/plugins/gymlogic-claude`), pick **A**. If it requires top-level repo, pick **B**.

If picking **B**: bootstrap the new repo with `mkdir gymlogic-claude-plugin && cd gymlogic-claude-plugin && git init && gh repo create --public --source=. --push`. Set up minimal CI (`.github/workflows/validate.yml` running `claude plugin validate` on PR).

**Document the decision**: write a short ADR 0002 (or a note in `docs/CONTEXT.md` under a new "Plugin" section) explaining the choice + rationale. Especially important if you pick B — the cross-repo sync risk needs surfacing.

### 3. Package the skill

Whichever structure you pick, the file layout is roughly:

```
gymlogic-claude/                  (or plugins/gymlogic-claude/ in subfolder mode)
├── claude.json                   # plugin manifest
├── README.md                     # public-facing description
└── skills/
    └── gymlogic-mcp/
        └── SKILL.md              # copied or symlinked from skills/gymlogic-mcp/SKILL.md
```

(Adjust per actual format requirements from step 1.)

**`claude.json` minimal manifest** (verify schema in step 1):

```jsonc
{
  "name": "gymlogic-mcp",
  "version": "1.0.0",
  "description": "Personalized strength training co-pilot. Build programs, log workouts, track progress.",
  "author": {
    "name": "Pierre Tsiakkaros",
    "url": "https://www.gymlogic.me"
  },
  "skills": ["./skills/gymlogic-mcp/SKILL.md"],
  "mcpServer": {
    "url": "https://mcp.gymlogic.me/functions/v1/mcp"
  }
}
```

### 4. Symlink vs copy strategy for SKILL.md

If picking option A (subfolder):
- Symlink `plugins/gymlogic-claude/skills/gymlogic-mcp/SKILL.md → ../../../../skills/gymlogic-mcp/SKILL.md`. Single source of truth; updates to the master skill propagate automatically.
- Verify the symlink survives git (Git does support symlinks but Windows users may have issues; for solo-dev macOS, fine).

If picking option B (separate repo):
- Copy `SKILL.md` content. Set up a CI gate in `workout-app` that fails if `skills/gymlogic-mcp/SKILL.md` changes without a matching PR in the plugin repo (or document as a manual sync responsibility).

### 5. `claude plugin validate`

Install the Claude CLI:

```bash
npm install -g @anthropic-ai/claude-cli   # or whatever the install path is — verify in step 1
```

Run validation:

```bash
cd <plugin-root>
claude plugin validate
```

Iterate until clean. Common issues to expect:
- Missing required manifest fields.
- Skill format mismatch (Cursor-style vs Anthropic-style frontmatter).
- README format requirements.

### 6. Document the outcome

Update `docs/CONTEXT.md` with a `Plugin` section:

```markdown
## Plugin

**Anthropic Plugin**:
The packaged `gymlogic-mcp` skill submitted to Anthropic's Plugin Directory at `claude.com/plugins/submit`. Lives at `<repo path>` per ADR 0002 (or rationale here). Synced with the master skill at `skills/gymlogic-mcp/SKILL.md` via <symlink / manual sync / CI check>.
```

Plus an ADR 0002 if the structure decision was non-obvious.

### 7. Wildcard exit — split into T110a if needed

If at step 1 you discover the format requires more than `claude.json` + a wrapper skill (e.g. requires `commands/*.md` + `agents/*.md` + per-tool capability declarations), STOP coding and:

- Write a mini Tech Plan (`docs/Tech_Plan_—_Plugin_Packaging.md`) describing what the format actually demands.
- Open T110a referencing the Tech Plan; T110 closes as research-only.

The original Tech Plan flags this risk (T110 is the "wildcard" — could blow to L).

## Out of Scope

- Submission to Plugin Directory (T111).
- Marketing for the plugin.
- Cross-listing on Cursor's marketplace, etc.

## Acceptance Criteria

- [ ] Anthropic plugin format documented in `docs/CONTEXT.md` (Plugin section) or ADR 0002.
- [ ] Repo structure decision made + rationale recorded.
- [ ] Plugin packaged in chosen location (subfolder or separate repo).
- [ ] `claude plugin validate` passes locally.
- [ ] Skill sync strategy (symlink / copy / CI) documented.
- [ ] Demoable: run `claude plugin validate` in front of a colleague; output is clean.
- [ ] If format is more complex than expected: T110a opened with mini Tech Plan, T110 closed as research-only.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Track B1 + B2, story 6)
- Tech Plan: `file:docs/Tech_Plan_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Implementation Notes → Deferred ticket scope: B1; Stress-Test #6 — wildcard sizing risk)
- Anthropic plugin docs: https://docs.claude.com/en/docs/claude-code/plugins
- Anthropic plugin submission: https://claude.com/plugins/submit
- Master skill (raw material): `file:skills/gymlogic-mcp/SKILL.md`
- Glossary template: `file:docs/CONTEXT.md`
