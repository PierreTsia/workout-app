---
name: blog-post
description: >
  Co-write a blog post for the GymLogic site that doesn't smell like LLM filler.
  Mines the repo (epic briefs, tech plans, ADRs, PRs, commits) and the user's
  brain (one-question-at-a-time grilling) for evidence and angle, then drafts
  an MDX post grounded in real artifacts and run through a strict anti-LLM-BS
  self-review. Trigger on phrases like "blog post", "new blog post", "write a
  blog post", "turn this PR into a post", "write up X", "post about #149",
  "écrire un article", "rédiger un post de blog".
---

# Blog Post

Co-write an MDX blog post for `web/src/content/blog/`. The blog has two lanes — **engineering write-ups** and **product/science explainers** (e.g. mesocycle periodization grounded in training science). Both share the same anti-BS bar.

The skill is a **co-writer**, not a solo drafter. It grills the user for the human angle one question at a time, anchors every claim in a real artifact (PR, commit, file, paper, screenshot), and runs a hard anti-LLM-BS pass before output.

---

## Operating principles

1. **Always propose, never ask open.** Every question — angle, audience, archetype, outline shape, section ordering, voice register, length, even the title — comes with a **recommended answer and a one-sentence rationale**. The user disagrees? Branch. Agrees? Move on. Never *"what do you think about X?"*. Always *"I'd lean X because Y — agree, or push back?"*. This is the `grill-me` pattern; it applies here too.
2. **One question at a time.** No batches. No multi-question dumps. If you have five things to clarify, that's five exchanges.
3. **Grep before asking.** If a question is answerable by reading the repo (file path, schema shape, existing pattern, tag list, prior post style), read the repo. Don't tax the user with stuff you can find in 30 seconds.
4. **Never write the file before Phase 5.** Outline and prose are presented in chat first.
5. **Never commit.** Per `.cursor/rules/no-commit-without-permission.mdc`, the user decides when changes get committed.

---

## Phase 0 — Detect prior grilling

Scan the **current conversation** for signs the user already grilled this idea:

- A `grill-me` / `grill-with-docs` recap ("Decisions locked in:", "Open assumptions:")
- An epic brief / tech plan / ADR was just produced for the same feature
- 8+ exchanges where the angle, audience, and load-bearing claim are already pinned

**If grilling already happened**: skip Phase 3's interview and seed the outline directly. Print: *"Detected prior grilling — skipping the angle interview."* Still run Phases 1, 2, 4, 5, 6.

---

## Phase 1 — Pick the story

### Step 1.1 — Source

If the user named a PR / issue / epic / file / commit, use it. Otherwise:

- Run `gh pr list --state merged --limit 15` and `gh issue list --limit 15`
- Scan `docs/done/` for recent epic briefs / tech plans
- Propose **3 candidate angles** as a numbered list. Each candidate has: source artifact, one-sentence angle, suggested archetype.

Use `AskQuestion` to pick one (or let the user pitch their own).

### Step 1.2 — Archetype

Pick the post shape that fits the source. Use `AskQuestion` if not obvious. The archetype shapes the outline in Phase 4.

| Archetype | Opens with | Spine |
|---|---|---|
| **Build log** | Screenshot or output of the finished thing | What we shipped → key decisions → what's next |
| **Decision write-up** | The forced trade-off ("X or Y, you can't have both") | Options → criteria → the pick → what we'd reconsider |
| **Postmortem** | The symptom (error, graph, user complaint) | Diagnosis → fix → lesson, with the dead-end branches kept in |
| **Science explainer** | The user-visible problem | The science → the model → the implementation → known limits |
| **Hybrid (science → engineering)** | The user-visible problem | Science → model → code → what we got wrong → next iteration |

Default for cross-cutting topics like *"mesocycle-aware periodization"* is **Hybrid**.

---

## Phase 2 — Hydrate evidence

Pull every artifact the post will lean on. **Do not paraphrase from memory** — read the file.

- **Epic Brief** — `docs/Epic_Brief_—_*.md` or `docs/done/Epic_Brief_—_*.md`
- **Tech Plan** — `docs/Tech_Plan_—_*.md` or `docs/done/`
- **ADRs** — anything in `docs/adr/` referencing the feature
- **Tickets** — `docs/T*.md` and `docs/done/T*.md` for the same epic
- **GitHub** — `gh issue view N`, `gh pr view N`, `gh pr diff N` for the relevant numbers
- **Git history** — `git log --oneline --grep='<keyword>'` and `git log -p -- <path>` for the touched files
- **Glossary** — `docs/CONTEXT.md`, load every term the post will use so vocabulary stays consistent with the rest of the project
- **Voice anchor** — read `web/src/content/blog/_lorem-ipsum.mdx` plus any published post (non-`draft: true`) under `web/src/content/blog/`. The anchor sets sentence rhythm and component usage.
- **Science / external sources** (only for science / hybrid posts) — ask the user once via `AskQuestion` for the source material (papers, books with chapter, videos with timestamp). Record exact citations. Without sources, downgrade to "build log" archetype rather than fabricate references.

