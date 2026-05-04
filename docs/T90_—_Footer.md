# T90 — Footer

## Goal

Build `Footer.astro` — the F2 two-column footer locked in the design grilling. Left column: small Logo + tagline + © year. Right column: three vertical micro-link groups (`Project` / `Docs` / `Legal`). Anchors include the second canonical "Launch app" CTA, GitHub link, and the cross-domain Privacy link to `gymlogic.me/privacy`.

**Mode**: AFK
**Slice**: Astro component → token-based styling → cross-domain links
**Addresses Epic Brief stories**: #4 (Launch app CTA also lives in footer)

## Dependencies

- **T86** (Foundation + CI Plumbing) — tokens, fonts, lint/type-check gates
- **T87** (Port shadcn Primitives + Logo) — uses `Logo.astro` at `size="sm"`

## Scope

### 1. `web/src/components/Footer.astro`

```astro
---
import Logo from './Logo.astro'

const year = new Date().getFullYear()

const groups = [
  {
    label: 'Project',
    links: [
      { href: 'https://github.com/PierreTsia/workout-app', label: 'GitHub', external: true },
      { href: 'https://gymlogic.me', label: 'Launch app', external: true },
    ],
  },
  {
    label: 'Docs',
    links: [
      { href: '/claude-connector', label: 'Claude connector', external: false },
      { href: '/blog', label: 'Blog', external: false },
      { href: '/about', label: 'About', external: false },
    ],
  },
  {
    label: 'Legal',
    links: [
      { href: 'https://gymlogic.me/privacy', label: 'Privacy', external: true },
    ],
  },
]
---

<footer class="border-t border-border mt-24 py-12">
  <div class="mx-auto max-w-3xl px-4">
    <div class="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
      <div class="flex flex-col gap-3 md:max-w-xs">
        <Logo size="sm" />
        <p class="text-sm text-muted leading-relaxed">
          Workout app + AI coaching, public craft surface.
        </p>
        <p class="text-xs text-muted">© {year} Pierre Tsiakkaros</p>
      </div>

      <nav aria-label="Footer" class="grid grid-cols-3 gap-8 text-sm">
        {groups.map(({ label, links }) => (
          <div class="flex flex-col gap-3">
            <h2 class="text-xs uppercase tracking-wider text-muted/80">{label}</h2>
            <ul class="flex flex-col gap-2">
              {links.map(({ href, label: linkLabel, external }) => (
                <li>
                  <a
                    href={href}
                    target={external ? '_blank' : undefined}
                    rel={external ? 'noopener noreferrer' : undefined}
                    class="text-muted hover:text-foreground transition-colors duration-150"
                  >
                    {linkLabel}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  </div>
</footer>
```

### 2. Responsive behavior

- **Desktop (≥md)**: brand left, 3-col link grid right, both top-aligned
- **Mobile (<md)**: stacked vertically — brand block first, then nav grid (kept as 3 columns to preserve density; if too tight on small screens, implementer may switch to `grid-cols-2` and document the choice in PR)

### 3. Hover treatment

Match Header's link treatment for consistency: `text-muted hover:text-foreground transition-colors duration-150`.

## Out of Scope

- BaseLayout integration → T91
- Newsletter signup / social icons / sitemap link / language switcher — none of these are in scope (out-of-scope per Brief)
- Animations beyond color transitions

## Acceptance Criteria

- [ ] `web/src/components/Footer.astro` exists, accepts no props, type-checks via `astro check`
- [ ] Desktop layout: brand block (Logo + tagline + ©) on left, 3-column link grid (Project / Docs / Legal) on right
- [ ] Mobile layout: brand stacked above link grid; link grid remains visible and tappable
- [ ] Logo renders at `size="sm"` (24px Dumbbell)
- [ ] © year is dynamic — uses `new Date().getFullYear()`, NOT a hardcoded string
- [ ] All anchor `href`s match the Tech Plan: GitHub → `https://github.com/PierreTsia/workout-app`, Launch app → `https://gymlogic.me`, Privacy → `https://gymlogic.me/privacy`, internal links to `/claude-connector` / `/blog` / `/about`
- [ ] All external links have `target="_blank"` AND `rel="noopener noreferrer"`
- [ ] Internal links have neither `target` nor `rel`
- [ ] Footer is wrapped in semantic `<footer>` element; the link region uses `<nav aria-label="Footer">`
- [ ] Group labels (`Project`, `Docs`, `Legal`) are rendered as `<h2>` for landmark structure (visually small uppercase, but semantically headings)
- [ ] All links have visible focus ring on `:focus-visible`
- [ ] Tab order: brand link (Logo if linked, else first internal anchor) → Project group top-to-bottom → Docs group top-to-bottom → Legal group top-to-bottom
- [ ] Root `npm run lint` and `cd web && npx astro check` pass
- [ ] Lighthouse a11y on a temp page wrapping `<Footer />` scores > 95 (formal verification deferred to T91)

## References

- Epic Brief: `file:docs/Epic_Brief_—_A2_Layout_Nav_Footer_#300.md`
- Tech Plan: `file:docs/Tech_Plan_—_A2_Layout_Nav_Footer_#300.md` (Component Responsibilities for `Footer.astro`)
- Logo from T87: `web/src/components/Logo.astro`
