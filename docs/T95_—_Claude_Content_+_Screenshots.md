# T95 — Claude Content + Screenshots + Source `.md` Sync

## Goal

The "ship the actual page" ticket. Capture 5 Claude Desktop UI screenshots (in English, or accept FR with documented caveat per Tech Plan), convert them to WebP, and inline them via the `<Screenshot>` component built in T93. Author the full `claude.mdx` body — replacing the stub content from T93 with all the real sections (Prerequisites, Setup with `<ComingSoon>` banner, Method 1 OAuth flow with 5 inline screenshots, PAT alternative with `<TechHeavy>` warning + collapsed config, mcp-remote alternative with 2 collapsed configs, Available tools table, Example conversation, Troubleshooting). Then sync `docs/mcp-connect/claude-desktop.md` to match the empirically-validated PAT-via-`mcp-remote` gotchas (Node 18+, nvm walk gotcha, npm cache permission fix, absolute-`npx`-path recommendation) — both the source `.md` AND the MDX must say the same thing about PAT setup after this ticket lands. The drift-tolerance window starts now; future PRs that touch either side must touch both.

**Mode**: HITL — requires (a) a human at a Claude Desktop install for the 5 captures, (b) the English-vs-French Claude UI decision deferred to capture session per Tech Plan Critical Constraints, (c) editorial care during the source `.md` sync to keep PAT-setup truth congruent across the two artifacts
**Slice**: 5 screenshot captures (PNG) → `cwebp -q 85` conversion → commit to `web/src/assets/connect/claude/*.webp` → MDX body authoring (8 sections, ~150 lines) → source `.md` sync (~20 lines edit)
**Addresses Epic Brief stories**: #1 (polished comprehensive page), #2 (hero + value-prop CTAs), #3 (visible OAuth primary path with 5 inline screenshots), #4 (visible PAT alternative), #5 (visible mcp-remote alternative), #6 (PAT-on-Claude tech-heavy warnings), #11 (lazy-loaded screenshots with explicit dimensions, eager hero), #13 (Directory "coming soon" callout), #14 (sibling-ready content shape), #16 (PAT-on-Claude empirical reality documented), #17 (custom MDX components used in production)
**Position in A4 PR**: commit 4 of 5

## Dependencies

- **T93** (Connect collection + route + MDX components) — required: `<Screenshot>`, `<Callout>`, `<TechHeavy>`, `<ComingSoon>` exist; dynamic route renders MDX; prose styling works; the `claude.mdx` file already exists with stub body
- **T92** (smoke test) — toolchain verified
- Optional: **T94** (SEO + URL infra) — if T94 lands first in the PR commit order, this ticket's content also gets indexable + canonical + sitemap inclusion automatically. If T95 is reordered before T94, the content ships with `noindex` until T94 lands. Per the Phase 2 ticket map, T94 → T95 in commit order.

## Scope

### 1. Capture 5 screenshots (HITL)

Capture sources, target dimensions, and naming. All captures are macOS-native (`Cmd+Shift+4` area capture or `Cmd+Shift+5` window capture). Approximate target ~1200-1600px wide for retina; Astro `<Image>` will downscale via `widths={[800, 1200, 1600]}`.

| # | File | Source | Notes |
|---|------|--------|-------|
| 1 | `add-connector.webp` | Claude Desktop → Settings → Connectors → "Add custom connector" dialog with form filled (Name: `GymLogic`, URL: `https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp`) | Capture the dialog only, not the surrounding chrome |
| 2 | `oauth-consent.webp` | Browser at `gymlogic.me/oauth/consent` after the connector triggers OAuth (showing the GymLogic logo, requested scopes, Accept / Deny buttons) | Trim to the consent card |
| 3 | `connected-state.webp` | Claude Desktop → Settings → Connectors showing the GymLogic entry with "Connected" status / green dot | Capture the connector list row + small surrounding context |
| 4 | `hammer-icon.webp` | Claude Desktop chat input area showing the hammer icon (tools-loaded confirmation), tool list expanded if cleanly captureable (alternatively, mouse hover state showing the popover) | Trim to input bar + popover |
| 5 | `dry-run-preview.webp` | **HERO IMAGE** — Chat screenshot showing Claude executing `create_program` with `dry_run: true`, displaying a proposed multi-day program preview, with the user's confirmation prompt visible | Capture a representative slice of the chat — header / Claude response with the program structure / pending confirmation. Aim for vertical proportions that work at hero scale (~16:10 to 4:3) |

**English-vs-French decision**: Tech Plan defers this to the capture session. Two options:
- **(a) Switch Claude Desktop to English** before capturing (Settings → Locale → English). Page reads consistently. Recommended.
- **(b) Capture with French UI** and accept inconsistency for v1, matching A3's pattern around French app screenshots in product features. Document the deviation in the PR description.

