# `web/src/components/ui/` — shadcn primitives, ported

These are local copies of the SPA's shadcn primitives at `src/components/ui/`,
rewired to the Astro mini-site's 7-token design system. **Do not import from
`@/components/ui/` paths that resolve to the SPA root** — Astro's path alias
`@/*` points at `web/src/*`.

## Why duplicate?

The SPA and the docs site live in the same repo but are two separate projects
with two separate token sets:

- SPA: 30+ semantic tokens (`primary`, `secondary`, `destructive`, `popover`,
  `input`, `card-foreground`, …) defined in `src/styles/globals.css`
- A2 docs: a deliberately minimal 7-token system in `web/src/styles/global.css`
  (`background`, `foreground`, `muted`, `accent`, `accent-foreground`, `border`,
  `card`)

Keeping a local copy lets us evolve token vocabularies independently without
shimming missing tokens or risking subtle visual regressions when the SPA's
shadcn library is updated.

## Substitution table (SPA → A2)

When porting a primitive verbatim, rewire these classes:

| SPA class                              | A2 class                                     |
| -------------------------------------- | -------------------------------------------- |
| `bg-primary` / `text-primary-foreground` | `bg-accent` / `text-accent-foreground`     |
| `bg-secondary` / `text-secondary-foreground` | `bg-foreground/10` / `text-foreground` |
| `bg-secondary/80`                      | `bg-foreground/10` (no separate hover state)  |
| `data-[state=open]:bg-secondary`       | `data-[state=open]:bg-foreground/10`          |
| `bg-popover` / `text-popover-foreground` | `bg-card` / `text-foreground`              |
| `bg-card text-card-foreground`         | `bg-card text-foreground`                    |
| `border-input`                         | `border-border` (or just `border`, see below) |
| `ring-ring` / `focus-visible:ring-ring` | `ring-accent` / `focus-visible:ring-accent` |
| `text-muted-foreground`                | `text-muted`                                  |
| `hover:bg-accent hover:text-accent-foreground` | `hover:bg-foreground/10 hover:text-foreground` (NB: SPA's "accent" is a neutral grey; ours is the brand teal — preserving this would tint outline/ghost buttons brand-teal on hover, wrong) |

Variants we explicitly **drop** (not used by A2 marketing pages):

- Button: `destructive`, `secondary`, `lg`
- Badge: `secondary`, `destructive`

## Default border color

`global.css` sets `* { border-color: var(--color-border) }` in `@layer base`,
so bare `border`, `border-b`, `border-l`, etc. resolve to `--color-border`
without needing `border-border` everywhere. Same pattern as the SPA.

## Keeping in sync (manual)

These primitives are stable enough that drift is unlikely to bite us. If the
SPA's primitive bug-fixes a behavior (rare, but it happens), the procedure is:

1. `diff src/components/ui/<file>.tsx web/src/components/ui/<file>.tsx`
2. Apply the upstream fix verbatim
3. Re-apply the substitution table above to any new lines

There is no automated sync. The A2 surface is small (Header, Footer, MobileNav,
4 placeholder pages), so when this becomes painful we'll know.

## React inside Astro

These are React components, used either:

- Statically in `.astro` files (rendered to HTML at build time, **no JS shipped**)
- As client islands via `client:load` directive (e.g. `MobileNav.tsx`)

The `'use client'` SPA pragma is dropped — Astro doesn't use it.