Build a small evidence ledger in chat (10-20 bullet points): *claim the post will make → artifact backing it*. Anything that can't be backed gets cut or moved to "open question".

---

## Phase 3 — Grill for the human angle

**Skip if Phase 0 detected prior grilling.**

LLMs cannot infer the human angle from artifacts alone. Apply the operating principles **strictly**: one question at a time, every question comes with your recommended answer and a one-sentence rationale, push back on vague answers. Stop when 5-8 strong answers are in hand.

### Question shape (mandatory)

Every question must follow this template:

> *"[Question]. I'd lean **[recommended answer]** because [one-sentence rationale]. Agree, or push back?"*

Never ask *"what do you think about X?"* or *"how would you frame Y?"*. Examples below.

### Required answers before drafting

For each, the agent picks a default first (using the artifacts loaded in Phase 2), then asks the user to ratify or branch.

1. **Load-bearing claim** — the ONE thing the post argues. *Default proposal example: "I'd lean: 'volume periodization needs per-mesocycle ceilings, not global ones, because recovery debt is muscle-group-local.' Agree, or is the real claim narrower?"*
2. **Audience & assumed knowledge** — *"I'd lean: engineers who lift, assume they know what RIR is but not MEV/MAV/MRV. Agree, or should I assume zero training-science background?"*
3. **The non-obvious takeaway** — *"I'd lean: the takeaway is the volume-landmarks-as-state-machine framing, not the formula itself. Agree?"*
4. **The near-miss** — *"From the tech plan I see we almost stored ceilings as a flat array — looks like that would have broken under split routines. Is that the near-miss worth telling, or was there a bigger one?"*
5. **The counter-argument** — *"I'd lean: the strongest pushback is 'autoregulation > pre-set ceilings'. We answer it by [X]. Agree, or is there a stronger objection?"*
6. **Length target** — short (600-1000) / standard (1200-2000) / deep dive (2500-4000). *Default: standard, unless the artifact ledger has 15+ load-bearing items, in which case deep dive.*
7. **Voice register** — *"Default: dry-technical, matching `_lorem-ipsum.mdx`. Agree, or want it a notch more conversational?"*

### Sharpening rule

If the user gives a vague answer, do not accept it. Propose a sharper version and ask them to ratify. *"Helps lifters"* → *"You mean: helps the intermediate lifter on week 3 of a hypertrophy block who's debating whether to add a set — agree, or a different lifter?"*

---

## Phase 4 — Outline & approve

**Do NOT write the file yet.**

Present the outline as text. The shape comes from the archetype (Phase 1.2), not from a generic intro/3-points/conclusion template. For every section, list:

- Section heading (the one that will appear in the post)
- The 1-3 evidence anchors it draws from (file path, PR number, paper citation)
- The single point the section makes

Also flag where each MDX component would *earn its keep*:

- `<Callout type="warning">` only for real footguns / deprecations
- `<TechHeavy>` only for sections most readers can skip
- `<ComingSoon>` only for things genuinely behind a flag
- `<Screenshot>` only when the visual carries information words can't
- `<Video>` only for kinetic UI proofs

If a component would be decorative, leave it out.

Outline questions follow the same operating principle as Phase 3: **always propose, never ask open**. Use `AskQuestion` for the 1-2 most consequential calls, each with concrete options *and* a recommended pick.

> *"Open with the symptom or the fix? I'd lean **symptom** — postmortems land harder when the reader feels the pain before the resolution. Agree, or open with the fix?"*

Accept freeform feedback for the rest. Loop once if the user has structural corrections.

---

## Phase 5 — Draft

### Step 5.1 — Slug & path

Slug is kebab-case, descriptive, ≤6 words. Examples: `mesocycle-volume-periodization`, `why-we-killed-the-template-wizard`, `the-rir-suggestion-bug-that-bit-us`.

Write to:

```
web/src/content/blog/{slug}.mdx
```

### Step 5.2 — Frontmatter

Match the schema in `web/src/content.config.ts` exactly:

```yaml
---
title: '<sentence-case title, no clickbait>'
date: <YYYY-MM-DD, today's date>
excerpt: <one sentence, ≤220 chars, NOT a restatement of the title>
tags:
  - <kebab-case>
  - <kebab-case>
draft: true
---
```

**Always start with `draft: true`.** The user lifts the flag when ready. `ogImage` is optional — only set if the user provides one.

### Step 5.3 — Body

Write the MDX. While drafting, honor the rules below.

#### Hard ban list (delete on sight)

