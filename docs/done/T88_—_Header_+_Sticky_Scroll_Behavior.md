# T88 — Header + Sticky Scroll Behavior

## Goal

Build `Header.astro` — sticky top-of-page header with Logo on the left, three desktop nav links (Claude connector / Blog / About), GitHub icon link and "Launch app →" outline button on the right. Vanilla `<script>` toggles a `data-scrolled` attribute past 8px scroll, driving Tailwind v4's `data-[scrolled=true]:` selector for backdrop blur + translucent background. `aria-current="page"` is computed from `Astro.url.pathname` and drives both a11y and visual active-link state. Mobile trigger is stubbed for T89 to replace.

**Mode**: AFK
**Slice**: Astro component → vanilla scroll script → desktop nav → a11y wiring → mobile trigger stub
**Addresses Epic Brief stories**: #4 (Launch app CTA in header), #5 (GitHub icon), #7 (active-link `aria-current` portion), #8 (tab order portion)

## Dependencies

- **T86** (Foundation + CI Plumbing) — tokens, fonts, CI gates
- **T87** (Port shadcn Primitives + Logo) — uses `Logo.astro` and `Button` (outline variant)

## Scope

### 1. `web/src/components/Header.astro`

Outer element:

```astro
<header
  id="site-header"
  class="sticky top-0 z-40 transition-colors duration-200
         data-[scrolled=true]:bg-background/70
         data-[scrolled=true]:backdrop-blur-md
         data-[scrolled=true]:border-b
         data-[scrolled=true]:border-border/50"
>
  <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
    <!-- left: logo, center: nav, right: ctas + mobile trigger -->
  </div>
</header>
```

### 2. Logo + nav

- Left: `<a href="/" aria-label="GymLogic — home"><Logo size="md" /></a>`
- Center-right: `<nav aria-label="Primary" class="hidden md:flex md:gap-6">` with three links

```astro
---
const links = [
  { href: '/claude-connector', label: 'Claude connector' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
]

const normalize = (p: string) => p.replace(/\/$/, '') || '/'
const currentPath = normalize(Astro.url.pathname)
const isActive = (href: string) =>
  currentPath === href || (href !== '/' && currentPath.startsWith(href))
---

<nav aria-label="Primary" class="hidden md:flex md:gap-6">
  {links.map(({ href, label }) => (
    <a
      href={href}
      aria-current={isActive(href) ? 'page' : undefined}
      class="text-muted hover:text-foreground transition-colors duration-150
             data-[aria-current=page]:text-foreground
             data-[aria-current=page]:underline
             data-[aria-current=page]:underline-offset-8
             data-[aria-current=page]:decoration-1"
    >
      {label}
    </a>
  ))}
</nav>
```

### 3. Right side — GitHub icon + Launch CTA + mobile trigger stub

```astro
<div class="flex items-center gap-2">
  <a
    href="https://github.com/PierreTsia/workout-app"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="GymLogic on GitHub"
    class="hidden md:inline-flex p-2 rounded-md text-muted hover:text-foreground hover:bg-foreground/10 transition-colors"
  >
    <!-- lucide-static github SVG, 20px -->
  </a>

  <Button variant="outline" size="sm" class="hidden md:inline-flex" asChild>
    <a href="https://gymlogic.me" target="_blank" rel="noopener noreferrer">
      Launch app →
    </a>
  </Button>

  <!-- Mobile trigger stub — replaced by T89's <MobileNav> -->
  <button
    type="button"
    class="md:hidden p-2 rounded-md text-foreground hover:bg-foreground/10"
    aria-label="Open menu (TODO T89)"
    disabled
  >
    <!-- lucide-static menu SVG, 20px -->
  </button>
</div>
```

The stub is intentionally a `disabled` button so it's visible during T88 review but does nothing — T89 replaces this whole element with `<MobileNav client:load currentPath={currentPath} />`.

### 4. Inline `<script>` for scroll-driven backdrop

```astro
<script>
  const header = document.getElementById('site-header')
  if (header) {
    const onScroll = () => {
      header.dataset.scrolled = window.scrollY > 8 ? 'true' : 'false'
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
  }
</script>
```

Astro's default `is:inline` behavior keeps this as a vanilla browser script, no module bundling overhead.

## Out of Scope

- `MobileNav.tsx` React island and replacing the trigger stub → **T89**
- `Footer.astro` → **T90**
- `BaseLayout.astro` extension wiring Header → `<main>` → Footer → **T91**
- Placeholder route content → **T91**
- Any actual content in `<main>` (this ticket ships only the chrome head)

## Acceptance Criteria

- [ ] `web/src/components/Header.astro` exists, accepts no props, type-checks via `astro check`
- [ ] Desktop view (≥768px): Logo on left, 3 nav links centered (Claude connector / Blog / About), GitHub icon + "Launch app →" outline button on right
- [ ] Below `md:` breakpoint: nav links and right-side CTAs hide, mobile trigger stub is visible (disabled, says "Open menu (TODO T89)")
- [ ] Visiting `/claude-connector` (manually, via direct URL) renders the "Claude connector" nav link with `aria-current="page"` AND visual treatment (color shift to `text-foreground` + thin underline at 8px offset)
- [ ] Other nav links remain `text-muted` (no underline) when not active
- [ ] Scrolling past 8px adds `data-scrolled="true"` to `<header id="site-header">` — verifiable via DevTools inspection
- [ ] When `data-scrolled="true"`: header has translucent bg (`bg-background/70`), backdrop blur, and 1px bottom border at 50% opacity
- [ ] Scrolling back to 0 cleanly removes `data-scrolled` and the backdrop styling (no flicker)
- [ ] Tab order on desktop: Logo link → Claude connector → Blog → About → GitHub link → Launch app button → (stub trigger, disabled — skipped)
- [ ] All focusable elements have visible focus ring matching `:focus-visible` from `global.css` (2px outline, accent color, 2px offset)
- [ ] No console errors in the browser when scrolling
- [ ] Root `npm run lint` and `cd web && npx astro check` both pass
- [ ] Lighthouse a11y on a temp page wrapping `<Header />` scores > 95 (formal verification deferred to T91)

## References

- Epic Brief: `file:docs/Epic_Brief_—_A2_Layout_Nav_Footer_#300.md`
- Tech Plan: `file:docs/Tech_Plan_—_A2_Layout_Nav_Footer_#300.md` (Component Responsibilities for `Header.astro`, Implementation Notes on `aria-current` and `Astro.url.pathname` normalization)
- SPA marketing reference for nav vibe: `file:src/pages/AboutPage.tsx`
