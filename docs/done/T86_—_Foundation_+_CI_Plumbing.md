# T86 — Foundation + CI Plumbing

## Goal

Set up the toolbox A2 needs end-to-end: install all React/font/primitive deps, wire `@astrojs/react`, define the 7-token color system + Geist Sans/Mono in `web/src/styles/global.css`, ship `cn()` helper, drop `web/**` from root ESLint `globalIgnores`, and add a paths-filtered `web-type-check` CI job (gated into `web-checks-passed`). After this ticket, every downstream ticket has tokens, fonts, primitives' dependencies, lint, and type-check available.

**Mode**: AFK
**Slice**: deps → tokens → fonts → `cn()` → root ESLint config → CI workflow
**Addresses Epic Brief stories**: #2 (sober dark UI baseline), #9 (zero-CLS fonts), #15 (ESLint covers `web/`)

## Dependencies

None — this is the root of the A2 dependency graph.

## Scope

### 1. Web package deps

Add to `web/package.json` `dependencies` (or `devDependencies` where appropriate per package convention):

| Package | Why |
|---|---|
| `@astrojs/react` | React integration for Astro |
| `@astrojs/check` | `astro check` typechecker (CI job) |
| `react`, `react-dom` | shadcn primitive runtime |
| `@types/react`, `@types/react-dom` | dev typings |
| `@radix-ui/react-dialog` | base for ported `Sheet` (next ticket) |
| `@radix-ui/react-slot` | base for ported `Button` `asChild` |
| `class-variance-authority` | CVA for Button/Sheet/Badge variants |
| `clsx` | classnames helper used by `cn()` |
| `tailwind-merge` | de-duping helper used by `cn()` |
| `tw-animate-css` | provides `animate-in`/`slide-in-from-right` utilities Sheet depends on |
| `lucide-static` | server-rendered SVG for static icons (Logo Dumbbell, GitHub) |
| `lucide-react` | only used by the React `MobileNav` island (next ticket) |
| `@fontsource-variable/geist` | self-hosted Geist Sans variable WOFF2 |
| `@fontsource-variable/geist-mono` | self-hosted Geist Mono variable WOFF2 |

### 2. `web/astro.config.mjs`

Add the React integration:

```js
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'

export default defineConfig({
  output: 'static',
  site: 'https://docs.gymlogic.me',
  integrations: [react()],
})
```

Keep the existing comment about `@tailwindcss/vite` and `withastro/astro#16542`.

### 3. `web/tsconfig.json`

Add path alias to match SPA convention used by ported components:

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### 4. `web/src/styles/global.css`

Replace the current single `@import "tailwindcss"` with:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "@fontsource-variable/geist";
@import "@fontsource-variable/geist-mono";

@source './**/*.{astro,tsx,ts}';

@theme {
  --color-background: #0f0f13;
  --color-foreground: #f2f2f2;
  --color-muted: #999999;
  --color-accent: #00c9a7;
  --color-accent-foreground: #000000;
  --color-border: #2d2d37;
  --color-card: #1a1a22;

  --font-sans: 'Geist Variable', 'Geist Fallback', system-ui, sans-serif;
  --font-mono: 'Geist Mono Variable', ui-monospace, 'SF Mono', monospace;

  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
}

@font-face {
  font-family: 'Geist Fallback';
  src: local('Arial');
  size-adjust: 105%;
  ascent-override: 95%;
  descent-override: 22%;
  line-gap-override: 0%;
}

