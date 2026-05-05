# T93 — Connect Collection + Dynamic Route + MDX Components

## Goal

Build the reusable infrastructure that turns the smoke-test stub from T92 into a real, styled, MDX-driven page architecture. Define the full `connect` content collection schema (Zod-validated, sized for siblings), build 4 custom MDX components (`Callout`, `TechHeavy`, `ComingSoon`, `Screenshot`), wire `@tailwindcss/typography` with a `prose-invert` color palette matching the site's dark aesthetic, and ship the real dynamic `[slug].astro` route that renders frontmatter-driven hero blocks + injected MDX components. Replace T92's `_smoke.mdx` with a stub `claude.mdx` that has real frontmatter and a placeholder body exercising every prose element + each of the 4 MDX components, so the page is demoable end-to-end (visit `/connect/claude` → see styled hero + body) even though the real content lands in T95.

**Mode**: AFK
**Slice**: full Zod schema → 4 MDX components → typography plugin + `prose-invert` overrides → real `[slug].astro` (hero + content) → stub `claude.mdx` exercising all components
**Addresses Epic Brief stories**: #1 (polished page architecture), #14 (collection + schema + layout in place for siblings), #15 (Vercel preview renders MDX end-to-end)
**Position in A4 PR**: commit 2 of 5

## Dependencies

- **T92** (MDX smoke test) — required: `@astrojs/mdx`, `@astrojs/sitemap`, `@tailwindcss/typography` installed; stub route + content collection scaffold exist; build + check verified green
- **T91** (BaseLayout + 5 Routes) — `BaseLayout.astro` exists; this ticket consumes it without modification (modifications come in T94)

## Scope

### 1. Full content collection schema (`web/src/content.config.ts`)

Replace T92's stub with the real Zod definition from the Tech Plan:

```ts
import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const connect = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/connect' }),
  schema: z.object({
    slug: z.string(),
    clientName: z.string(),
    clientUrl: z.string().url(),

    title: z.string(),
    description: z.string(),
    ogImage: z.string(),

    hero: z.object({
      eyebrow: z.string().optional(),
      h1: z.string(),
      subheadlines: z.array(z.string()).max(4),
      heroImage: z
        .object({
          src: z.string(),
          alt: z.string(),
        })
        .optional(),
      ctaLabel: z.string().optional(),
      ctaAnchor: z.string().optional(),
    }),

    pageOrder: z.number().default(99),

    available: z.object({
      oauth: z.boolean().default(true),
      pat: z.boolean().default(false),
      mcpRemote: z.boolean().default(false),
    }),
  }),
})

export const collections = { connect }
```

**Schema discipline:** future fields are added as `.optional()` first, backfilled across MDX files, then tightened. Adding required fields without defaults breaks `claude.mdx` build.

### 2. Custom MDX components

All components live under `web/src/components/mdx/`. Every component starts with `not-prose` to escape the surrounding `prose` styling.

#### `Callout.astro`

Generic callout with three variants:

```astro
---
interface Props {
  type?: 'note' | 'tip' | 'warning'
  title?: string
}
const { type = 'note', title } = Astro.props
const styles = {
  note:    { border: 'border-border',          bg: 'bg-card',          iconColor: 'text-muted'    },
  tip:     { border: 'border-accent/30',       bg: 'bg-accent/5',      iconColor: 'text-accent'   },
  warning: { border: 'border-yellow-500/40',   bg: 'bg-yellow-500/5',  iconColor: 'text-yellow-500' },
}[type]
---
<aside class:list={['not-prose my-6 rounded-lg border p-4', styles.border, styles.bg]}>
  {title && <p class:list={['font-semibold mb-2', styles.iconColor]}>{title}</p>}
  <div class="text-sm text-foreground leading-relaxed [&>p]:mt-2 [&>p:first-child]:mt-0">
    <slot />
  </div>
</aside>
```

#### `TechHeavy.astro`

Specialized warning callout for the PAT-via-`mcp-remote` section. Wraps `<Callout type="warning">` with default `title="Tech-heavy — for advanced users"` and a wrench / alert-triangle icon (lucide `wrench` or `alert-triangle`):

```astro
---
import Callout from './Callout.astro'
interface Props {
  title?: string
}
const { title = 'Tech-heavy — for advanced users' } = Astro.props
---
<Callout type="warning" title={title}>
  <slot />
</Callout>
```

