# Epic Brief — A4 Connect Claude (#302)

## Summary

A4 ships `/connect/claude` on `docs.gymlogic.me` — the canonical page the Anthropic Connectors Directory submission (#296) points reviewers at. The page documents how to wire GymLogic's MCP server into Claude Desktop end-to-end: OAuth Custom Connector as the primary path with ~5 inline screenshots, plus visible-but-collapsed alternatives for Personal Access Token and `mcp-remote` config-file flows. To support that single page, A4 also introduces MDX as a content authoring format on the site (via `@astrojs/mdx` + a Zod-validated content collection at `web/src/content/connect/`), establishes per-page indexing opt-in (`indexable` prop on `BaseLayout`, default stays `noindex`), wires `@astrojs/sitemap` to emit only indexable pages, ships `robots.txt`, sets canonical URLs, and adds one Claude-branded OG card. The legacy `/claude-connector` stub is replaced by a 308 redirect to `/connect/claude`. The three sibling client pages (Cursor / Le Chat / OpenClaw) are explicitly **deferred to a follow-up ticket** — their MDX files drop into the same collection, their UI infra (top breadcrumb strip, footer cross-link block) lands with them, and the cross-link UI is intentionally not rendered while only Claude exists.

---

## Context & Problem

**Who is affected:** the Anthropic Directory reviewer evaluating #296 (the page is their first impression of GymLogic's connector and decides whether the listing gets approved); existing GymLogic users who want to use Claude Desktop with their training data; the solo dev who currently maintains setup docs in two locations (`docs/mcp-connect/claude-desktop.md` AND a stub Astro page); SEO crawlers that currently see `noindex` site-wide; people sharing the URL in Slack / X / LinkedIn (no per-page OG card today).

**Current state:**

- `file:web/src/pages/claude-connector.astro` is a 26-line stub: H1 "Claude connector setup" + "Coming soon" copy + backlink to #302. Live but useless to a reviewer.
- The header in `file:web/src/components/Header.astro` already links to `/claude-connector` — A2 committed that URL. A4 will move the header target to `/connect/claude` and add a redirect from the legacy URL.
- The source markdown doc lives at `file:docs/mcp-connect/claude-desktop.md` (138 lines) — repo-internal reference, not user-facing. It already has a small drift risk against reality: PAT-via-mcp-remote is documented but the doc doesn't surface the practical gotchas (Node 18+ requirement walking nvm in PATH order, npm cache permission issues, recommendation to pin absolute `npx` path).
- No MDX integration in `file:web/astro.config.mjs`. No content collection. No `@tailwindcss/typography`. No sitemap. No `robots.txt`. No canonical URL meta tag. No OG card meta tags beyond the base `description`.
- `file:web/src/layouts/BaseLayout.astro` ships `<meta name="robots" content="noindex" />` site-wide (per A2 — A6 plans to flip this).
- #296 (Anthropic Directory submission) is blocked on this content shipping. The submission form takes a single URL, and reviewers evaluate the connector on it.
- Empirically validated during this brief's grilling phase: PAT-via-mcp-remote works on Claude Desktop, but the first attempt failed on a stale-nvm-Node-12 + root-owned npm cache combination. The doc must surface those gotchas prominently or users will conclude PAT-on-Claude is broken.

**Pain points:**

| Pain | Impact |
|---|---|
| `/claude-connector` is a stub | #296 cannot proceed; Anthropic reviewer would bounce |
| No MDX on the site | Either copy 138 lines of prose into hand-written `.astro` (verbose, drifts immediately) or stop here |
| Site is `noindex` | A4 cannot satisfy "indexed (sitemap entry)" without per-page or global opt-in |
| No per-page OG card | URL shares look generic; #296 reviewer sharing the page internally would see no Claude-specific signal |
| PAT-via-mcp-remote is fragile in practice | Without explicit tech-heavy warnings, users conclude it doesn't work |
| Source doc + future MDX live in two places | Manual sync required; drift risk accepted for v1 (single-page scope, low churn) |

---

## User Stories

1. As an **Anthropic Directory reviewer** validating #296, I want `/connect/claude` to render as a polished, comprehensive setup page with screenshots and a clear value proposition, so that I can approve the listing without doubting the product's seriousness.
2. As a **first-time GymLogic user with Claude Desktop installed**, I want a hero that immediately tells me what I can do (chat with my data, generate programs in seconds, skip the UI when I know what I want) and a CTA that opens Claude Desktop, so that I can start using the connector in under a minute.
3. As a **power user already comfortable with OAuth on Claude**, I want the OAuth Custom Connector path to be the visible, primary setup method with all 5 screenshots inline, so that I don't waste attention on alternatives I don't need.
4. As a **headless / long-lived-auth user on Claude**, I want a visible "Personal Access Token" alternative with a clear link to `gymlogic.me/account/api-tokens` and a collapsed config snippet, so that I can find it without the JSON cluttering the OAuth happy path.
5. As a **Claude Desktop user whose UI doesn't expose the SSE-headers field for an MCP server**, I want a visible "config file with `mcp-remote`" alternative with a collapsed snippet, so that I have a documented escape hatch when the native UI fails me.
6. As a **user attempting PAT-via-mcp-remote on Claude for the first time**, I want explicit warnings about the Node 18+ requirement, the nvm-walks-in-PATH-order gotcha, the npm cache permission fix, and the recommendation to pin an absolute path to a Node 20+ `npx` binary, so that my first attempt doesn't fail silently with cryptic logs.
7. As a **GymLogic user with an existing bookmark to `/claude-connector`**, I want that URL to redirect to `/connect/claude` automatically, so that nothing breaks for me.
8. As a **search engine crawler hitting `/connect/claude`**, I want it to declare itself indexable (no `noindex`), include a `<link rel="canonical">`, and appear in `/sitemap-index.xml`, so that the page gets discovered and ranked.
9. As a **search engine crawler hitting any other page on the site (e.g. `/`, `/about`)**, I want those to keep declaring `<meta robots noindex>` until A6 ships, so that placeholder content doesn't pollute SERPs.
10. As a **person sharing `/connect/claude` in Slack / X / LinkedIn**, I want the OG card to show GymLogic + Claude logos and "GymLogic for Claude Desktop", so that the share preview is specifically Claude-flavored, not generic.
11. As a **first-time visitor to `/connect/claude` on a mobile device with a slow connection**, I want screenshots to lazy-load, declare explicit width / height attributes (zero CLS), serve as WebP, and let the hero screenshot use `loading="eager"` + `fetchpriority="high"`, so that LCP stays under 2.5s and CLS stays at 0.
12. As a **GymLogic user clicking the "Claude connector" link in the header**, I want the link to land on `/connect/claude` (not a 404 from the renamed URL), so that the existing nav stays coherent.
13. As the **author of #296**, I want the page to surface a "One-click install via Anthropic Directory — coming soon" callout above the manual setup, so that the submission signals "we're aware of and ready for the Directory path" without speculating about a UX I haven't seen yet.
14. As the **future implementer of the Cursor / Le Chat / OpenClaw sibling pages** (follow-up ticket), I want the MDX content collection, Zod schema, shared layout component, OG meta wiring, and per-page `indexable` prop to already be in place, so that adding a sibling client is a content-authoring task, not an infrastructure task.
15. As a **PR author touching `web/src/content/connect/`**, I want the Vercel preview to render `/connect/claude` end-to-end with screenshots, OG card, indexable meta, and canonical URL, so that I catch broken assets / missing meta / typography regressions before merging.

### Success measures

| Story # | Measure |
|---|---|
| 1 | Anthropic Directory submission #296 succeeds — connector accepted into Directory |
| 8 | `/connect/claude` returns 200, declares `index, follow`, appears in `/sitemap-index.xml` (verified via `curl + grep`) |
| 11 | LCP < 2.5s on mobile (PageSpeed Insights mobile, throttled), CLS = 0 on production build |
| 14 | Adding a sibling client (in the follow-up ticket) requires no changes to layout, schema (or trivial schema additions), or astro.config — verified by reviewing the follow-up's diff scope |

Stories 2-7, 9-10, 12-13, 15 are validated qualitatively (visual review + manual click-through + manual social-card debugger checks).

---

## Scope

**In scope:**

1. Install `@astrojs/mdx` integration in `file:web/astro.config.mjs` + verify Astro 6 + rolldown-vite compatibility (smoke test early; document any required workarounds in the Tech Plan).
2. Install `@tailwindcss/typography` and configure a `prose` variant matching the site's dark, sober aesthetic (override default colors via CSS vars).
3. Define a content collection at `file:web/src/content/connect/` with a Zod schema covering: `slug`, `clientName`, `clientUrl`, `title`, `description`, `ogImage`, `pageOrder`, `available` (auth methods). Schema is extensible — adding sibling clients in the follow-up ticket should require minimal schema changes.
4. Author 1 MDX file: `web/src/content/connect/claude.mdx`. Content migrated from `file:docs/mcp-connect/claude-desktop.md` with the structural decisions from this brief (hero, callouts, alternatives, troubleshooting, tech-heavy PAT warnings).
5. Build a shared MDX layout component (`web/src/layouts/ConnectLayout.astro` or via collection's `render` pattern) handling: hero block, prose-styled body slot, OG / canonical / indexable meta wiring. Sibling cross-link UI (top breadcrumb strip, footer card grid) is **not built** in A4 — it lands with the follow-up ticket when siblings exist.
6. **Hero on `/connect/claude`**: badge eyebrow ("MCP Connector"), H1 ("Use your training data inside Claude"), 3-line value-prop strip including the `create_program` angle ("Chat with your training history" / "Generate or rewrite multi-day programs in seconds — Claude proposes, you approve, GymLogic writes" / "Skip the UI when you already know what you want; let Claude guide you when you don't"), two CTAs (`Open Claude Desktop →` deep-link to `claude://` with download fallback + `Setup guide ↓` anchor), hero screenshot of `create_program` dry-run preview in a Claude chat.
7. **Setup section on `/connect/claude`**: Method 1 = Custom Connector (OAuth) primary path, fully visible, ~5 screenshots inline (Add custom connector dialog, OAuth consent at `gymlogic.me/oauth/consent`, connected state, hammer icon, dry-run preview chat). Alternative: Personal Access Token — short intro + link to `gymlogic.me/account/api-tokens` + collapsed `<details>` with JSON, **explicitly flagged "Tech-heavy — for advanced users"** including Node 18+ requirement, nvm gotcha, npm cache permission fix, and absolute-path-to-`npx` recommendation. Alternative: `mcp-remote` config file — collapsed `<details>` with OAuth and PAT variants.
8. **"1-click via Directory — Coming soon" callout** at top of Setup section, with copy explaining that GymLogic is submitted for Directory listing. Update path documented inline so post-#296-approval revision is clear.
9. Capture, optimize, and inline 5 screenshots for the Claude page (`web/src/assets/connect/claude/*.webp`). Each `<img>` declares explicit `width` + `height`, hero gets `loading="eager"` + `fetchpriority="high"`, the rest `loading="lazy"`.
10. One OG card (1200×630 PNG) for `/connect/claude`: GymLogic logo × Claude/Anthropic logo + "GymLogic for Claude Desktop" + "MCP Connector — setup in 30 seconds" + `docs.gymlogic.me`. **Logo sourced by the user**, dropped in `web/src/assets/connect/logos/`. Wired via `<meta property="og:image">` from frontmatter.
11. Per-page `<link rel="canonical">` derived from `Astro.site` + page slug. Wired in `BaseLayout.astro` once.
12. **Per-page indexing opt-in**: extend `BaseLayout.astro` with an `indexable` prop (default `false` → emits `<meta robots noindex>`). Set `indexable={true}` on `/connect/claude`. All other pages keep the default until A6.
13. Install `@astrojs/sitemap`, configure it to filter to indexable pages only (matching the `indexable` signal), generate `/sitemap-index.xml` + `/sitemap-0.xml`. Reference in `<head>` and in a `robots.txt` (also added under `web/public/`).
14. Astro `redirects` map in `file:web/astro.config.mjs`: `/claude-connector` → `/connect/claude` (308 permanent).
15. Update `file:web/src/components/Header.astro`: change the `/claude-connector` link target to `/connect/claude`. The `linkIcons` map key updates accordingly. The active-state matcher (`startsWith`) already handles the `/connect/*` namespace.
16. Delete `file:web/src/pages/claude-connector.astro` (the stub) — the redirect supersedes it.
17. Add custom MDX components (e.g. styled `<details>` callout, "Tech-heavy" warning block) to `web/src/components/mdx/` for use in the connect collection.

**Out of scope (deferred):**

- The 3 sibling client pages (`/connect/cursor`, `/connect/le-chat`, `/connect/openclaw`) → **follow-up ticket**. Will reuse the MDX collection, schema, layout, OG infra, sitemap, and `indexable` mechanism A4 ships.
- Sibling cross-link UI (top breadcrumb strip + footer card grid) → ships with the follow-up ticket. Not built in A4 (would render dead UI with only one client present).
- Deletion of `docs/mcp-connect/*.md` source files → kept in place. MDX collection is user-facing canonical; source `.md` stays as repo-internal reference. Drift risk accepted for v1 (single page, low churn).
- Auto-sync from `docs/mcp-connect/` to `web/src/content/connect/` — manual copy is fine.
- Embedded MCP playground / live tool tester on the page.
- A `/connect/` index/hub page listing all clients. Header link goes directly to `/connect/claude`. Revisit at 5+ clients or once analytics show demand.
- Migration of `file:docs/mcp-connect/example-prompts.md` to a `/connect/prompts` page. Its own follow-up ticket — needs copy-to-clipboard UX for Custom Instructions blocks.
- "Last updated" timestamps on connect pages.
- "Report an issue" / feedback link per page.
- Real "1-click via Anthropic Directory" instructions — written post-#296 approval, not speculatively now.
- Lifting `<meta robots noindex>` globally → A6 (#304) inverts the default and may delete the per-page `indexable` mechanism.
- Analytics integration → A6 (#304).
- Cross-domain mirror on `gymlogic.me` — `docs.gymlogic.me/connect/claude` is canonical.

---

## Success Criteria

**Numeric / verifiable:**

- `/connect/claude` returns 200, renders the shared MDX layout with no console errors.
- `/claude-connector` returns a 308 redirect to `/connect/claude`.
- `/connect/claude` declares `<meta name="robots" content="index, follow">` (verified via `curl | grep robots`).
- All other pages on the site continue to declare `<meta robots noindex>` until A6.
- `/sitemap-index.xml` exists and contains `/connect/claude` (and any other pages later opting in).
- `/robots.txt` exists, allows `/`, references the sitemap.
- `<link rel="canonical">` on `/connect/claude` resolves to `https://docs.gymlogic.me/connect/claude`.
- LCP < 2.5s and CLS = 0 on `/connect/claude` (PageSpeed Insights mobile, throttled).
- `<meta property="og:image">` is set on `/connect/claude` and the image renders in social card debuggers (LinkedIn Post Inspector, X card validator).
- Content collection schema validates: `npm run astro check` passes (or equivalent).
- The follow-up ticket's diff (when filed) shows changes scoped to: 3 new MDX files + their assets + cross-link UI components — no changes to layout, schema, or astro.config required for the page-shell work.

**Qualitative:**

- The Anthropic Directory reviewer hitting `/connect/claude` perceives "this is a real, polished, well-documented connector" — first viewport reads as professional, not stub.
- The PAT alternative is visible enough to find but quiet enough not to compete with OAuth — the "Tech-heavy" framing sets correct expectations before the user invests in the path.
- Sharing `/connect/claude` in Slack / X / LinkedIn produces a card with Claude branding (not a generic site card).
- The hero immediately communicates the `create_program` value prop — readers grok within seconds that this is more than a read-only data wrapper.
- The page tonally matches the rest of `docs.gymlogic.me` (sober, typographic, dark) — no jarring style shift.

---

## References

- Parent epic: #298 — Astro mini-site (foundation publique pour ship & marketplace)
- This ticket: #302 — A4 Doc connecteur Claude page (MDX, stable URL for #296)
- Unblocks: #296 — Anthropic Connectors Directory submission
- Sibling tickets:
  - #299 — A1 Bootstrap (shipped, foundation)
  - #300 — A2 Layout / Nav / Footer (shipped — committed `/claude-connector` URL that A4 redirects)
  - #301 — A3 Home page (shipped)
  - #303 — A5 Skeleton blog
  - #304 — A6 SEO + analytics (will flip global `noindex`, may absorb the per-page `indexable` mechanism A4 ships)
  - #305 — A7 About page
- Follow-up ticket (to be filed): A4.5 — Connect pages for Cursor / Le Chat / OpenClaw (drops 3 MDX files into the collection A4 establishes + cross-link UI)
- Source content for migration: `file:docs/mcp-connect/claude-desktop.md` (kept as repo-internal reference after migration)
- Source content (deferred to its own ticket): `file:docs/mcp-connect/example-prompts.md`
- Source content (used by the follow-up ticket): `file:docs/mcp-connect/cursor.md`, `file:docs/mcp-connect/le-chat.md`, `file:docs/mcp-connect/openclaw.md`
- A2 prior art: `file:docs/Epic_Brief_—_A2_Layout_Nav_Footer_#300.md`, `file:docs/Tech_Plan_—_A2_Layout_Nav_Footer_#300.md`
- A3 prior art: `file:docs/Tech_Plan_—_A3_Home_Page_#301.md`
- Existing stub (to be deleted): `file:web/src/pages/claude-connector.astro`
- Header (to be updated): `file:web/src/components/Header.astro`
- Layout (to be extended with `indexable` prop + canonical): `file:web/src/layouts/BaseLayout.astro`
- Astro config (to gain MDX integration + sitemap + redirects): `file:web/astro.config.mjs`

---

## Open Assumptions

Things resolved during the brief but not verified — worth de-risking in the Tech Plan or early in implementation:

- `@astrojs/mdx` is compatible with Astro 6 + rolldown-vite. The astro.config already documents one Tailwind v4 / rolldown-vite incompat — same risk surface here.
- The `claude://` deep-link CTA opens Claude Desktop reliably across macOS / Windows / Linux. If unreliable, fall back to the download URL only (drop the deep-link).
- The Anthropic brand assets page permits factual use of the Claude logo on a connector docs page (we're not implying official partnership). If it doesn't, fall back to a text-only OG card (Q12 option B from the grilling).
- Maintaining `docs/mcp-connect/claude-desktop.md` AND `web/src/content/connect/claude.mdx` will not drift meaningfully in practice (low churn, single maintainer). Risk explicitly accepted; revisit if drift bites.
- The PAT-via-mcp-remote tech-heavy caveats (Node version, npm cache, absolute-path recommendation) are common enough to justify prominent surfacing — empirically tripped the maintainer himself on first attempt during this brief's grilling phase.
