# T89 — MobileNav React Island

## Goal

Build `MobileNav.tsx` — the only React island in the chrome — wrapping the ported shadcn `Sheet` to deliver a polished slide-in-from-right drawer with focus trap, scroll lock, escape-to-close, click-outside-to-close, and link-click-closes-drawer behavior. Replace the disabled mobile trigger stub from T88 with `<MobileNav client:load currentPath={...} />`.

**Mode**: AFK
**Slice**: React island → Sheet usage → controlled state → integration into Header
**Addresses Epic Brief stories**: #6 (mobile drawer with focus trap, scroll lock, etc.), #8 (drawer focus management portion)

## Dependencies

- **T86** (Foundation + CI Plumbing) — `@astrojs/react`, `@radix-ui/react-dialog`, `lucide-react`, `cn()`
- **T87** (Port shadcn Primitives + Logo) — uses `Sheet` and `Button`
- **T88** (Header) — replaces the trigger stub with this component

## Scope

### 1. `web/src/components/MobileNav.tsx`

```tsx
import { useState } from 'react'
import { Menu, X, Github } from 'lucide-react'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

interface MobileNavProps {
  currentPath: string
}

const links = [
  { href: '/claude-connector', label: 'Claude connector' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
]

export function MobileNav({ currentPath }: MobileNavProps) {
  const [open, setOpen] = useState(false)

  const isActive = (href: string) =>
    currentPath === href || (href !== '/' && currentPath.startsWith(href))

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation menu"
          className="md:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex flex-col gap-6 bg-background"
      >
        {/* SR-only title + description for Radix Dialog a11y */}
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">
          Site navigation links and external CTAs
        </SheetDescription>

        <nav aria-label="Mobile primary" className="mt-8 flex flex-col gap-4">
          {links.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              onClick={() => setOpen(false)}
              className="text-lg text-muted hover:text-foreground transition-colors data-[aria-current=page]:text-foreground data-[aria-current=page]:underline data-[aria-current=page]:underline-offset-8"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3 border-t border-border pt-6">
          <a
            href="https://github.com/PierreTsia/workout-app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-muted hover:text-foreground"
            onClick={() => setOpen(false)}
          >
            <Github className="h-4 w-4" /> GitHub
          </a>
          <Button variant="outline" asChild>
            <a
              href="https://gymlogic.me"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
            >
              Launch app →
            </a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

Key behaviors covered by `Sheet` (Radix Dialog) for free:

- Focus trap inside drawer
- Restore focus to trigger on close
- Escape key closes
- Click-outside (overlay) closes
- Body scroll lock while open
- `aria-modal`, `role="dialog"`, label associations

### 2. Modify `web/src/components/Header.astro`

Replace the disabled stub from T88:

```astro
<!-- before (T88 stub) -->
<button type="button" class="md:hidden ..." disabled>...</button>

<!-- after (this ticket) -->
import { MobileNav } from './MobileNav'
...
<MobileNav client:load currentPath={currentPath} />
```

The `currentPath` value is the normalized `Astro.url.pathname` already computed in `Header.astro` for the desktop nav active state.

## Out of Scope

- Footer → T90
- BaseLayout integration / placeholder routes → T91
- Optional error boundary fallback (degraded inline anchor list) — defer unless Lighthouse audit flags issues
- Sheet animation customization — accept shadcn defaults via `tw-animate-css`
- Any non-mobile drawer features (search, command palette, etc.)

## Acceptance Criteria

- [ ] `web/src/components/MobileNav.tsx` exists, type-checks via `astro check`, lints clean
- [ ] `Header.astro` imports `MobileNav` and renders it with `client:load` and `currentPath={currentPath}`
- [ ] On mobile viewport (<768px): tapping the hamburger icon opens the drawer with a slide-in-from-right animation and a backdrop fade
- [ ] Drawer renders 3 nav links + GitHub link + "Launch app →" Button, in the order specified
- [ ] Pressing `Escape` closes the drawer
- [ ] Clicking the overlay (outside drawer content) closes the drawer
- [ ] Clicking the X close button (Radix default, top-right of drawer) closes the drawer
- [ ] Clicking a nav link closes the drawer AND navigates to the target route (verify on `/about` from `/`)
- [ ] Active link in drawer (e.g., on `/blog`) has `aria-current="page"` and visual highlight (color shift + underline)
- [ ] Tab cycles inside the drawer — focus does not escape to elements behind the overlay
- [ ] On close, focus returns to the hamburger trigger button
- [ ] Body scroll is locked while drawer is open (test on iOS Safari simulator or real device — Radix handles this)
- [ ] No console errors during open/close cycle
- [ ] Hydrated client bundle for the route delivers ≤ ~40KB gzipped React + ReactDOM + Radix Dialog + the component (one-time check via `vite build` size report or browser network tab)
- [ ] Lighthouse a11y on a route using the chrome scores > 95 (formal verification deferred to T91)

## References

- Epic Brief: `file:docs/Epic_Brief_—_A2_Layout_Nav_Footer_#300.md`
- Tech Plan: `file:docs/Tech_Plan_—_A2_Layout_Nav_Footer_#300.md` (Component Responsibilities for `MobileNav.tsx`, Implementation Notes on Sheet controlled state, Failure Mode Analysis on Sheet's controlled-state link-click-close)
- Ported Sheet primitive: `web/src/components/ui/sheet.tsx` (from T87)
- SPA Sheet source for reference: `file:src/components/ui/sheet.tsx`