Document the choice in the PR description either way.

### 2. Convert PNG → WebP

After capture (PNGs anywhere on disk, e.g. `~/Desktop/`), batch-convert via `cwebp` (install: `brew install webp`):

```bash
mkdir -p web/src/assets/connect/claude
for f in ~/Desktop/*.png; do
  name=$(basename "$f" .png)
  cwebp -q 85 "$f" -o "web/src/assets/connect/claude/${name}.webp"
done
```

Or single-file:

```bash
cwebp -q 85 ~/Desktop/add-connector.png -o web/src/assets/connect/claude/add-connector.webp
```

**Quality target:** `-q 85` balances quality vs file size. Aim for < 200KB per screenshot; if any exceeds, drop quality to `-q 80` for that one. Verify final file sizes with `ls -lh web/src/assets/connect/claude/`.

### 3. Author full `claude.mdx` body

Replace T93's stub body with the real content. Frontmatter from T93 stays exactly as-is (no changes).

Body structure (based on `file:docs/mcp-connect/claude-desktop.md` content + Tech Plan section list):

```mdx
import addConnector from '../../assets/connect/claude/add-connector.webp'
import oauthConsent from '../../assets/connect/claude/oauth-consent.webp'
import connectedState from '../../assets/connect/claude/connected-state.webp'
import hammerIcon from '../../assets/connect/claude/hammer-icon.webp'
import dryRunPreview from '../../assets/connect/claude/dry-run-preview.webp'

<Screenshot src={dryRunPreview} alt="Claude Desktop showing a create_program dry-run preview with a proposed multi-day split" priority />

## Prerequisites

- A [GymLogic](https://gymlogic.me) account with at least one logged workout
- [Claude Desktop](https://claude.ai/download) installed (latest version recommended)

## Setup

<ComingSoon>
  We've submitted GymLogic for the Anthropic Directory listing. Until approved, use the manual Custom Connector setup below — takes about 30 seconds.
</ComingSoon>

### Method 1 — Custom Connector (recommended)

1. Open Claude Desktop and go to **Settings → Connectors → Add custom connector**.
2. Fill in:
   - **Name**: `GymLogic`
   - **URL**: `https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp`
3. Click **Add**.

<Screenshot src={addConnector} alt="Add custom connector dialog with the GymLogic name and URL filled in" caption="Step 2 — Add custom connector dialog" />

4. Claude Desktop will open your browser to `gymlogic.me/oauth/consent`. Sign in if prompted, then click **Accept**.

<Screenshot src={oauthConsent} alt="OAuth consent page on gymlogic.me showing requested scopes and Accept / Deny buttons" caption="Step 4 — OAuth consent" />

5. After consent, Claude Desktop shows the connector as **Connected**.

<Screenshot src={connectedState} alt="Connector list in Claude Desktop showing GymLogic in Connected state" caption="Step 5 — Connected state" />

6. Open a new chat. The hammer icon in the input bar confirms tools are loaded. Click it to see available GymLogic tools.

<Screenshot src={hammerIcon} alt="Claude Desktop chat input bar with the hammer icon and a popover listing GymLogic tools" caption="Step 6 — Tools loaded" />

You're done. Try [the example conversation below](#example-conversation).

### Alternative: Personal Access Token

Use a PAT instead of OAuth if you want longer-lived auth or a headless setup. Create one at [gymlogic.me/account/api-tokens →](https://gymlogic.me/account/api-tokens).

<TechHeavy>
  - Requires **Node.js 18+**. `mcp-remote` crashes on Node 12 / 14 with `SyntaxError`.
  - **nvm gotcha**: Claude Desktop walks `PATH` in order and grabs the *first* `npx` it finds. If your default Node is 12, it'll fail. Either run `nvm alias default 20` or pin the absolute path to a Node 20+ `npx` in your config.
  - **npm cache permissions**: if you've ever run `sudo npm install`, fix with `sudo chown -R $(id -u):$(id -g) ~/.npm` before the next attempt.
  - **Recommended**: use the absolute path to `npx`, e.g. `/Users/you/.nvm/versions/node/v20.9.0/bin/npx`.
</TechHeavy>

<details>
  <summary>Show PAT config</summary>

  Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

  ```json
  {
    "mcpServers": {
      "gymlogic": {
        "command": "/Users/you/.nvm/versions/node/v20.9.0/bin/npx",
        "args": [
          "mcp-remote",
          "https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp",
          "--header",
          "Authorization: Bearer <YOUR_PAT>"
        ]
      }
    }
  }
  ```

  Quit Claude Desktop fully (`Cmd+Q`, not just close window) and reopen. The connector should appear in Settings → Connectors.
</details>

### Alternative: Config file with `mcp-remote`

For Claude Desktop builds where the native UI doesn't expose the connector form, or for headless setups, use the `mcp-remote` adapter directly via the config file at `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows).

