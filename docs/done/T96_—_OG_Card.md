# T96 — OG Card (Claude Page)

## Goal

Ship the Claude-branded social share card so that posting `https://docs.gymlogic.me/connect/claude` to LinkedIn, X, Slack, etc. produces a card with GymLogic + Claude branding instead of a generic site card. Source the Claude/Anthropic logo (or fall back to text-only per Brief Q12 fallback B if licensing blocks usage), design a 1200×630 PNG in Figma per the Tech Plan template, export to `web/public/og/connect-claude.png` (raw — NOT fingerprinted by Astro's pipeline so the URL stays stable for social platform caches), and verify in the LinkedIn Post Inspector + X card validator that the image renders correctly. The `<meta og:image>` tag was already wired in T94 and the `claude.mdx` frontmatter already references `/og/connect-claude.png` from T93 — this ticket just produces the file.

**Mode**: HITL — requires (a) Anthropic brand-guidelines judgment on Claude logo usage (or fallback decision), (b) Figma design work, (c) post-deploy manual validator runs against the live Vercel preview
**Slice**: logo sourcing decision → Figma 1200×630 design → PNG export → file commit at `web/public/og/connect-claude.png` → post-deploy validator verification (LinkedIn + X)
**Addresses Epic Brief stories**: #1 (polished page; OG card is part of "professional"), #10 (Claude-flavored share card)
**Position in A4 PR**: commit 5 of 5

## Dependencies

- **T94** (SEO + URL infra) — required: `BaseLayout.ogImage` prop wired, `<meta og:image>` emitted from frontmatter
- **T93** (Connect collection + route) — required: `claude.mdx` frontmatter declares `ogImage: /og/connect-claude.png`
- (T95 is **not** a dependency — OG card and content are independent. T95 ships in commit 4 because it's the bigger piece; T96 lands as commit 5 to close out the PR.)

## Scope

### 1. Anthropic logo licensing decision (HITL)

Check Anthropic's brand guidelines (typically at `anthropic.com/brand` or via their press kit). Decision tree:

| Outcome | Action |
|---|---|
| Logo usage permitted for factual / non-misleading uses (we're not implying official partnership; we're documenting a third-party connector that uses their MCP standard) | Source the official logo PNG / SVG, drop in `web/src/assets/connect/logos/` (or use it directly in Figma) |
| Logo usage requires written permission OR is restricted | Use **fallback B** (Brief Q12): text-only OG card with the Claude name spelled out instead of the logo, GymLogic logo only on the visual side |

Document the choice (and any guideline-link reference) in the PR description.

### 2. Figma OG card design

Target dimensions: **1200×630 px** (standard OG card size; LinkedIn / X / Facebook all expect this).

Design template (from Tech Plan):

| Element | Detail |
|---|---|
| Background | Match site's `#0f0f13` background (or a subtle gradient that reads on light + dark social card backgrounds) |
| GymLogic logo | Top-left or center-left, sized for ~10-15% of width |
| Claude/Anthropic logo (if licensed) | Top-right or center-right, separated by a subtle divider (`×` or vertical rule) from the GymLogic logo. **Skip if fallback B.** |
| Headline | "GymLogic for Claude Desktop" — large, foreground color, ~48-64px |
| Sub-headline | "MCP Connector — setup in 30 seconds" — muted, ~24-32px |
| Footer | `docs.gymlogic.me` — small, accent color, bottom of frame |
| Style | Sober, dark, typographic — match the rest of the site's voice |

**Fallback B (text-only) variation**: drop the Anthropic logo, keep all other elements; widen the headline / sub-headline area to fill the right side. Same visual weight, fewer assets.

Export from Figma: PNG, 1200×630, target file size **< 1MB** (validators reject oversize files; aim for ~200-500KB if possible — JPEG-style compression isn't available for OG-image PNGs but tools like `tinypng.com` can help reduce size lossless-ish).

### 3. Commit the file

Path: `web/public/og/connect-claude.png`

```bash
mkdir -p web/public/og
# (export from Figma to this exact path)
```

**Why `public/` and not `src/assets/`:** Astro's `src/assets/` pipeline fingerprints filenames (`connect-claude.abc123.png`), which breaks OG cache stability — when you redeploy, the URL changes, and social platforms see a "new" image they re-fetch. The `public/` directory serves files verbatim → URL stays `/og/connect-claude.png` across all deploys.

### 4. Verify the meta tag emission

The `<meta og:image>` tag was wired in T94 and the frontmatter reference was set in T93 — this ticket just confirms the wiring resolves correctly:

```bash
# After Vercel preview deploys this commit:
curl https://<preview>.vercel.app/connect/claude | grep og:image
# Expected: <meta property="og:image" content="https://docs.gymlogic.me/og/connect-claude.png">

# Confirm the file is reachable:
curl -I https://<preview>.vercel.app/og/connect-claude.png
# Expected: HTTP/1.1 200 OK
# Expected: Content-Type: image/png
# Expected: Content-Length: <under 1MB in bytes>
```

(Note: in preview deploys the host in `og:image` is still `docs.gymlogic.me` because `Astro.site` is configured at build time, not from the request hostname. The image URL won't actually load on the preview deploy unless the path also exists at production. For card validators, run them against the **production** URL after PR merges, not the preview URL — or temporarily override `Astro.site` for preview builds. Document the limitation in the PR description.)

### 5. Validate in social card debuggers (HITL — manual)

After the PR merges and `docs.gymlogic.me` deploys with the new OG card:

| Validator | URL | Expected |
|---|---|---|
| LinkedIn Post Inspector | https://www.linkedin.com/post-inspector/ | Card preview shows the GymLogic + Claude branded card with correct headline + URL |
| X Card Validator | https://cards-dev.twitter.com/validator (deprecated; use the X composer's preview pane instead by typing the URL into a draft post) | Same card renders in draft tweet preview |
| Facebook Sharing Debugger | https://developers.facebook.com/tools/debug/ | (Optional — only if cross-posting to Facebook) |

If the card renders incorrectly:
- Re-export PNG with adjusted dimensions / file size
- Force-refresh the validator (each platform has a "Re-fetch" or "Scrape Again" button)
- Redeploy if the file changed

**OG cache notes** (per Tech Plan):
- LinkedIn caches OG images for ~7 days
- X caches for ~7 days
- Facebook caches for ~30 days
- If the image needs updating post-deploy, change the URL (`connect-claude-v2.png`) and update the frontmatter (Tech Plan Implementation Notes — bypasses cache)

### 6. Pre-#296-announce checklist (in PR description)

The Tech Plan calls out a pre-launch checklist that includes OG validator passes — make sure this checklist is in the PR description and the OG-related items are checked off:

- [ ] OG card PNG generated (1200×630, < 1MB)
- [ ] Anthropic logo sourced (with brand-guidelines reference) OR text-only fallback B used
- [ ] `curl https://<preview>/og/connect-claude.png` returns 200
- [ ] LinkedIn Post Inspector renders the correct OG card on production URL post-merge
- [ ] X composer draft preview renders the correct OG card on production URL post-merge

Commit message: `feat(web): OG card for /connect/claude (1200x630)`

## Out of Scope

- `<meta og:image>` HTML emission — owned by **T94**
- `claude.mdx` frontmatter `ogImage` field — owned by **T93** (already references `/og/connect-claude.png`)
- OG cards for sibling clients (Cursor, Le Chat, OpenClaw) — owned by **A4.5 follow-up ticket** (which will reuse the same Figma template)
- OG cache invalidation strategy beyond URL versioning (covered in Tech Plan Implementation Notes if needed later)
- Production deploy + #296 submission — separate workstream after this PR merges
- Twitter / X card type beyond `summary_large_image` (already wired in T94)
- Open Graph type beyond `website` (already wired in T94)

## Acceptance Criteria

- [ ] Anthropic Claude logo licensing checked; decision (use logo OR text-only fallback B) documented in PR description
- [ ] `web/public/og/connect-claude.png` exists with **exactly** 1200×630 dimensions
- [ ] PNG file size is < 1MB (verify with `ls -lh web/public/og/connect-claude.png`)
- [ ] PNG is committed to the repo at `web/public/og/connect-claude.png` (not in `src/assets/`)
- [ ] After deploy, `curl -I https://<preview>/og/connect-claude.png` returns 200 with `Content-Type: image/png`
- [ ] After deploy, `curl https://<preview>/connect/claude | grep og:image` returns `content="https://docs.gymlogic.me/og/connect-claude.png"`
- [ ] LinkedIn Post Inspector successfully fetches and previews the OG card from the production URL after merge
- [ ] X composer draft preview shows the OG card on a draft post with the production URL after merge
- [ ] Pre-#296-announce checklist (in PR description) has all OG-related items checked off

## References

- Epic Brief: `file:docs/Epic_Brief_—_A4_Connect_Claude_#302.md` (Scope item 10; Story #10; Open Assumption on Anthropic brand assets; Q12 fallback B; Success Criteria for OG image rendering in social card debuggers)
- Tech Plan: `file:docs/Tech_Plan_—_A4_Connect_Claude_#302.md` — see Key Decisions (per-page OG image prop, OG meta tags, OG image storage as raw PNG in `public/`), Critical Constraints (OG image cache is per-platform), Component Architecture (`web/public/og/connect-claude.png` row in New Files), Implementation Notes (OG image dimensions, OG image cache busting, pre-launch checklist)
- Predecessor: T94 (SEO + URL infra) — emits `<meta og:image>` from frontmatter via BaseLayout
- Predecessor: T93 (collection + route) — `claude.mdx` frontmatter declares `ogImage: /og/connect-claude.png`
- Sibling: T95 (content + screenshots) — independent of T96; lands in commit 4
- Anthropic brand guidelines (verify at design time): https://www.anthropic.com/brand (or current canonical URL)
- LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/
- X / Twitter (use composer draft preview, validator is deprecated)
- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
- Parent epic: #298 — Astro mini-site
- This A4 ticket: #302 — A4 Doc connecteur Claude page
- Unblocks: #296 — Anthropic Connectors Directory submission (#296 reviewer + announce sharing both depend on the OG card)
