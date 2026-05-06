# Epic Brief — A2 Layout / Nav / Footer (#300)

## Summary

A2 ships the chrome that wraps every page on `docs.gymlogic.me`: a sober, typographic, dark-only layout with sticky header (logo + nav + GitHub + Launch app CTA), a slide-in mobile drawer, and a two-column footer. It also commits the canonical URL `/claude-connector` (the URL #296's Anthropic Connectors Directory submission depends on) and ships placeholder pages at all four future routes (`/`, `/claude-connector`, `/blog`, `/about`) so the nav links resolve and downstream tickets (A3-A7) become pure body-content rewrites. A2 introduces React islands via `@astrojs/react`, ports four shadcn primitives from the SPA (Button, Card, Sheet, Badge), and self-hosts Geist Sans + Geist Mono with zero-CLS font loading.

---

## Context & Problem

**Who is affected:** the solo dev (Pierre) building A3-A7 content tickets; future visitors landing on `docs.gymlogic.me`; the Anthropic Connectors Directory submission (#296) that needs a stable URL committed before A4 ships content; screen-reader and keyboard users who hit the public surface.

**Current state:**

- `file:web/src/layouts/BaseLayout.astro` is bare bones — just `<head>` + `<slot />` + a body class (`bg-slate-50 dark:bg-slate-950`). No header, no footer, no nav, no design tokens, no component vocabulary.
- The SPA's `file:src/styles/globals.css` defines a rich token system (HSL custom props, dark/light variants, ~20 semantic colors) but **none of it is wired into `web/`**.
- The SPA has 35 shadcn primitives in `file:src/components/ui/` but none are accessible from `web/`.
- The SPA's marketing pages (`file:src/pages/AboutPage.tsx`) have already drifted from the app's `--primary` token (using `#00c9a7` instead of `#00c9b1`), revealing that the public surface needs its own canonical palette decision.
- The 4 sibling tickets (A3, A4, A5, A7) all need a layout shell — without A2, each one would either rebuild the chrome or ship without it.
- #296 (Anthropic Connectors Directory submission) is blocked on a stable URL that A4 will inhabit. A2 is where that URL is locked in.

**Pain points:**


| Pain                                   | Impact                                                      |
| -------------------------------------- | ----------------------------------------------------------- |
| No layout shell                        | Every downstream ticket (A3-A7) rebuilds chrome             |
| No design tokens in `web/`             | Either copy hex literals everywhere or drift from SPA       |
| No shadcn vocabulary in `web/`         | Every page reinvents Button/Card patterns inline            |
| Anthropic Directory submission blocked | #296 cannot proceed without a public URL                    |
| Vitrine/portfolio claim has no surface | Shipping #237 (public craft piece) requires polished chrome |


---

## User Stories

1. As the **solo dev**, I want a polished `BaseLayout.astro` with composable slots, so that A3-A7 tickets are pure body-content rewrites with zero chrome work.
2. As a **first-time visitor** landing on `docs.gymlogic.me`, I want a sober dark-mode UI with confident typography, so that the public surface signals craft and the SPA feels like a sibling.
3. As a **visitor on any placeholder page** (`/claude-connector`, `/blog`, `/about`), I want clear "coming soon" framing with a backlink to the tracking GitHub issue, so that the page reads as intentionally pending rather than broken.
4. As a **visitor wanting to try the app**, I want a "Launch app →" CTA always available in the header (sticky) and footer, so that I'm one click from `gymlogic.me` without the docs surface nagging me.
5. As a **visitor curious about the source**, I want a GitHub icon in the header, so that I can verify the open-source claim immediately.
6. As a **mobile visitor**, I want a real slide-in nav drawer (from-right) with backdrop, focus trap, scroll lock, escape-to-close, and click-outside-to-close, so that navigation feels native and accessible.
7. As a **screen-reader user**, I want a skip-to-content link, semantic landmarks (`<header>`, `<nav aria-label>`, `<main id="main">`, `<footer>`), and `aria-current="page"` on the active nav link, so that the page is navigable without sight.
8. As a **keyboard user**, I want tab order to flow logically (skip link → logo → nav → CTAs) and the mobile drawer to trap focus on open / restore on close, so that I can navigate without a mouse.
9. As a **visitor on a slow connection**, I want fonts to load with zero CLS, so that text doesn't reflow as I read.
10. As the **author of #296 (Anthropic Connectors Directory submission)**, I want `/claude-connector` to be a publicly-deployed URL the day A2 merges, so that the Directory listing can point at a stable address before A4 ships real content.
11. As a **search-engine crawler during the A2→A6 gap**, I want every page (including placeholders) to keep declaring `<meta robots noindex>`, so that "coming soon" pages don't pollute SERPs before SEO lands in A6.
12. As a **future ticket implementer (A3-A7)**, I want shadcn primitives (`Button`, `Card`, `Sheet`, `Badge`) available in `web/src/components/ui/`, so that I can build content with the same vocabulary as the SPA.
13. As a **visitor hitting a typo or stale link**, I want a polished `/404` page with sober "page not found" + home + Launch app CTAs, so that errors don't feel like dead ends.
14. As a **PR author touching `web/`**, I want the Vercel preview (already wired in A1) to render the new layout end-to-end across all 4 placeholder routes, so that I can validate visual changes before merging.
15. As the **solo dev**, I want ESLint to lint the new TSX/Astro files in `web/`, so that React-island bugs don't ship to production silently.

### Success measures


| Story # | Measure                                                                           |
| ------- | --------------------------------------------------------------------------------- |
| 7       | Lighthouse a11y score > 95 on mobile (any route)                                  |
| 9       | Cumulative Layout Shift (CLS) = 0 on production build (PageSpeed Insights mobile) |
| 14      | Vercel preview renders all 4 placeholder routes successfully on `web/`** PRs      |


Stories 1, 2, 3, 4, 5, 6, 8, 10, 11, 12, 13, 15 are validated qualitatively (visual review + manual a11y/keyboard test).

---

## Scope

**In scope:**

1. Extend `file:web/src/layouts/BaseLayout.astro`: skip-to-content link, semantic `<main id="main">`, header + footer composition, font preload links, body classes wired to tokens.
2. Add `@astrojs/react` integration to `file:web/astro.config.mjs` + deps (`react`, `react-dom`, `@radix-ui/react-dialog`, `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`).
3. Port shadcn primitives from `file:src/components/ui/` into `web/src/components/ui/{button,card,sheet,badge}.tsx` — copied verbatim, palette wired to A2 tokens.
4. `web/src/components/ui/README.md`: document the deliberate duplication trade-off and manual sync expectation.
5. `web/src/components/Header.astro`: sticky + backdrop-blur-on-scroll-past-8px (~6 lines of vanilla `<script>`), logo (Dumbbell from `lucide-static` stroke 2.25 + "GymLogic" wordmark in Geist Sans 18px semibold), 3 nav items (Claude connector / Blog / About), GitHub icon, "Launch app →" outline button, mobile hamburger trigger.
6. `web/src/components/MobileNav.tsx`: React island wrapping shadcn `Sheet` (slide-in from right, backdrop, focus trap, scroll lock — Radix Dialog defaults).
7. `web/src/components/Footer.astro`: two-column F2 layout — brand + tagline + © year on left; Project / Docs / Legal micro-link groups on right.
8. `web/src/components/Logo.astro`: composable mark + wordmark, accepts `size` prop, reused in header and footer.
9. `web/src/styles/global.css`: minimal token set exposed via Tailwind v4 `@theme` — `--color-bg`, `--color-fg`, `--color-muted`, `--color-accent`, `--color-accent-fg`, `--color-border`. Canonical teal `#00c9a7`. Dark-only — no `.light` class.
10. Self-host Geist Sans (weights 400/500/600) + Geist Mono (400) via the `geist` npm package: WOFF2 preload + `font-display: swap` + size-adjusted `Geist Fallback` system stack for zero CLS.
11. 4 placeholder routes using the new layout: `/` (home), `/claude-connector` (A4 anchor), `/blog` (A5), `/about` (A7). Each ~10-15 lines of Astro: sober "coming soon" h1 + 1-2 muted paragraphs + backlink to GitHub issue.
12. `web/src/pages/404.astro`: polished not-found page using the layout — "Page not found" heading, sober copy, links back to `/` and `https://gymlogic.me`.
13. A11y wiring: skip-to-content link, `aria-label` on header `<nav>` and footer `<nav>`, `aria-current="page"` derived from `Astro.url.pathname`, semantic landmarks throughout.
14. Microinteractions: 150ms color transitions on link hover, `active:scale-[0.98]` on buttons, shadcn Sheet motion defaults.
15. Preserve `<meta name="robots" content="noindex">` site-wide (A6 will flip).
16. ESLint setup for `web/`: lint configuration covering `.ts`, `.tsx`, `.astro` files; CI integration so `web/`-touching PRs fail on lint errors. Strategy (extend root vs standalone) decided in the Tech Plan.

**Out of scope (deferred):**

- Light mode tokens / theme toggle — door left open via semantic naming
- View Transitions API for page navigation — defer
- `/connectors/<name>` URL namespace — only relevant if a second connector lands
- Code highlighting / Shiki configuration — A4's problem
- Hero CTAs on placeholder pages — header + footer CTAs are sufficient (lighter touch confirmed)
- "Home" item in nav — logo carries it
- Custom logo SVG asset — `lucide-static` Dumbbell is canonical
- MDX integration / content collections → A4 (#302)
- Real home content (pitch, demo embed) → A3 (#301)
- Real connector docs content → A4 (#302)
- Real blog skeleton + RSS → A5 (#303)
- Sitemap, OG tags, analytics, removing `noindex` → A6 (#304)
- Real about page content → A7 (#305)
- Cross-domain `/privacy` mirror — `gymlogic.me/privacy` stays canonical
- Page transition animations beyond shadcn Sheet defaults

---

## Success Criteria

**Numeric / verifiable:**

- All 4 placeholder routes (`/`, `/claude-connector`, `/blog`, `/about`) plus `/404` deploy successfully and render the new layout
- Lighthouse a11y > 95 on any route (mobile)
- CLS = 0 on production build (PageSpeed Insights mobile)
- `<meta name="robots" content="noindex">` present on all 5 routes (verified via `curl | grep noindex`)
- Tailwind v4 `@theme` config exposes the 6 token vars; classes like `bg-bg`, `text-fg`, `text-muted`, `text-accent`, `border-border` resolve correctly in production CSS
- `web/src/components/ui/{button,card,sheet,badge}.tsx` exist and are visually consistent with their SPA twins
- Mobile drawer: opens, traps focus, restores focus on close, escapes on Esc, closes on backdrop click, locks body scroll while open
- ESLint runs against `web/` in CI and passes
- Existing A1 success criteria still hold: `https://docs.gymlogic.me` 200, root `npm run build` unchanged, SPA Vercel project untouched

**Qualitative:**

- Visual identity reads as "cousin / sober / typographic" — content-first, not the SPA's blur-and-card aesthetic
- Geist Sans renders as body/UI font with no FOUC (size-adjusted fallback hides the swap)
- Tab order flows logically through the header
- A visitor coming from `gymlogic.me` perceives brand continuity (Dumbbell mark, teal accent) without the site feeling like a clone
- Mobile drawer slide-in motion (from-right) feels polished, not janky
- Active nav link is visually obvious (color shift + thin underline + `aria-current`)

---

## References

- Parent epic: #298 — Astro mini-site (foundation publique pour ship & marketplace)
- This ticket: #300 — A2 Layout / nav / footer (shared design primitives)
- Sibling tickets:
  - #299 — A1 Bootstrap (shipped, foundation)
  - #301 — A3 Home page (consumer of A2)
  - #302 — A4 Doc connecteur Claude page (first real consumer of A2 + URL `/claude-connector`)
  - #303 — A5 Skeleton blog (consumer of A2)
  - #304 — A6 SEO + analytics (will remove `noindex`)
  - #305 — A7 About page (consumer of A2)
- Coupling reference: #296 (Anthropic Connectors Directory) — depends on `/claude-connector` URL being live
- A1 prior art: `file:docs/Epic_Brief_—_Bootstrap_Astro_Mini-Site_#299.md`, `file:docs/Tech_Plan_—_Astro_Bootstrap_#299.md`
- SPA design tokens: `file:src/styles/globals.css`
- SPA shadcn primitives: `file:src/components/ui/button.tsx`, `file:src/components/ui/card.tsx`, `file:src/components/ui/sheet.tsx`, `file:src/components/ui/badge.tsx`
- SPA marketing reference: `file:src/pages/AboutPage.tsx` (source of `#00c9a7` accent)
- A1 layout (to extend): `file:web/src/layouts/BaseLayout.astro`