(Optional: render an inline SVG icon next to the title for stronger visual differentiation. Icon use is implementer's call; the slot must accept rich content with `<p>` and `<ul>` children.)

#### `ComingSoon.astro`

Specialized banner callout for the Anthropic Directory section. Wraps `<Callout type="tip">` with default `title="One-click install via Anthropic Directory — Coming soon"` and a sparkle / clock icon (lucide `sparkles` or `clock`):

```astro
---
import Callout from './Callout.astro'
interface Props {
  title?: string
}
const { title = 'One-click install via Anthropic Directory — Coming soon' } = Astro.props
---
<Callout type="tip" title={title}>
  <slot />
</Callout>
```

#### `Screenshot.astro`

Wraps Astro's `<Image>` with caption + responsive sizing. Supports a `priority` flag for the LCP-candidate hero screenshot:

```astro
---
import { Image } from 'astro:assets'
interface Props {
  src: ImageMetadata
  alt: string
  caption?: string
  priority?: boolean
}
const { src, alt, caption, priority = false } = Astro.props
---
<figure class="not-prose my-8">
  <Image
    src={src}
    alt={alt}
    widths={[800, 1200, 1600]}
    sizes="(min-width: 768px) 768px, 100vw"
    class="rounded-lg border border-border"
    loading={priority ? 'eager' : 'lazy'}
    {...(priority && { fetchpriority: 'high' })}
  />
  {caption && (
    <figcaption class="mt-3 text-sm text-muted text-center italic">
      {caption}
    </figcaption>
  )}
</figure>
```

### 3. Typography plugin + `prose-invert` overrides (`web/src/styles/global.css`)

Place the `@plugin` directive between `@import "tw-animate-css";` and `@source './**/*.{astro,tsx,ts}';` (Tailwind v4 syntax — the v3 `tailwind.config.js` approach does NOT work):

```css
@plugin "@tailwindcss/typography";
```

Append the `prose-invert` color override block after `@theme`:

```css
@layer base {
  .prose-invert {
    --tw-prose-body: var(--color-foreground);
    --tw-prose-headings: var(--color-foreground);
    --tw-prose-lead: var(--color-foreground);
    --tw-prose-links: var(--color-accent);
    --tw-prose-bold: var(--color-foreground);
    --tw-prose-counters: var(--color-muted);
    --tw-prose-bullets: var(--color-muted);
    --tw-prose-hr: var(--color-border);
    --tw-prose-quotes: var(--color-foreground);
    --tw-prose-quote-borders: var(--color-accent);
    --tw-prose-captions: var(--color-muted);
    --tw-prose-code: var(--color-accent);
    --tw-prose-pre-code: var(--color-foreground);
    --tw-prose-pre-bg: var(--color-card);
    --tw-prose-th-borders: var(--color-border);
    --tw-prose-td-borders: var(--color-border);
  }
}
```

Add native `<details>` styling (used by stub MDX + future content):

```css
details > summary { list-style: none; cursor: pointer; }
details > summary::-webkit-details-marker { display: none; }
details > summary::marker { display: none; }
summary::after {
  content: '▸';
  display: inline-block;
  margin-left: 0.5rem;
  transition: transform 150ms;
}
details[open] > summary::after { transform: rotate(90deg); }
```

(Wrap rotation in `motion-safe:` if `prefers-reduced-motion` honoring is desired.)

**Fallback if `@plugin` doesn't load typography correctly:** hand-roll prose CSS (~150 lines covering `p` / `ul` / `ol` / `h2-h4` / `code` / `pre` / `blockquote` / `table` / `a` / `hr`) and document the failure in the commit message. Single-PR cost.

### 4. Shiki theme in `web/astro.config.mjs`

Add markdown configuration for code-block highlighting:

```js
export default defineConfig({
  // ... existing ...
  markdown: {
    shikiConfig: {
      theme: 'material-theme-darker',
    },
  },
})
```

If `material-theme-darker` clashes against the `#0f0f13` background, fall back to `vesper`, `nord`, or `vitesse-dark`.

### 5. Real dynamic route (`web/src/pages/connect/[slug].astro`)

Replace T92's stub with the full route — hero block from frontmatter + prose article wrapper + injected MDX components:

```astro
---
import { getCollection, render } from 'astro:content'
import BaseLayout from '@/layouts/BaseLayout.astro'
import Callout from '@/components/mdx/Callout.astro'
import TechHeavy from '@/components/mdx/TechHeavy.astro'
import ComingSoon from '@/components/mdx/ComingSoon.astro'
import Screenshot from '@/components/mdx/Screenshot.astro'

export async function getStaticPaths() {
  const entries = await getCollection('connect')
  return entries.map((entry) => ({ params: { slug: entry.id }, props: { entry } }))
}

const { entry } = Astro.props
const { Content } = await render(entry)
const { hero, title, description } = entry.data
---

<BaseLayout title={title} description={description}>
  <section class="mx-auto max-w-3xl px-4 pt-16 pb-12">
    {hero.eyebrow && (
      <p class="text-sm uppercase tracking-wider text-accent">{hero.eyebrow}</p>
    )}
    <h1 class="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
      {hero.h1}
    </h1>
    <div class="mt-6 space-y-2 text-lg text-muted leading-relaxed">
      {hero.subheadlines.map((line) => <p>{line}</p>)}
    </div>
    {hero.ctaLabel && hero.ctaAnchor && (
      <a
        href={hero.ctaAnchor}
        class="mt-8 inline-flex items-center gap-2 text-accent hover:text-foreground transition-colors duration-150"
      >
        {hero.ctaLabel}
      </a>
    )}
  </section>

  <article class="prose prose-invert mx-auto max-w-3xl px-4 pb-24">
    <Content components={{ Callout, TechHeavy, ComingSoon, Screenshot }} />
  </article>
</BaseLayout>
```

**Note:** SEO meta props (`indexable`, `canonical`, `ogImage`) are not yet passed to `BaseLayout` — those props don't exist until T94. T93's page renders with `BaseLayout`'s default `noindex` (intermediate state, fixed in commit 3).

**Hero image rendering decision:** per Tech Plan Implementation Notes, the hero image is rendered inside the MDX body as the first element using `<Screenshot priority>` (option a), NOT from frontmatter. The `hero.heroImage` schema field stays in place for future siblings but is not read by the route in T93. Keeps all hero pieces colocated in MDX.

### 6. Stub `claude.mdx` (`web/src/content/connect/claude.mdx`)

Replace T92's `_smoke.mdx` with a real-frontmatter stub that exercises every prose element + each MDX component. Body content is placeholder ("Lorem ipsum"-style or short demo paragraphs) — T95 swaps in the real content:

```mdx
---
slug: claude
clientName: Claude Desktop
clientUrl: https://claude.ai/download
title: Connect GymLogic to Claude Desktop — Setup guide
description: Use your full GymLogic training data inside Claude Desktop via MCP. ~30s OAuth setup; PAT and mcp-remote alternatives for advanced users.
ogImage: /og/connect-claude.png
hero:
  eyebrow: MCP Connector
  h1: Use your training data inside Claude
  subheadlines:
    - Chat with your full training history, stats, and exercise catalog.
    - Generate or rewrite multi-day programs in seconds — Claude proposes, you approve, GymLogic writes.
    - Skip the UI when you already know what you want; let Claude guide you when you don't.
  ctaLabel: Setup guide ↓
  ctaAnchor: '#setup'
pageOrder: 1
available:
  oauth: true
  pat: true
  mcpRemote: true
---

## Setup

<ComingSoon>
  Placeholder body — T95 swaps in real content.
</ComingSoon>

### Method 1 — Custom Connector (recommended)

Placeholder paragraph demonstrating prose body styling. Includes [an inline link](https://claude.ai/download), `inline code`, **bold**, *italic*.

1. First step
2. Second step
3. Third step

```json
{
  "example": "code block to verify Shiki theming"
}
```

### Alternative: Personal Access Token

<TechHeavy>
  Placeholder body — T95 swaps in the 4 PAT gotchas (Node 18+, nvm, npm cache, absolute path).
</TechHeavy>

<details>
  <summary>Show PAT config</summary>
  Placeholder.
</details>

<Callout type="note" title="Note">
  Generic callout demonstrating the note variant.
</Callout>
```

**Stub discipline:** the body is **deliberately incomplete** — its only job is to verify (a) the route renders, (b) prose styling renders correctly, (c) all 4 MDX components mount without errors, (d) Shiki highlights code blocks. T95 owns the real content.

### 7. Cleanup

- Delete `web/src/content/connect/_smoke.mdx` (T92 scaffolding)
- The stub `[slug].astro` from T92 is fully replaced by the real route from §5
- Commit message: `feat(web): connect collection + dynamic route + 4 MDX components + typography`

## Out of Scope

- Real `claude.mdx` body content (Prereqs, full OAuth flow, real PAT instructions, mcp-remote configs, Available tools table, Example conversation, Troubleshooting) — owned by **T95**
- 5 Claude Desktop screenshot captures — owned by **T95**
- Source `docs/mcp-connect/claude-desktop.md` sync — owned by **T95**
- BaseLayout SEO meta props (`indexable`, `canonical`, `ogImage`) — owned by **T94**
- Sitemap filter callback in `astro.config.mjs` — owned by **T94**
- `robots.txt` — owned by **T94**
- Redirect from `/claude-connector` → `/connect/claude` — owned by **T94**
- Header / Footer URL surgery — owned by **T94**
- Deletion of `web/src/pages/claude-connector.astro` — owned by **T94**
- OG card PNG file at `web/public/og/connect-claude.png` — owned by **T96** (frontmatter references the path, file doesn't exist yet — `<meta og:image>` not yet emitted because BaseLayout doesn't know about `ogImage` until T94)
- `<article id="setup">` anchor for the `Setup guide ↓` CTA — Astro auto-generates `id="setup"` from the `## Setup` H2 (verify in dev; Tech Plan Failure Mode covers fallback)

## Acceptance Criteria

- [ ] `web/src/content.config.ts` defines the full `connect` collection schema with all fields from the Tech Plan (`slug`, `clientName`, `clientUrl`, `title`, `description`, `ogImage`, `hero` object, `pageOrder`, `available` object)
- [ ] `web/src/components/mdx/Callout.astro` exists and supports `type` (`'note'|'tip'|'warning'`) + optional `title` props
- [ ] `web/src/components/mdx/TechHeavy.astro` exists and renders a `Callout type="warning"` with default tech-heavy title
- [ ] `web/src/components/mdx/ComingSoon.astro` exists and renders a `Callout type="tip"` with default Directory title
- [ ] `web/src/components/mdx/Screenshot.astro` exists, wraps Astro `<Image>` with caption + `priority` flag → `loading="eager"` + `fetchpriority="high"`
- [ ] `web/src/styles/global.css` registers `@plugin "@tailwindcss/typography";` and includes the `prose-invert` color override block
- [ ] `web/src/styles/global.css` includes native `<details>` styling (hidden default marker, custom chevron, rotation on `[open]`)
- [ ] `web/astro.config.mjs` declares `markdown.shikiConfig.theme` (e.g. `'material-theme-darker'`)
- [ ] `web/src/pages/connect/[slug].astro` renders hero (eyebrow + H1 + subheadlines + optional CTA anchor) + `<article class="prose prose-invert">` containing `<Content components={{ Callout, TechHeavy, ComingSoon, Screenshot }} />`
- [ ] `web/src/content/connect/claude.mdx` exists with the full Tech Plan frontmatter and a placeholder body that exercises: (a) `<ComingSoon>`, (b) `<TechHeavy>`, (c) `<Callout type="note">`, (d) a `<details>` block, (e) at least one code block, (f) at least one inline link, (g) at least one ordered list
- [ ] `web/src/content/connect/_smoke.mdx` deleted
- [ ] Visiting `/connect/claude` in `astro dev` (or after `astro build && astro preview`) renders: hero block (eyebrow "MCP Connector" + H1 + 3 subheadlines + "Setup guide ↓" CTA) + prose body where every MDX component mounts without console errors and the code block is syntax-highlighted
- [ ] Clicking "Setup guide ↓" scrolls to the `## Setup` H2 (auto-generated `id="setup"`)
- [ ] `cd web && npx astro check` exits 0 (Zod schema validates `claude.mdx` frontmatter)
- [ ] `cd web && npm run build` exits 0 when run with `required_permissions: ["all"]`
- [ ] `cd web && npm run lint` exits 0

## References

- Epic Brief: `file:docs/Epic_Brief_—_A4_Connect_Claude_#302.md` (Scope items 3, 5, 17; Stories #14, #15)
- Tech Plan: `file:docs/Tech_Plan_—_A4_Connect_Claude_#302.md` — see Data Model §1 (Content Collection Schema), Component Architecture (Component Responsibilities for `[slug].astro`, `Callout`, `TechHeavy`, `ComingSoon`, `Screenshot`), Implementation Notes (Astro 6 content collection API, `@plugin` directive in Tailwind v4, prose color override snippet, native `<details>` styling, MDX component injection per page, hero image rendering decision)
- Predecessor: T92 (smoke test) — installs deps, verifies build
- Successor: T94 (SEO + URL infra) — adds BaseLayout SEO meta props, redirect, nav surgery
- Successor: T95 (content + screenshots) — replaces stub `claude.mdx` body with real content
- Successor: T96 (OG card) — produces the PNG referenced by `claude.mdx`'s `ogImage` frontmatter
- Existing `BaseLayout.astro` (consumed unmodified): `file:web/src/layouts/BaseLayout.astro`
- Existing `astro.config.mjs` (extended for Shiki): `file:web/astro.config.mjs`
- Existing `global.css` (extended for typography + prose overrides + `<details>`): `file:web/src/styles/global.css`
- Workspace rule (mandatory for build commands): `file:.cursor/rules/build-sandbox-caveat.mdc`
- Workspace rule (functional style preferred): `file:.cursor/rules/prefer-functional-style.mdc` — `getStaticPaths` uses `.map()` already
- Parent epic: #298 — Astro mini-site
- This A4 ticket: #302 — A4 Doc connecteur Claude page
