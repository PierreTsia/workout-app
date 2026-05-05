# T97 — Skeleton Blog — Collection + Routes + RSS + Video

## Goal

Ship the entire `/blog` surface end-to-end on `docs.gymlogic.me`: a content collection with type-safe frontmatter, an index page (empty-state-aware), a dynamic post route with prev/next navigation, an RSS 2.0 feed at `/blog/rss.xml`, RSS autodiscovery in the head + footer, a new `<Video>` MDX component, and a permanent dev-only lorem-ipsum fixture for layout regression. Closes the GitHub issue #303 in a single PR.

This ticket addresses every user-facing requirement in the issue body:
- "`/blog` index page listing posts (empty initially, design ready for N posts)" — `pages/blog/index.astro`
- "MDX layout for individual posts (`/blog/[slug]`) with frontmatter (title, date, excerpt, tags, OG image)" — `pages/blog/[slug].astro` + Zod schema
- "RSS feed at `/blog/rss.xml` (Astro has built-in support)" — `pages/blog/rss.xml.ts` via `@astrojs/rss`
- "Reading time, prev/next post navigation" — `lib/blog.ts` helpers
- "Layout matches site design (per A2)" — reuses `BaseLayout`, `prose-invert max-w-3xl`, `<Badge variant="outline">`, MDX components from A4
- Implicit / launch-pre-flight: validate the layout works before the first real post lands — permanent `_lorem-ipsum.mdx` fixture renders in `astro dev` only

The launch write-up post itself is **out of scope** — it lives in #237 Phase C and ships in parallel.

## Mode

**AFK** — all architectural decisions are locked in the Tech Plan; the plan ships full code snippets for every non-trivial file; the smoke-test fallback (hand-rolled RSS XML if `@astrojs/rss` bites the rolldown-vite × Astro 6 combo) is documented. No mid-flight human input required.

## Slice

```
content collection schema (Zod)
  → lib helpers (sort + filter + reading time + format date)
    → 3 folder routes (index + dynamic [slug] + rss.xml endpoint)
      → BaseLayout extension (rssUrl prop)
        → Footer link addition
          → new <Video> MDX component
            → permanent dev-only lorem fixture
              → manual W3C feed validation + dev-mode visual QA
```

Every layer is exercised end-to-end. The fixture is the verification surface for the visible work; the W3C validator is the verification surface for the machine-readable feed. No layer is left horizontal.

## Dependencies

**None.** The parent epic #298 has no remaining open prerequisite tickets — A1 (#299), A2 (#300), A3 (#301), A4 (#302) are all shipped. The launch write-up (#237 Phase C) is the first content consumer of this ticket but does not block it; #237 can draft in parallel against any other branch.

## Scope

### Workstream 1 — Smoke-test gate (commit 1)

The first commit installs the new dependencies and validates that they build cleanly on top of the existing Astro 6.2.x × rolldown-vite × Tailwind v4 pipeline. **No content/index work proceeds until the smoke commit's build + check pass.**

| Item | Detail |
|---|---|
| Install | `cd web && npm i @astrojs/rss reading-time` |
| Pin versions | Lock to whatever stable version maps to Astro 6.2.x (verify by running install). Document final pinned versions in commit message. |
| Stub endpoint | New `web/src/pages/blog/rss.xml.ts` returning `rss({ title: 'smoke', description: 'smoke', site: context.site!, items: [] })` |
| Add collection | New `blog` collection in `web/src/content.config.ts` (full schema per Tech Plan Data Model section) — but no MDX files yet |
| **Do NOT** | Create `pages/blog/index.astro` or `pages/blog/[slug].astro` in this commit — would collide with the existing `pages/blog.astro` |
| Build verification | `cd web && npm run build` (with `required_permissions: ["all"]` per `file:.cursor/rules/build-sandbox-caveat.mdc`) |
| Check verification | `cd web && npx astro check` |
| **Fallback** | If `@astrojs/rss` × Astro 6 × rolldown-vite incompat surfaces: hand-roll RSS 2.0 XML in `rss.xml.ts` (~40 LOC), keep `reading-time` install, proceed. Documented in Tech Plan Implementation Notes. |

