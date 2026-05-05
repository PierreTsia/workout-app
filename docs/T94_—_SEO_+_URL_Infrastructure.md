# T94 — SEO + URL Infrastructure (meta + sitemap + redirect + nav surgery)

## Goal

Make `/connect/claude` properly discoverable, canonical, redirected, and nav-coherent. Extend `BaseLayout.astro` with three new optional props (`indexable`, `canonical`, `ogImage`) that emit the right `<meta robots>`, `<link rel="canonical">`, and full OG / Twitter meta tag set per page (preserving the site-wide `noindex` default until A6 flips it). Configure `@astrojs/sitemap` to emit only `/connect/*` URLs. Hand-write `robots.txt` referencing the sitemap. Add the 308 redirect from `/claude-connector` → `/connect/claude` to `astro.config.mjs`, and delete the now-redundant stub Astro page in the same commit (otherwise the file route shadows the redirect). Update `Header.astro` AND `Footer.astro` to point at the new URL — both must land together or the Footer's active-state matcher silently misses.

**Mode**: AFK
**Slice**: BaseLayout 3 props → meta tag emission (`robots` / `canonical` / `og:*` / `twitter:*`) → sitemap integration + filter regex → `robots.txt` → 308 redirect → Header URL → Footer URL → stub deletion
**Addresses Epic Brief stories**: #7 (legacy URL redirect), #8 (indexable + canonical + sitemap), #9 (other pages keep `noindex`), #10 (OG meta wired — image content lands in T96), #12 (Header link coherent)
**Position in A4 PR**: commit 3 of 5

## Dependencies

- **T92** (MDX smoke test) — `@astrojs/sitemap` installed
- **T93** (Connect collection + route) — `/connect/claude` exists as a real page so the redirect has a target and the sitemap has something to emit
- **T91** (BaseLayout + 5 Routes) — `BaseLayout.astro` exists; this ticket extends it (the `<meta robots noindex>` line is the one being made conditional)

## Scope

### 1. Extend `file:web/src/layouts/BaseLayout.astro`

Add three optional props and rewire the `<head>`:

```astro
---
import '../styles/global.css'
import Header from '../components/Header.astro'
import Footer from '../components/Footer.astro'

interface Props {
  title: string
  description?: string
  indexable?: boolean
  canonical?: string
  ogImage?: string
}

const {
  title,
  description = 'GymLogic — public documentation and write-ups.',
  indexable = false,
  canonical,
  ogImage,
} = Astro.props

const canonicalUrl = canonical ?? new URL(Astro.url.pathname, Astro.site).toString()
const ogImageUrl = ogImage ? new URL(ogImage, Astro.site).toString() : undefined
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content={indexable ? 'index, follow' : 'noindex'} />
    <meta name="description" content={description} />
    <link rel="canonical" href={canonicalUrl} />
    {ogImageUrl && (
      <>
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={ogImageUrl} />
      </>
    )}
    <link rel="icon" href="data:," />
    <title>{title}</title>
  </head>
  <body class="min-h-screen flex flex-col">
    <!-- ... rest of body unchanged (skip-link + Header + main + Footer) ... -->
  </body>
</html>
```