@layer base {
  body {
    @apply bg-background text-foreground font-sans antialiased;
  }
  :focus-visible {
    @apply outline-2 outline-offset-2 outline-accent;
  }
}
```

Order is load-bearing: Tailwind first, `tw-animate-css` second, Geist imports third, then `@source`, then `@theme`, then fallback `@font-face`, then base layer.

### 5. `web/src/lib/utils.ts`

Copy `cn()` from `file:src/lib/utils.ts` minus `groupBy()`:

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### 6. Root `file:eslint.config.js`

Two changes:

**a)** Drop `web/**` from `globalIgnores`, replace with narrower ignores:

```js
globalIgnores(['dist', 'web/dist', 'web/.astro'])
```

**b)** Mirror the SPA's `react-refresh` exemption to cover `web/src/components/ui/**`:

```js
{
  files: [
    'src/components/ui/**/*.{ts,tsx}',
    'web/src/components/ui/**/*.{ts,tsx}',
  ],
  rules: {
    'react-refresh/only-export-components': 'off',
  },
},
```

### 7. `file:.github/workflows/ci.yml`

Add a new `web-type-check` job after `changes`:

```yaml
web-type-check:
  needs: [changes]
  if: needs.changes.outputs.web == 'true'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: lts/*
        cache: npm
    - run: cd web && npm ci
    - run: cd web && npx astro check
```

Update `web-checks-passed` to depend on it AND require both checks to be `success` or `skipped`:

```yaml
web-checks-passed:
  needs: [changes, preview-deploy-web, web-type-check]
  if: always() && github.event_name == 'pull_request'
  runs-on: ubuntu-latest
  steps:
    - name: Verify web checks
      run: |
        preview="${{ needs.preview-deploy-web.result }}"
        types="${{ needs.web-type-check.result }}"
        echo "preview-deploy-web: $preview"
        echo "web-type-check: $types"
        if [[ ("$preview" == "success" || "$preview" == "skipped") && \
              ("$types"   == "success" || "$types"   == "skipped") ]]; then
          exit 0
        else
          exit 1
        fi
```

## Out of Scope

- Shadcn primitive ports → T87
- Logo, Header, Footer, MobileNav components → T87, T88, T89, T90
- BaseLayout extension and placeholder routes → T91
- Vercel project / domain / branch protection → already done in A1
- Removing the `noindex` meta → A6

## Acceptance Criteria

- [ ] `cd web && npm install` completes successfully with all listed deps installed
- [ ] `cd web && npm run dev` starts without errors and serves `index.astro`
- [ ] `cd web && npm run build` produces a `dist/` containing the index page and bundled Geist WOFF2
- [ ] `cd web && npx astro check` exits 0 on a clean tree
- [ ] Existing `web/src/pages/index.astro` renders with Geist Sans (visible inspection in dev mode — body text is not Helvetica/Arial)
- [ ] `@theme` exposes the 7 color tokens; `bg-background`, `text-foreground`, `text-muted`, `text-accent`, `bg-card`, `border-border`, `bg-accent-foreground` all resolve to non-empty CSS in production build
- [ ] Root `npm run lint` succeeds with `web/**` no longer in `globalIgnores` (ESLint's TS/TSX glob now scans `web/src/**/*.tsx` — currently 0 files, so passes trivially)
- [ ] CI: PR with a `web/**` change triggers `web-type-check` and it succeeds
- [ ] CI: PR with no `web/**` change shows `web-type-check` as `skipped` and `web-checks-passed` as `success` (no PR block)
- [ ] CI: A simulated `astro check` failure (e.g., temporary type error in `index.astro`) blocks `web-checks-passed`
- [ ] Root `npm run build` byte-identical (or within 2%) to pre-T86 baseline — SPA bundle untouched

## References

- Epic Brief: `file:docs/Epic_Brief_—_A2_Layout_Nav_Footer_#300.md`
- Tech Plan: `file:docs/Tech_Plan_—_A2_Layout_Nav_Footer_#300.md` (Key Decisions, Data Model §1, New Files & Responsibilities)
- A1 Tech Plan (CI structure inspiration): `file:docs/Tech_Plan_—_Astro_Bootstrap_#299.md`
- Existing root ESLint config: `file:eslint.config.js`
- Existing CI: `file:.github/workflows/ci.yml`
- SPA `cn()` helper source: `file:src/lib/utils.ts`