### Workstream 2 — Schema + lib + visible routes + Video component (commit 2)

The meat. Delete the existing placeholder, create the folder route structure, wire up the helper module, ship the visible blog and the new MDX component. After this commit, `/blog` renders the empty state and `/blog/<slug>` works for any MDX file dropped in `web/src/content/blog/`.

| File | Operation | Purpose |
|---|---|---|
| `web/src/pages/blog.astro` | **DELETE** | Replaced by folder route. Same-commit deletion required to avoid Astro route collision on `/blog`. |
| `web/src/pages/blog/index.astro` | **CREATE** | Index page. h1 "Blog" + always-visible tertiary `RSS` link + intro line. Empty state OR `<ul class="divide-y divide-border">` of post rows (Tier 2 density: tags row, byline row, h2 title, excerpt). Whole row is `<a>`. `BaseLayout indexable rssUrl="/blog/rss.xml"`. Code snippet in Tech Plan §"Component Responsibilities". |
| `web/src/pages/blog/[slug].astro` | **CREATE** | Dynamic post route. `getStaticPaths()` from `getPublishedPosts()`. Renders post header (h1, byline `date · reading time`, badge row), `<article class="prose prose-invert max-w-3xl">` with `<Content components={{ Callout, TechHeavy, ComingSoon, Screenshot, Video }} />`, prev/next nav at bottom (`← Older` / `Newer →`, one-sided at edges). Code snippet in Tech Plan §"Component Responsibilities". |
| `web/src/lib/blog.ts` | **CREATE** | Pure helper module. Exports `getPublishedPosts(): Promise<BlogEntry[]>`, `getPrevNext(slug, posts): { older, newer }`, `readingTime(body: string): number`, `formatDate(date: Date): string`. Full implementation in Tech Plan §"Component Responsibilities". |
| `web/src/components/mdx/Video.astro` | **CREATE** | New MDX component, parallel to `Screenshot.astro`. Props: `src` (required), `poster?`, `caption?`, `width?`, `height?`. Renders `<figure class="not-prose my-8">` with `<video controls preload="metadata" playsinline>`, optional `aspect-ratio` style from width/height, optional `<figcaption>`. **No autoplay, no loop, no muted.** Code snippet in Tech Plan §"Component Responsibilities". |

**Verification at end of commit 2**: `cd web && npm run dev` → visit `/blog` → empty state renders cleanly with the inline RSS link.

### Workstream 3 — RSS real + autodiscovery + footer link (commit 3)

Layer the machine-readable surface on top of the visible blog. After this commit, `/blog/rss.xml` returns valid RSS 2.0 with all published posts (zero today, N tomorrow), `<head>` of `/blog/**` advertises the feed, and the footer's "Docs" group has a 4th item.

| File | Operation | Purpose |
|---|---|---|
| `web/src/pages/blog/rss.xml.ts` | **REPLACE** stub | Real implementation. `GET` handler returns `rss({...})` with `title='GymLogic Blog'`, `description='Engineering write-ups, postmortems, and process notes from building GymLogic.'`, `site: context.site!`, items mapped from `getPublishedPosts()` (drafts auto-excluded), `customData: '<language>en-us</language>'`. Code snippet in Tech Plan. |
| `web/src/layouts/BaseLayout.astro` | **MODIFY** | Add optional `rssUrl?: string` prop. In `<head>` after canonical link, emit `<link rel="alternate" type="application/rss+xml" title="GymLogic Blog" href={new URL(rssUrl, Astro.site).toString()}>` only when `rssUrl` provided. All other behavior unchanged. |
| `web/src/components/Footer.astro` | **MODIFY** | `groups[1].links` (Docs group): append 4th item `{ href: '/blog/rss.xml', label: 'RSS feed', external: false }` after `/about`. No structural change. |

### Workstream 4 — Permanent dev-only lorem fixture (commit 4)

The visual QA surface. Lives in the repo forever as the layout regression check.