Words / phrases:
- *delve, delves, delving*
- *moreover, furthermore, in addition* (use a period or *also*)
- *in today's fast-paced world, in an era of, in the world of*
- *tapestry, landscape, realm*
- *leveraging* (use *using*)
- *unlock, unleash, supercharge, game-changer*
- *deep dive, level up*
- *navigate the complexities of, embark on a journey, harness the power of*
- *it's important to note, it's worth noting, it should be remembered*
- *in conclusion, to summarize, in summary*
- *robust, seamless, comprehensive, cutting-edge, state-of-the-art, best-in-class* (when used as empty adjectives without measurement)
- *myriad of*

Structural tics:
- Symmetric tricolons (*fast, scalable, and maintainable*) on repeat — vary the structure
- Every paragraph opening with the same template
- Bullet lists where 2-3 sentences of prose would carry the same load
- Bullet items that are all grammatically parallel — vary the form
- Em-dashes as the *only* punctuation tool — use periods, parentheses, colons too
- Closing every section with a one-line takeaway
- *Here's the thing:* / *And here's why:* intros
- Hedge gradients (*might, could, may, potentially*) stacked in the same sentence — pick one
- *Not just X, but Y* on repeat
- Exclamation marks (almost never)

#### Style positives (anchored in `_lorem-ipsum.mdx`)

- Mix sentence lengths. Short jabs next to longer clauses.
- Concrete > abstract. *3.2KB gzipped, vs 11KB before* beats *significantly smaller*.
- File paths in backticks: `` `file:supabase/functions/mcp/index.ts` ``.
- Code blocks that match real code in the repo. If you fake one, mark it as illustrative.
- One opinion per post, defended.
- One claim per paragraph.
- Use the glossary terms from `docs/CONTEXT.md` exactly as defined — no synonyms.

#### Grounding rules (non-negotiable)

- Every codebase claim → cite a file path (`file:foo/bar.ts`), PR number, or commit SHA.
- Every science claim → cite a paper, a book + chapter, or a video + timestamp.
- Every *we / I* → maps to a real action with evidence.
- If a claim has no evidence, either find evidence, soften it to a clearly labelled hypothesis, or cut it.

---

## Phase 6 — Self-review (anti-LLM-BS pass)

Before presenting the draft, run this checklist *out loud* in chat as a numbered list. For each item: PASS, or FAIL with the specific offending line and a fix.

1. **Ban list scan** — grep the draft for every banned word / phrase. Zero hits.
2. **Tic scan** — count tricolons, em-dashes, parallel bullet lists, *Here's the thing* intros. Flag anything that recurs more than twice.
3. **Grounding** — for every assertion, name the artifact backing it. Any unbacked claim is cut, softened, or moved to a clearly-labelled "open question" callout.
4. **Load-bearing claim test** — what one sentence would the reader quote? If you can't point to it in the draft, the post is unfocused.
5. **Cuttability test** — pick 3 paragraphs at random. For each, ask: *could I delete this and lose nothing?* If yes, delete it.
6. **Voice diff** — read 3 paragraphs side-by-side with `_lorem-ipsum.mdx`. Sentence rhythm should be in the same family.
7. **Glossary check** — every term defined in `docs/CONTEXT.md` is used exactly as written there.
8. **Component honesty** — every `<Callout>`, `<TechHeavy>`, `<ComingSoon>`, `<Screenshot>`, `<Video>` earns its place. Decorative ones are removed.
9. **Frontmatter validity** — `excerpt` ≤ 220 chars, `date` is a real date, `draft: true`, tags are kebab-case.

If any item fails, fix it before writing the file. Do not present the draft until all 9 are PASS.

---

## Phase 7 — Write & recap

Write the file to `web/src/content/blog/{slug}.mdx`.

Print a short recap:
- File path written
- Load-bearing claim (one sentence)
- Word count + reading-time estimate
- Open questions / unbacked claims that got cut (so the user can chase them)
- Next steps: *"run `astro dev` under `web/` to eyeball it; flip `draft: false` when ready; consider an OG image if it'll be widely shared."*

Do NOT commit. The repo rule (`.cursor/rules/no-commit-without-permission.mdc`) is non-negotiable.

---

## Edge cases

- **Empty repo / no merged PRs / no epic briefs** — degrade gracefully: ask the user for a topic and any source material, skip Phase 2's repo-mining, but keep Phase 3's grilling and Phase 6's anti-BS pass.
- **Source artifact contradicts the user's framing** — flag it in chat. The user picks: trust the artifact (and update the angle) or override (and call out the disagreement in the post).
- **User wants to skip the grilling** — respect it but warn: the LLM-smell comes from filling gaps that should be answered, not assumed. Make the gaps explicit in the draft as `<Callout type="note">` so the user can answer them in editing.
- **No published posts to anchor voice against** — use `_lorem-ipsum.mdx` as the sole anchor. After the first real post ships, prefer that one.
- **Translation request (FR ↔ EN)** — write in the language the user used to ask. The ban list is English-centric; translate the equivalents (*délicieux mélange*, *au cœur de*, *à l'ère du*, *plonger dans*, etc.) and apply the same logic.
