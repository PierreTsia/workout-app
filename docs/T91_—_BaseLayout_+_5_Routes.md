# T91 — BaseLayout + 5 Routes (end-to-end demo)

## Goal

The "everything composes" ticket. Extend `BaseLayout.astro` to wire `Header` + `<main id="main">` + `Footer` plus a skip-to-content link. Refactor `index.astro` to use the new chrome. Ship four placeholder routes (`/claude-connector`, `/blog`, `/about`) plus `/404`. After this ticket, all 5 routes deploy with consistent chrome, the canonical `/claude-connector` URL is publicly live for #296, and the visible A2 demo lands on `docs.gymlogic.me`.

**Mode**: AFK
**Slice**: Layout extension → 5 routes → noindex preservation → end-to-end Vercel preview demo
**Addresses Epic Brief stories**: #1 (BaseLayout for A3-A7), #2 (sober dark UI in production), #3 ("coming soon" placeholder framing), #7 (skip-link + landmarks), #10 (`/claude-connector` URL live day-one), #12 (noindex preserved), #13 (`/404`), #14 (Vercel preview renders all 4 placeholders)

## Dependencies

- **T86** (Foundation + CI Plumbing)
- **T87** (Port shadcn Primitives + Logo)
- **T88** (Header)
- **T89** (MobileNav React Island)
- **T90** (Footer)

## Scope

### 1. `web/src/layouts/BaseLayout.astro`

Extend the A1 stub. Skip-link must be the first focusable child of `<body>` (visually hidden until focused). Preserve all A1 `<head>` contents.

```astro
---
import '../styles/global.css'
import Header from '../components/Header.astro'
import Footer from '../components/Footer.astro'

interface Props {
  title: string
  description?: string
}

const {
  title,
  description = 'GymLogic — public documentation and write-ups.',
} = Astro.props
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <meta name="description" content={description} />
    <link rel="icon" href="data:," />
    <title>{title}</title>
  </head>
  <body class="min-h-screen flex flex-col">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-md focus:bg-background focus:text-foreground focus:outline focus:outline-2 focus:outline-accent"
    >
      Skip to content
    </a>
    <Header />
    <main id="main" class="flex-1">
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

### 2. `web/src/pages/index.astro` (refactor)

Replace the A1 placeholder:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro'
---

<BaseLayout
  title="GymLogic — coming soon"
  description="Public documentation and write-ups for GymLogic. Real content coming soon."
>
  <section class="mx-auto max-w-3xl px-4 py-24">
    <h1 class="text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
      GymLogic
    </h1>
    <p class="mt-6 text-lg text-muted leading-relaxed">
      Workout app + AI coaching. The public craft surface — pitch, demo, and links — landing here as part of A3.
    </p>
    <p class="mt-4 text-sm text-muted">
      Tracked in <a class="underline hover:text-foreground" href="https://github.com/PierreTsia/workout-app/issues/301">#301</a>.
    </p>
  </section>
</BaseLayout>
```

### 3. `web/src/pages/claude-connector.astro` (new)

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro'
---

<BaseLayout
  title="Claude connector — GymLogic"
  description="One-click Claude Desktop connector for GymLogic. Setup guide coming soon."
>
  <section class="mx-auto max-w-3xl px-4 py-24">
    <h1 class="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
      Claude connector setup
    </h1>
    <p class="mt-6 text-lg text-muted leading-relaxed">
      One-click install for Claude Desktop, with usage examples, scopes, and troubleshooting. Landing here as part of A4.
    </p>
    <p class="mt-4 text-sm text-muted">
      Tracked in <a class="underline hover:text-foreground" href="https://github.com/PierreTsia/workout-app/issues/302">#302</a>.
    </p>
  </section>