| File | Operation | Purpose |
|---|---|---|
| `web/src/content/blog/_lorem-ipsum.mdx` | **CREATE** | Frontmatter: `title`, `date: 2026-05-01` (any plausible past date), `excerpt` (1-line description), `tags: [fixture, design]`, `draft: true`. Body: at least one of each — H2, H3, paragraph (multi-sentence), bulleted list, ordered list, blockquote, inline code, fenced code block (with language), inline link (internal), inline link (external), `<Screenshot>` (use a placeholder webp from `connect/claude/` or `screenshots/`), `<Video>` (use one of the existing demo MP4s as a placeholder), native `<details>` block. Top-of-file HTML comment: `<!-- DEV FIXTURE — draft: true keeps this out of production. Never set draft: false. -->` |

**Verification at end of commit 4**:
- `cd web && npm run dev` → visit `/blog` → fixture appears in the index list. Visit `/blog/lorem-ipsum` → renders fully with all primitives.
- `cd web && npm run build && npm run preview` → visit `/blog` → fixture absent. Visit `/blog/lorem-ipsum` → 404. (Drafts hidden in build mode.)

### Workstream 5 — PR-level verification

Manual checks before requesting review:

| Check | How | Expected |
|---|---|---|
| Build passes | `cd web && npm run build` (with `required_permissions: ["all"]`) | Exit 0 |
| Type/schema check | `cd web && npx astro check` | Exit 0 |
| Empty state in dev | `cd web && npm run dev` → `/blog` (with no real posts, only the draft fixture) | Index lists only the lorem fixture; empty-state copy NOT shown |
| Empty state in build | `cd web && npm run preview` → `/blog` | Empty state copy renders, no posts listed |
| Fixture renders fully | `cd web && npm run dev` → `/blog/lorem-ipsum` | Every primitive visible (prose, code, screenshot, video, badges, prev/next) |
| Fixture absent in build | `cd web && npm run preview` → `/blog/lorem-ipsum` | 404 |
| RSS endpoint valid | `curl http://localhost:4321/blog/rss.xml \| head -c 200` (in dev) | Valid `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" ...>` opening |
| Autodiscovery present | View source of `/blog` and `/blog/lorem-ipsum` (dev mode) | `<link rel="alternate" type="application/rss+xml">` in `<head>` |
| Footer link works | Click "RSS feed" in any page footer | Navigates to `/blog/rss.xml`, browser shows raw XML or downloads |
| W3C validation (post-deploy) | After Vercel preview deploy, paste preview URL's `/blog/rss.xml` into `https://validator.w3.org/feed/` | "Congratulations!" — at most warnings about `<atom:link>` self-reference (which is `@astrojs/rss` default and acceptable) |
| Header active state | Visit `/blog` and `/blog/lorem-ipsum` (dev) | Header's "Blog" link gets accent color + underline, no other nav item active |

## Out of Scope

This ticket explicitly does NOT cover:

- **The launch write-up post** — drafted in parallel under #237 Phase C. T97 ships infrastructure only.
- **Any other real post content** — same as above; T97 ships zero non-fixture content.
- **Tag filter pages** (`/blog/tag/<name>`) — issue-explicit out-of-scope. Tags display only.
- **Pagination on the index** — unneeded until N > ~30 posts. List all posts on one page for v1.
- **Comments, newsletter signup** — issue-explicit out-of-scope.
- **Sitemap broadening** to include `/blog` and `/blog/[slug]` — deferred to **A6 (#304)**. Locked scheduling risk: posts published before A6 lands have zero sitemap presence; one-line PR mitigates if it bites.
- **Site-wide OG defaults** — deferred to A6 (#304). Posts without explicit `ogImage` ship with no social card. The launch write-up (#237) should ship with a manually-crafted OG.
- **Vitest setup in `web/`** — locked decision: zero tests in this PR. Wire when next non-trivial helper lands. Manual visual QA via `astro dev` + lorem fixture is the verification mechanism.
- **Atom feed / `<content:encoded>` full-content RSS** — locked: excerpt-only. Revisit only if a real subscriber asks.
- **Dynamic OG image generation per post** — A6 or later. Frontmatter `ogImage` is a manual path until then.
- **MDX components beyond `<Video>`** — `<Embed>` (tweets), `<Tweet>`, `<YouTube>`, etc. are deferred. Add when a real post needs them.
- **Reading-time package replacement** with custom logic — locked: use the package.
- **Schema fields beyond the 6 locked** (`title`, `date`, `excerpt`, `tags`, `ogImage`, `draft`) — schema is additive-only across PRs; new fields land as `.optional()` first when the need surfaces.
- **`<noscript>` fallback for `<Video>`** — `<video>` is native HTML, works without JS. Not needed.
- **WebVTT captions / `<track>` support on `<Video>`** — single `<source>` for v1; defer if a future post carries spoken explanation.

## Acceptance Criteria

- [ ] **Smoke-test commit landed first** — first commit of the PR installs `@astrojs/rss` + `reading-time`, adds a stub feed endpoint and the `blog` collection (no other route changes), and `cd web && npm run build` (with `required_permissions: ["all"]`) + `cd web && npx astro check` both exit 0 on that commit.
- [ ] **`web/src/pages/blog.astro` is deleted** in the same commit as `web/src/pages/blog/index.astro` is created (no intermediate state with both files present).
- [ ] **`/blog` empty state renders correctly in build mode** — `cd web && npm run preview` shows the h1 "Blog", the inline tertiary RSS link, the intro line, and the empty-state copy *"Nothing here yet — first post lands with the public launch. Subscribe via RSS to get notified."* (no posts listed, since drafts are hidden).
- [ ] **`/blog` populated state renders correctly in dev mode** — `cd web && npm run dev` shows the lorem fixture as a row in the post list with: tags as `<Badge variant="outline">` chips, byline `12 May 2026 · X min read` (en-GB date format), h2 title, excerpt paragraph, hairline divider. Whole row is a clickable `<a>` to `/blog/lorem-ipsum`.
- [ ] **`/blog/lorem-ipsum` renders correctly in dev mode** — visiting in `astro dev` shows: h1 from frontmatter; byline + outline badges; full prose body with all primitives (H2, H3, list, blockquote, inline code, fenced code block, internal link, external link, `<Screenshot>` rendering an image, `<Video>` rendering a player with `controls`, native `<details>` block); prev/next nav at bottom (one-sided since it's the only post). All wrapped in `prose prose-invert max-w-3xl` matching the connect-page typography.
- [ ] **`/blog/lorem-ipsum` returns 404 in build mode** — `cd web && npm run preview` then visiting `/blog/lorem-ipsum` returns a 404 page (the existing `web/src/pages/404.astro`). Drafts are filtered out of `getStaticPaths`.
- [ ] **RSS endpoint emits valid RSS 2.0** — `curl http://localhost:4321/blog/rss.xml` (in `cd web && npm run dev`) returns valid XML starting with `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" ...>`. Channel `<title>` is "GymLogic Blog", `<description>` matches the visible page intro, `<link>` is the absolute site URL. In dev mode, the feed contains the lorem fixture as one `<item>` with `<title>`, `<pubDate>` in RFC822 format, `<description>` containing the excerpt, `<categories>` containing each tag.
- [ ] **RSS endpoint is empty in build mode but still validates** — after `cd web && npm run build`, `dist/blog/rss.xml` exists, parses as valid RSS 2.0, contains zero `<item>` entries (since only the draft fixture exists).
- [ ] **W3C Feed Validator passes on production URL** (post-deploy manual check) — after the Vercel preview deploy posts a preview URL, paste `<preview>/blog/rss.xml` into `https://validator.w3.org/feed/`. Expected output: "Congratulations!" — warnings limited to `<atom:link>` self-reference (acceptable; `@astrojs/rss` includes it by default).
- [ ] **RSS autodiscovery in `<head>`** — view source of `/blog` and `/blog/lorem-ipsum` (dev mode) shows `<link rel="alternate" type="application/rss+xml" title="GymLogic Blog" href="https://docs.gymlogic.me/blog/rss.xml">` in `<head>`. Other pages (`/`, `/about`, `/connect/claude`) do **not** have this link (scoping verified).
- [ ] **Footer "RSS feed" link** — every page's footer (in the "Docs" group) has a "RSS feed" item linking to `/blog/rss.xml`, positioned after the existing `/about` link. Click navigates to the raw XML.
- [ ] **`<Video>` component works end-to-end** — the lorem fixture's `<Video>` renders a `<video controls preload="metadata" playsinline>` element with the correct `src`, optional `poster`, and `<figcaption>` if `caption` provided. Native browser controls work; clicking play starts the video. No autoplay.
- [ ] **`getPublishedPosts` is the single chokepoint** — `index.astro`, `[slug].astro`, and `rss.xml.ts` all derive their post list from `getPublishedPosts()` in `web/src/lib/blog.ts`. Verifiable by `rg getPublishedPosts web/src` returning at least these three call sites.
- [ ] **Reading-time displayed** — both index card and post header show `X min read` (where X = `Math.max(1, Math.ceil(readingTimeFn(body).minutes))`). Floor at 1 verified by an empty/minimal-content post still showing "1 min read".
- [ ] **Date displayed in en-GB format** — both index card and post header show dates as `"12 May 2026"` (day-first, no comma, full month name), wrapped in `<time datetime="2026-05-12">` for machine readability.
- [ ] **Schema validation gates the build** — adding a frontmatter typo (e.g. `tilte` instead of `title`) to the lorem fixture causes `cd web && npx astro check` to fail with a clear error pointing to the offending field.
- [ ] **Drafts excluded from prev/next chain in build mode** — verifiable when 2+ real posts exist; for now, the lorem fixture's prev/next renders as "no older / no newer" placeholders (one-sided, no broken links to draft).
- [ ] **No regressions on existing routes** — `/`, `/about`, `/connect/claude`, `/404` all still render correctly. Header's `/blog` active state still works (visiting `/blog` and `/blog/<slug>` highlights the Blog link via existing `startsWith` logic — no Header surgery needed).

## References

- **Tech Plan**: `file:docs/Tech_Plan_—_A5_Skeleton_Blog_#303.md` (this ticket's source of truth — full code snippets, failure modes, implementation notes)
- **GitHub issue**: #303 — `feat(web): A5 — Skeleton blog (layout + index + RSS, no pipeline)` (de facto Epic Brief, since no `docs/Epic_Brief_—_A5_*.md` exists)
- **Parent epic**: #298 — Astro mini-site
- **A4 prior art** (canonical content-collection pattern this mirrors): `file:docs/Tech_Plan_—_A4_Connect_Claude_#302.md`
- **A4 ticket pattern** (most recent shipped tickets in this epic): `file:docs/T93_—_Connect_Collection_+_Dynamic_Route.md`, `file:docs/T94_—_SEO_+_URL_Infrastructure.md`
- **First post (parallel, not blocking)**: #237 — Ship publicly write-up
- **Future SEO sweep that broadens sitemap**: #304 — A6 SEO + analytics
- **Future automation**: #136 — Agent-Journalist content pipeline
- **Files to be created (new)**: `web/src/lib/blog.ts`, `web/src/pages/blog/index.astro`, `web/src/pages/blog/[slug].astro`, `web/src/pages/blog/rss.xml.ts`, `web/src/components/mdx/Video.astro`, `web/src/content/blog/_lorem-ipsum.mdx`
- **Files to be modified**: `file:web/package.json` (deps), `file:web/src/content.config.ts` (+ blog collection), `file:web/src/layouts/BaseLayout.astro` (+ rssUrl prop), `file:web/src/components/Footer.astro` (+ RSS link)
- **Files to be deleted**: `file:web/src/pages/blog.astro` (placeholder, replaced by folder route)
- **Workspace rules** (relevant for implementation): `file:.cursor/rules/build-sandbox-caveat.mdc` (npm run build needs `required_permissions: ["all"]`), `file:.cursor/rules/no-commit-without-permission.mdc` (wait for explicit user "go" before committing), `file:.cursor/rules/prefer-functional-style.mdc` (helpers use `.filter`/`.map`/`.sort`, no mutable accumulators)
- **Related skill for implementation**: drive each commit with the **tdd** skill where applicable (the lib helpers are pure functions — easy red-green if tests are eventually added; the routes/components are visual and rely on `astro dev` smoke checks)