**Discipline:**
- The hardcoded `<meta name="robots" content="noindex" />` from A2 is replaced by the conditional. Default stays `noindex` — every existing page that doesn't pass `indexable={true}` keeps its current behavior. Backward-compatible.
- `canonicalUrl` is **always emitted** — this is fine for `noindex` pages too (canonical is a hint, not a directive; doesn't affect indexing).
- OG / Twitter tags only emitted when `ogImage` is provided. Avoids emitting empty/broken cards on placeholder pages.
- `og:type="website"` is correct for documentation pages (`article` is for blog posts).

### 2. Pass new props from `web/src/pages/connect/[slug].astro`

Update T93's route to thread the SEO props:

```astro
const { hero, title, description, ogImage } = entry.data
---

<BaseLayout
  title={title}
  description={description}
  indexable
  ogImage={ogImage}
>
  <!-- ... unchanged hero + article ... -->
</BaseLayout>
```

Note: `canonical` is auto-derived in BaseLayout from `Astro.site + Astro.url.pathname`. No need to pass it explicitly for the standard case.

### 3. Sitemap integration in `file:web/astro.config.mjs`

Replace T92's bare `sitemap()` with the filter callback:

```js
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  // ...
  integrations: [
    react(),
    mdx(),
    sitemap({
      filter: (page) => /^https:\/\/docs\.gymlogic\.me\/connect\/[a-z-]+\/?$/.test(page),
    }),
  ],
})
```

Filter discipline:
- URL-string based, not metadata-based (`@astrojs/sitemap` doesn't see rendered page metadata)
- Whitelists `/connect/{slug}` URLs only — placeholder pages (`/`, `/about`, `/blog`) stay out of the sitemap until A6
- Trailing-slash tolerant (`/?` at the end)
- After build, verify `dist/sitemap-0.xml` contains exactly `/connect/claude` and nothing else

### 4. `web/public/robots.txt` (new file)

3 lines, hand-written:

```
User-agent: *
Allow: /
Sitemap: https://docs.gymlogic.me/sitemap-index.xml
```

Trivial enough not to justify a generator dep. Placed in `web/public/` so Astro serves it as `/robots.txt` verbatim.

### 5. Redirect in `file:web/astro.config.mjs`

Add the redirect map (alongside `integrations` and `markdown`):

```js
export default defineConfig({
  // ...
  redirects: {
    '/claude-connector': {
      destination: '/connect/claude',
      status: 308,
    },
  },
})
```

`308` is preferred over `301` for permanent renames (preserves request method). Astro's static output emits this as a static `308` HTTP response that Vercel respects via the static-output redirect manifest.

**Verify on Vercel preview** (not in `astro dev` — dev mode behavior may differ):

```bash
curl -I https://<preview>.vercel.app/claude-connector
# Expected: HTTP/1.1 308 Permanent Redirect
# Expected: Location: /connect/claude
```

### 6. Delete `file:web/src/pages/claude-connector.astro`

The stub from T91 must be deleted **in the same commit as adding the redirect**. Reason: file routes win over config-level redirects. If the file lives, `/claude-connector` serves the stub instead of redirecting. T91's stub is now superseded.

### 7. Update `file:web/src/components/Header.astro`

Two surgical changes:
- `linkIcons['/claude-connector']` map key → `'/connect/claude'` (icon SVG path string unchanged)
- `links[0].href` (the "Claude connector" entry in the nav array) → `'/connect/claude'` (label unchanged)

The active-state matcher (`startsWith` on `Astro.url.pathname`) already handles the `/connect/*` namespace correctly.

### 8. Update `file:web/src/components/Footer.astro`

Surgical change:
- `groups[1].links[0].href` (Docs group, "Claude connector" entry) → `'/connect/claude'` (label unchanged)

**Why this is critical to land with the Header change:** the Footer was missed by the original Brief and surfaced during Tech Plan scout. If only the Header is updated, the Footer's `startsWith` active-state matcher silently never matches `/connect/claude` (since `/claude-connector` doesn't startsWith `/connect/claude`) — the footer link still works because of the redirect, but the active-state highlight is broken. Both files, one logical change, same commit.

### 9. Verify before commit

Local checks:

```bash
cd web
npx astro check       # zero errors
npm run lint           # passes
npm run build          # passes (with required_permissions: ["all"])
```

Then visually verify in `astro preview` (or the Vercel preview deploy after push):

- `curl -I http://localhost:4321/claude-connector` → 308 + `Location: /connect/claude` (verify on Vercel preview, not `astro dev`)
- `curl http://localhost:4321/connect/claude | grep -i 'meta name="robots"'` → `content="index, follow"`
- `curl http://localhost:4321/connect/claude | grep -i 'rel="canonical"'` → `https://docs.gymlogic.me/connect/claude`
- `curl http://localhost:4321/connect/claude | grep -i 'og:image'` → `https://docs.gymlogic.me/og/connect-claude.png` (file doesn't exist yet — T96 produces it; meta tag emitted regardless)
- `curl http://localhost:4321/sitemap-index.xml` → references `sitemap-0.xml` containing `/connect/claude` (and only that)
- `curl http://localhost:4321/robots.txt` → matches the 3-line content above
- Other pages (`/`, `/about`, `/blog`) curl shows `<meta name="robots" content="noindex">` unchanged
- Header link active state highlights when on `/connect/claude` (visual)
- Footer "Claude connector" link active state highlights when on `/connect/claude` (visual)

Commit message: `feat(web): SEO + URL infra (BaseLayout meta props + sitemap + robots + redirect + nav surgery)`

## Out of Scope

- The actual OG card PNG file at `web/public/og/connect-claude.png` — owned by **T96**. T94 emits the `<meta og:image>` tag pointing at the path; the image renders broken in social validators until T96 lands the file.
- Real `claude.mdx` body content — owned by **T95**
- 5 Claude Desktop screenshot captures — owned by **T95**
- Source `docs/mcp-connect/claude-desktop.md` sync — owned by **T95**
- Lifting the global `noindex` default on `BaseLayout` — owned by **A6** (#304); when A6 flips the default to `indexable={true}`, the explicit `indexable` calls in `[slug].astro` become dead code and A6 should grep + clean up
- Analytics integration — owned by **A6** (#304)
- Verification of social card validators (LinkedIn Post Inspector, X card validator) — owned by **T96** (the validator can't render a card until T96's PNG exists)

## Acceptance Criteria

- [ ] `BaseLayout.astro` accepts new optional props: `indexable?: boolean` (default `false`), `canonical?: string`, `ogImage?: string`
- [ ] `BaseLayout.astro` emits `<meta name="robots" content={indexable ? 'index, follow' : 'noindex'} />` (replacing the hardcoded `noindex`)
- [ ] `BaseLayout.astro` emits `<link rel="canonical" href={canonical ?? Astro.site + pathname} />` on every page
- [ ] `BaseLayout.astro` emits the full OG / Twitter meta set (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `twitter:card`, `twitter:image`) ONLY when `ogImage` is provided
- [ ] `[slug].astro` passes `indexable` and `ogImage={entry.data.ogImage}` to `BaseLayout`
- [ ] `web/astro.config.mjs` registers `sitemap({ filter: (page) => /^https:\/\/docs\.gymlogic\.me\/connect\/[a-z-]+\/?$/.test(page) })`
- [ ] `web/astro.config.mjs` declares `redirects: { '/claude-connector': { destination: '/connect/claude', status: 308 } }`
- [ ] `web/public/robots.txt` exists with exactly: `User-agent: *` / `Allow: /` / `Sitemap: https://docs.gymlogic.me/sitemap-index.xml`
- [ ] `web/src/pages/claude-connector.astro` is deleted
- [ ] `web/src/components/Header.astro` updates: `linkIcons` map key `/claude-connector` → `/connect/claude`, and `links[0].href` → `/connect/claude`
- [ ] `web/src/components/Footer.astro` updates: `groups[1].links[0].href` (Docs group, "Claude connector") → `/connect/claude`
- [ ] After `astro build`, `dist/sitemap-0.xml` contains `<loc>https://docs.gymlogic.me/connect/claude</loc>` and does NOT contain `/`, `/about`, `/blog`, or `/404`
- [ ] After deploy, `curl -I https://<preview>/claude-connector` returns `HTTP/1.1 308` + `Location: /connect/claude`
- [ ] `curl https://<preview>/connect/claude | grep robots` returns `content="index, follow"`
- [ ] `curl https://<preview>/connect/claude | grep canonical` returns `https://docs.gymlogic.me/connect/claude`
- [ ] `curl https://<preview>/connect/claude | grep og:image` returns `https://docs.gymlogic.me/og/connect-claude.png` (file may 404 until T96 — meta tag emission verified independently)
- [ ] `curl https://<preview>/` (home) shows `<meta name="robots" content="noindex">` unchanged
- [ ] `curl https://<preview>/about` and `https://<preview>/blog` show `<meta name="robots" content="noindex">` unchanged
- [ ] `curl https://<preview>/robots.txt` returns the expected 3-line content
- [ ] Header navigation: visiting `/connect/claude` highlights the "Claude connector" link with the active-state styling (visual)
- [ ] Footer navigation: visiting `/connect/claude` highlights the "Claude connector" link in the Docs group (visual)
- [ ] `cd web && npx astro check` exits 0
- [ ] `cd web && npm run lint` exits 0
- [ ] `cd web && npm run build` exits 0 when run with `required_permissions: ["all"]`

## References

- Epic Brief: `file:docs/Epic_Brief_—_A4_Connect_Claude_#302.md` (Scope items 11-16; Success Criteria numeric checks for sitemap / canonical / robots / redirect; Stories #7, #8, #9, #10, #12)
- Tech Plan: `file:docs/Tech_Plan_—_A4_Connect_Claude_#302.md` — see Key Decisions (sitemap filter, robots.txt, redirect status 308, BaseLayout 3 props, Header / Footer surgery, stub deletion), Critical Constraints (Footer must update with Header, redirect is 308 permanent), Component Architecture (`BaseLayout.astro` modified responsibilities), Implementation Notes (sitemap filter regex, Astro `redirects` format, robots.txt content, Vercel preview verification)
- Predecessor: T93 (collection + route) — provides the `/connect/claude` target for the redirect and the page emitted into the sitemap
- Successor: T96 (OG card) — produces the PNG file referenced by the `<meta og:image>` tag emitted in this ticket
- Existing `BaseLayout.astro` (extended): `file:web/src/layouts/BaseLayout.astro`
- Existing `Header.astro` (URL surgery): `file:web/src/components/Header.astro`
- Existing `Footer.astro` (URL surgery): `file:web/src/components/Footer.astro`
- Existing `astro.config.mjs` (sitemap + redirect): `file:web/astro.config.mjs`
- Existing stub (deleted): `file:web/src/pages/claude-connector.astro`
- Workspace rule (mandatory for build commands): `file:.cursor/rules/build-sandbox-caveat.mdc`
- Parent epic: #298 — Astro mini-site
- This A4 ticket: #302 — A4 Doc connecteur Claude page
- Coupling: A6 (#304) inverts the global default and may delete the per-page `indexable` mechanism this ticket ships
