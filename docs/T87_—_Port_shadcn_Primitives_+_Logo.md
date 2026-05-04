# T87 — Port shadcn Primitives + Logo

## Goal

Port `Button`, `Card`, `Sheet`, `Badge` from the SPA into `web/src/components/ui/`, applying the SPA→A2 substitution table from the Tech Plan and trimming variants we don't use. Ship `Logo.astro` (Dumbbell mark + "GymLogic" wordmark) — used by both Header and Footer downstream. Document the duplication contract in `web/src/components/ui/README.md`.

**Mode**: AFK
**Slice**: 4 TSX components → ui/README → Logo.astro → visual smoke
**Addresses Epic Brief stories**: #2 (sober dark UI), #11 (shadcn primitives in `web/`)

## Dependencies

- **T86** (Foundation + CI Plumbing) — needs `@astrojs/react`, `@radix-ui/react-dialog`, `@radix-ui/react-slot`, `class-variance-authority`, `tw-animate-css`, `lucide-static`, `cn()` helper, and tokens in `global.css`.

## Scope

### 1. `web/src/components/ui/button.tsx`

Port from `file:src/components/ui/button.tsx`. Apply substitution table from Tech Plan §Data Model §2. Trim variants to `default`, `outline`, `ghost`. Keep all sizes (`default`, `sm`, `lg`, `icon`). Keep `asChild` prop.

Final variant block:

```tsx
variants: {
  variant: {
    default: 'bg-accent text-accent-foreground hover:bg-accent/90',
    outline: 'border border-border bg-background hover:bg-foreground/10',
    ghost: 'hover:bg-foreground/10 hover:text-foreground',
  },
  size: { /* unchanged from SPA */ },
}
```

### 2. `web/src/components/ui/card.tsx`

Port from `file:src/components/ui/card.tsx`. Single substitution: `text-card-foreground` → `text-foreground`. Keep `bg-card border shadow-xs`. Keep all sub-components (`CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`).

### 3. `web/src/components/ui/sheet.tsx`

Port from `file:src/components/ui/sheet.tsx`. Trim `sheetVariants.side` to `right` only. Apply substitutions:

| SPA class | A2 class |
|---|---|
| `bg-background` | `bg-background` (unchanged) |
| `data-[state=open]:bg-secondary` (close button hover) | `data-[state=open]:bg-foreground/10` |
| `ring-ring` | `ring-accent` |
| `ring-offset-background` | `ring-offset-background` (unchanged) |
| `text-foreground` (SheetTitle) | `text-foreground` (unchanged) |
| `text-muted-foreground` (SheetDescription) | `text-muted` |

Keep all `data-[state=open]:animate-in` / `slide-in-from-right` / `fade-in-0` classes — they depend on `tw-animate-css` (imported in T86).

### 4. `web/src/components/ui/badge.tsx`

Port from `file:src/components/ui/badge.tsx`. Trim variants to `default` and `outline`:

```tsx
variants: {
  variant: {
    default: 'border-transparent bg-accent text-accent-foreground hover:bg-accent/80',
    outline: 'text-foreground border-border',
  },
}
```

### 5. `web/src/components/ui/README.md`

Documents:

- The deliberate duplication trade-off (why these are not imported from the SPA)
- The full substitution table (copy from Tech Plan §Data Model §2)
- Manual sync expectations: "When SPA primitives evolve substantively, mirror the change here, applying the substitution table. Cosmetic-only SPA changes do NOT require sync."
- Variant trim notes: which variants are intentionally absent and which to add when downstream tickets need them.

### 6. `web/src/components/Logo.astro`

```astro
---
interface Props {
  size?: 'sm' | 'md'
}
const { size = 'md' } = Astro.props
const iconSize = size === 'sm' ? 24 : 32
const textCls = size === 'sm' ? 'text-base' : 'text-lg'
---

<span class="inline-flex items-center gap-2">
  <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2.25" stroke-linecap="round"
       stroke-linejoin="round" class="text-accent"
       aria-hidden="true">
    <!-- lucide Dumbbell path -->
    <path d="M14.4 14.4 9.6 9.6"/>
    <path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z"/>
    <path d="m21.5 21.5-1.4-1.4"/>
    <path d="M3.9 3.9 2.5 2.5"/>
    <path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z"/>
  </svg>
  <span class={`font-semibold tracking-tight text-foreground ${textCls}`}>GymLogic</span>
</span>
```

The Dumbbell SVG path is sourced from `lucide-static` (you can either inline it as above for zero-import simplicity, or import via `lucide-static/icons/dumbbell.svg?raw` — implementer judgement, both are acceptable).

## Out of Scope

- Header that consumes Logo + Button → T88
- Footer that consumes Logo → T90
- MobileNav that consumes Sheet + Button → T89
- BaseLayout integration → T91
- A "components showcase" route — not shipped, just visual smoke during implementation

## Acceptance Criteria

- [ ] All four files exist: `web/src/components/ui/{button,card,sheet,badge}.tsx`
- [ ] `cd web && npx astro check` passes — no type errors on the ported components
- [ ] Substitution table audit: ripgrep `web/src/components/ui/` for any of `bg-primary`, `bg-secondary`, `bg-destructive`, `text-card-foreground`, `text-muted-foreground`, `border-input`, `ring-ring` returns **zero results**
- [ ] Button has exactly 3 variants (`default`, `outline`, `ghost`) and 4 sizes (`default`, `sm`, `lg`, `icon`)
- [ ] Sheet has exactly 1 side variant (`right`)
- [ ] Badge has exactly 2 variants (`default`, `outline`)
- [ ] `web/src/components/Logo.astro` exists with `sm` (24px icon) and `md` (32px icon) sizes
- [ ] Logo Dumbbell renders with `text-accent` (teal) and "GymLogic" wordmark in semibold Geist
- [ ] `web/src/components/ui/README.md` exists and documents the duplication contract + substitution table
- [ ] Root `npm run lint` passes (note: `react-refresh/only-export-components` is exempted on `web/src/components/ui/**` per T86's ESLint update)
- [ ] (Optional dev-only smoke) drop a temporary `web/src/pages/_smoke.astro` that imports all 4 primitives + Logo, verify they render with correct A2 styling, then **delete before merging**

## References

- Epic Brief: `file:docs/Epic_Brief_—_A2_Layout_Nav_Footer_#300.md`
- Tech Plan: `file:docs/Tech_Plan_—_A2_Layout_Nav_Footer_#300.md` (Key Decisions, Data Model §2 substitution table, Component Responsibilities for Button/Card/Sheet/Badge)
- SPA primitive sources:
  - `file:src/components/ui/button.tsx`
  - `file:src/components/ui/card.tsx`
  - `file:src/components/ui/sheet.tsx`
  - `file:src/components/ui/badge.tsx`
- SPA `cn()` helper (already ported in T86): `file:src/lib/utils.ts`