<details>
  <summary>Show mcp-remote config (OAuth)</summary>

  ```json
  {
    "mcpServers": {
      "gymlogic": {
        "command": "npx",
        "args": [
          "mcp-remote",
          "https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp"
        ]
      }
    }
  }
  ```

  On first run, `mcp-remote` opens a browser tab for OAuth consent. Tokens are cached locally for subsequent runs.
</details>

<details>
  <summary>Show mcp-remote config (with PAT)</summary>

  Same as the PAT config above — use the absolute `npx` path and pass the PAT via `--header`.
</details>

## Available tools

| Tool | What it does |
|---|---|
| ... migrate from `docs/mcp-connect/claude-desktop.md` ... |

## Example conversation

... migrate the 6-prompt sequence from `docs/mcp-connect/example-prompts.md` (or the relevant excerpt from `claude-desktop.md` if it duplicates). Keep prompts short and concrete ...

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| ... migrate from source `.md`, expanding the Node-12-via-nvm and EACCES rows per the empirical PAT validation ... |
```

**Authoring discipline:**
- Hero image is the **first body element**, NOT in frontmatter (per Tech Plan Implementation Notes — frontmatter strings can't be `ImageMetadata`)
- Hero image uses `<Screenshot priority>` → `loading="eager"` + `fetchpriority="high"` for LCP
- All other screenshots use default `<Screenshot>` → `loading="lazy"`
- The body must NOT have an H1 (the hero H1 is the only H1 on the page; body starts at H2)
- The `## Setup` H2 must NOT be renamed — `[slug].astro`'s `Setup guide ↓` CTA links to `#setup`, which is the auto-generated `id` from this exact heading text
- Code blocks delimited by triple-backticks are protected from MDX parsing — JSON `{}` won't get parsed as MDX expressions
- All section content sourced from `file:docs/mcp-connect/claude-desktop.md` + grilling-validated PAT empirical recap (in Tech Plan Implementation Notes)

### 4. Sync `file:docs/mcp-connect/claude-desktop.md`

Update the source doc to match the new MDX's PAT-setup truth. Specifically expand the "Node version matters" / "Troubleshooting" sections to include:

- Node.js 18+ requirement (call out explicitly; current source likely understates this)
- nvm-walks-PATH-in-order gotcha (claude Desktop picks first `npx` found)
- npm cache permission fix: `sudo chown -R $(id -u):$(id -g) ~/.npm`
- Recommendation to pin absolute path: `/Users/you/.nvm/versions/node/v20.9.0/bin/npx`

After this ticket lands, `docs/mcp-connect/claude-desktop.md` and `web/src/content/connect/claude.mdx` describe the **same setup truth** for PAT-via-`mcp-remote`. Both files must update together in any future PR. Drift detection is manual (PR review) — no automated check. Acceptable for v1; if drift bites, revisit Brief Q3 (consolidate into MDX-only).

### 5. Final verification (still HITL — visual)

After the commit:

- Visit `/connect/claude` in `astro dev` (or after `astro build && astro preview`)
- Hero screenshot loads `eager` + `fetchpriority="high"` (verify in browser dev tools network tab)
- All other screenshots load `lazy` (verify they only fetch when scrolled into view)
- Each `<img>` has explicit `width` + `height` attributes auto-derived by Astro `<Image>` (CLS = 0)
- All 5 screenshots render at sensible sizes inside their `<figure>` containers
- `<TechHeavy>` warning is visually distinct (yellow border, warning icon if implemented)
- `<ComingSoon>` callout is visually distinct (accent border, sparkle icon if implemented)
- `<details>` blocks expand/collapse on click; chevron rotates
- Code blocks are syntax-highlighted (Shiki theme from T93)
- The `Setup guide ↓` CTA in the hero scrolls to `## Setup` correctly
- Inline links work (Claude Desktop download, gymlogic.me/account/api-tokens)
- Lighthouse mobile run on `/connect/claude` shows LCP < 2.5s, CLS = 0 (target from Brief Story #11)

Commit message: `feat(web): claude.mdx full content + 5 screenshots + sync source claude-desktop.md`

## Out of Scope

- OG card PNG file at `web/public/og/connect-claude.png` — owned by **T96**
- BaseLayout SEO meta props — owned by **T94**
- Sitemap, robots.txt, redirect, header/footer URL surgery — owned by **T94**
- Custom MDX component implementation — owned by **T93** (this ticket only USES them)
- Migration of `docs/mcp-connect/example-prompts.md` to a `/connect/prompts` page — its own follow-up ticket (per Brief Out-of-Scope)
- Migration of sibling clients (Cursor, Le Chat, OpenClaw) — owned by **A4.5 follow-up ticket**
- Cross-link UI (top breadcrumb, footer cards) — owned by **A4.5 follow-up ticket**
- Embedded MCP playground / live tool tester (per Brief Out-of-Scope)
- "Last updated" timestamps, "Report an issue" links (per Brief Out-of-Scope)
- Real "1-click via Anthropic Directory" instructions (per Brief Out-of-Scope — written post-#296 approval)

## Acceptance Criteria

- [ ] All 5 WebP screenshots committed at expected paths: `web/src/assets/connect/claude/{add-connector,oauth-consent,connected-state,hammer-icon,dry-run-preview}.webp`
- [ ] Each WebP is < 200KB (verify with `ls -lh`)
- [ ] All 5 screenshots are in **English** OR the FR/EN inconsistency is documented in the PR description
- [ ] `web/src/content/connect/claude.mdx` body contains all 8 sections from the Tech Plan: hero `<Screenshot priority>`, Prerequisites, Setup with `<ComingSoon>`, Method 1 OAuth (5 inline `<Screenshot>` calls), Alternative PAT (with `<TechHeavy>` + collapsed `<details>`), Alternative `mcp-remote` (with 2 collapsed `<details>`), Available tools table, Example conversation, Troubleshooting table
- [ ] The hero `<Screenshot>` has `priority` flag → renders with `loading="eager"` + `fetchpriority="high"` (verify in browser dev tools)
- [ ] All non-hero `<Screenshot>` calls render with `loading="lazy"`
- [ ] Each `<img>` in the page has explicit `width` + `height` attributes (CLS = 0)
- [ ] Body MDX has NO `<h1>` tag (hero H1 is the only H1 on the page)
- [ ] The `## Setup` H2 has auto-generated `id="setup"`; clicking the hero "Setup guide ↓" CTA scrolls to it
- [ ] `docs/mcp-connect/claude-desktop.md` is updated to include the 4 PAT-setup tech-heavy gotchas (Node 18+, nvm gotcha, `chown ~/.npm`, absolute-`npx`-path) — both files describe the same PAT setup truth
- [ ] Lighthouse mobile run on `/connect/claude` reports LCP < 2.5s and CLS = 0 (per Brief Story #11 success measure)
- [ ] All custom MDX components mount without console errors when the page renders
- [ ] Code blocks render with Shiki syntax highlighting (visible in browser)
- [ ] Inline links resolve: `https://claude.ai/download`, `https://gymlogic.me`, `https://gymlogic.me/account/api-tokens`
- [ ] `cd web && npx astro check` exits 0 (frontmatter still validates against T93's Zod schema)
- [ ] `cd web && npm run build` exits 0 when run with `required_permissions: ["all"]`

## References

- Epic Brief: `file:docs/Epic_Brief_—_A4_Connect_Claude_#302.md` (Scope items 4, 6, 7, 8, 9; Stories #1, #2, #3, #4, #5, #6, #11, #13, #14, #16, #17; Success Criteria for LCP < 2.5s, CLS = 0)
- Tech Plan: `file:docs/Tech_Plan_—_A4_Connect_Claude_#302.md` — see Key Decisions (hero shape, hero CTA, hero screenshot, Setup section primary, PAT alternative, PAT Tech-heavy warning, mcp-remote alternative, ComingSoon callout, screenshot loading, screenshots format), Critical Constraints (English screenshots; source `.md` and MDX must stay in sync), Component Architecture (`claude.mdx` content draft), Implementation Notes (WebP capture pipeline, hero image rendering decision, English screenshots reminder, PAT empirical setup recap, source `.md` sync)
- Source content (synced in this PR): `file:docs/mcp-connect/claude-desktop.md` — primary content source for migration; PAT troubleshooting must be updated to match the new MDX's tech-heavy warnings
- Predecessor: T93 (collection + route + MDX components) — provides `<Screenshot>`, `<TechHeavy>`, `<ComingSoon>`, `<Callout>` components and the existing `claude.mdx` file with stub body
- Predecessor: T94 (recommended commit order) — without T94, the page ships with `noindex` until T94 lands
- Successor: T96 (OG card) — produces the OG image referenced by `claude.mdx` frontmatter
- Existing `BaseLayout.astro` (consumed via `[slug].astro`): `file:web/src/layouts/BaseLayout.astro`
- Empirical PAT-via-`mcp-remote` validation: in-conversation grilling — Node 12 nvm walk + npm cache EACCES surfaced first try, fixed via Node 20 absolute path + `chown`
- Workspace rule (mandatory for build commands): `file:.cursor/rules/build-sandbox-caveat.mdc`
- Workspace rule (functional style): `file:.cursor/rules/prefer-functional-style.mdc`
- Parent epic: #298 — Astro mini-site
- This A4 ticket: #302 — A4 Doc connecteur Claude page
- Unblocks: #296 — Anthropic Connectors Directory submission (page is the URL submitted)