</BaseLayout>
```

### 4. `web/src/pages/blog.astro` (new)

Sober "Blog — coming soon" with backlink to **#303**.

### 5. `web/src/pages/about.astro` (new)

Sober "About / how I work — coming soon" with backlink to **#305**.

### 6. `web/src/pages/404.astro` (new)

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro'
import { Button } from '../components/ui/button'
---

<BaseLayout
  title="Page not found — GymLogic"
  description="The page you're looking for does not exist."
>
  <section class="mx-auto max-w-3xl px-4 py-24">
    <h1 class="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
      Page not found
    </h1>
    <p class="mt-6 text-lg text-muted leading-relaxed">
      The page you were looking for does not exist on <span class="font-mono">docs.gymlogic.me</span>.
    </p>
    <div class="mt-10 flex gap-3">
      <Button variant="default" asChild>
        <a href="/">Back to home</a>
      </Button>
      <Button variant="outline" asChild>
        <a href="https://gymlogic.me" target="_blank" rel="noopener noreferrer">
          Launch app →
        </a>
      </Button>
    </div>
  </section>
</BaseLayout>
```

Astro automatically emits `dist/404.html` for any `pages/404.astro`; Vercel serves it on miss.

## Out of Scope

- Real content for any of the 4 placeholder routes — owned by A3 (#301), A4 (#302), A5 (#303), A7 (#305)
- Removing `<meta name="robots" content="noindex">` — A6 (#304)
- Sitemap, OG tags, analytics — A6
- View Transitions / route animations — deferred (Tech Plan)
- Custom error/loading layouts beyond the 404

## Acceptance Criteria

- [ ] `BaseLayout.astro` includes a skip-to-content link as the first focusable child of `<body>`; the link is visually hidden by default and visible on focus
- [ ] BaseLayout wraps the slot with `<Header />` + `<main id="main">` + `<Footer />`
- [ ] `<head>` preserves `<meta name="robots" content="noindex">` (verify the rendered output of every route includes it)
- [ ] All 5 routes deploy successfully via Vercel preview: `/`, `/claude-connector`, `/blog`, `/about`, `/404`
- [ ] Each route uses the new BaseLayout chrome (Header sticky on top, Footer at bottom, content centered with `max-w-3xl`)
- [ ] Each placeholder page has a sober h1 + 1-2 muted paragraphs + GitHub-issue backlink (with hover underline treatment)
- [ ] Tabbing from the document start hits the skip-link first; activating it focuses `<main id="main">` and the viewport scrolls to it
- [ ] Active nav link state propagates: visiting `/claude-connector` highlights the "Claude connector" link in BOTH desktop nav (Header) AND mobile drawer (MobileNav)
- [ ] No nav link returns a 404 (all 4 internal hrefs in the chrome resolve to existing routes)
- [ ] `/404.astro` renders with chrome and shows "Page not found" + Home + Launch app CTAs; visiting any non-existent URL on the deployed site (e.g., `/does-not-exist`) serves it (verify after merge to main)
- [ ] Lighthouse mobile audit on at least one route (e.g., `/claude-connector`) scores: a11y > 95, CLS = 0
- [ ] PageSpeed Insights mobile (or Lighthouse) reports CLS = 0 across all 5 routes
- [ ] `curl -s https://docs.gymlogic.me/claude-connector | grep -i 'noindex'` returns the meta tag (post-merge sanity check)
- [ ] Vercel preview URL posted by `preview-deploy-web` (from A1) renders the chrome correctly across all 5 routes
- [ ] Root `npm run lint`, root `npm run build`, and `cd web && npx astro check` all pass
- [ ] CI: `web-checks-passed` is green on this PR, including both `preview-deploy-web` and `web-type-check`

## References

- Epic Brief: `file:docs/Epic_Brief_—_A2_Layout_Nav_Footer_#300.md`
- Tech Plan: `file:docs/Tech_Plan_—_A2_Layout_Nav_Footer_#300.md` (Component Responsibilities for `BaseLayout.astro`, Data Model §3 Route Topology, Failure Mode Analysis)
- A1 Tech Plan (BaseLayout starting point): `file:docs/Tech_Plan_—_Astro_Bootstrap_#299.md`
- Existing A1 layout to extend: `file:web/src/layouts/BaseLayout.astro`
- Coupling: #296 (Anthropic Connectors Directory) — depends on `/claude-connector` being live after this PR merges
- Sibling tickets that consume this layout: #301 (A3), #302 (A4), #303 (A5), #305 (A7)
