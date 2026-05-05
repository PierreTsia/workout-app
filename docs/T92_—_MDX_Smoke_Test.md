# T92 — MDX × Astro 6 Smoke Test (A4 hard gate)

## Goal

The "is the toolchain even usable?" gate for A4. Install the three new dependencies (`@astrojs/mdx`, `@astrojs/sitemap`, `@tailwindcss/typography`), wire them minimally into `web/astro.config.mjs`, drop a 5-line stub MDX behind a stub dynamic route, and verify that **both `npm run build` AND `npx astro check` pass locally**. If either fails, A4 stops here — no content authoring proceeds — and the implementer either pins Astro 5.x in `web/` only, files an upstream issue, or escalates. The cost of staging this as commit 1 of the A4 PR is one short commit; the cost of NOT staging it is potentially reverting 5 commits of dependent work.

**Mode**: AFK
**Slice**: deps install → minimal `astro.config.mjs` wiring → stub `content.config.ts` → stub `_smoke.mdx` → stub `[slug].astro` → `npm run build` + `astro check` pass
**Addresses Epic Brief stories**: prerequisite for #1, #14, #15 (no story is satisfiable until MDX is verified compatible)
**Position in A4 PR**: commit 1 of 5

## Dependencies

- **T91** (BaseLayout + 5 Routes) — already shipped; `BaseLayout.astro` exists for the stub route to import
- A2 CI: `web-type-check` job (already wired) provides the `astro check` gate downstream
- Workspace rule: `file:.cursor/rules/build-sandbox-caveat.mdc` — `npm run build` MUST be run with `required_permissions: ["all"]` because `workbox-build` uses `worker_threads` via terser, which the Cursor sandbox blocks

## Scope

### 1. Install dependencies (`web/package.json`)

Pin to versions compatible with Astro 6.2.x. As of writing, the candidates are:

| Package | Target version |
|---|---|
| `@astrojs/mdx` | latest `^4.x` (or whatever current stable maps to Astro 6) |
| `@astrojs/sitemap` | latest `^4.x` |
| `@tailwindcss/typography` | latest `^0.5.x` |

Run from `web/`:

```bash
npm install --save @astrojs/mdx @astrojs/sitemap @tailwindcss/typography
```

If npm resolves an older version due to Astro peer-dep constraints, accept that — the goal is "compatible", not "latest". Document the resolved versions in the commit message.

### 2. Wire integrations in `file:web/astro.config.mjs`

Add minimal configuration — full sitemap filter, redirects, and Shiki theming come in T93/T94. For T92, just prove the integrations load:

```js
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  // ... existing config ...
  integrations: [react(), mdx(), sitemap()],
})
```

`@tailwindcss/typography` is registered via the `@plugin` CSS directive in T93 (not in `astro.config.mjs`). For T92, the package is installed but not yet imported anywhere — that's fine; the smoke test only needs build + check to succeed.

### 3. Stub content collection schema (`web/src/content.config.ts`)

Minimal placeholder schema — the real Zod definition lands in T93:

```ts
import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const connect = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/connect' }),
  schema: z.object({
    title: z.string(),
  }),
})

export const collections = { connect }
```

### 4. Stub MDX file (`web/src/content/connect/_smoke.mdx`)

Five lines, no frills. Underscore prefix per Astro convention to signal "intentionally placeholder, will be deleted":

```mdx
---
title: Smoke test
---

# Smoke test passed if you can read this.
```

### 5. Stub dynamic route (`web/src/pages/connect/[slug].astro`)

Minimal scaffold — full hero/MDX-component injection lands in T93:

```astro
---
import { getCollection, render } from 'astro:content'
import BaseLayout from '@/layouts/BaseLayout.astro'

export async function getStaticPaths() {
  const entries = await getCollection('connect')
  return entries.map((entry) => ({ params: { slug: entry.id }, props: { entry } }))
}

const { entry } = Astro.props
const { Content } = await render(entry)
---

<BaseLayout title={entry.data.title}>
  <article class="mx-auto max-w-3xl px-4 py-12">
    <Content />
  </article>
</BaseLayout>
```

### 6. Verify

Run from `web/`:

```bash
npm run build      # MUST run with required_permissions: ["all"] in Cursor
npx tsc --noEmit   # quick TS check (sandbox-safe)
npx astro check    # full astro check (sandbox-safe)
```

Expected: all three commands exit 0. Expected stub URL: `/connect/_smoke` renders the H1.

If `npm run build` fails:
- Capture the full error output in the PR description (or commit message follow-up)
- Diagnose: is it `@astrojs/mdx` (likely culprit), `@astrojs/sitemap`, or `@tailwindcss/typography`?
- Decide: pin Astro 5.x in `web/` only (separate `package.json`), file upstream, or block A4
- **Do not proceed to T93 until this passes**

### 7. Cleanup before commit

- Confirm `_smoke.mdx` and the stub `[slug].astro` are committed (they're scaffolding the next ticket; T93 replaces both)
- Stub `content.config.ts` is committed as-is; T93 expands the schema
- Commit message: `feat(web): smoke-test MDX + sitemap + typography integration on Astro 6`

## Out of Scope

- Real content collection schema (full Zod definition with `hero`, `available`, `ogImage`, etc.) — owned by **T93**
- Sitemap filter callback — owned by **T94**
- Shiki theme configuration in `astro.config.mjs` — owned by **T93**
- `redirects` map in `astro.config.mjs` — owned by **T94**
- `@plugin "@tailwindcss/typography"` registration in `global.css` — owned by **T93**
- Real `claude.mdx` content, screenshots, or any user-facing prose — owned by **T93** (stub) and **T95** (real)
- Custom MDX components (`Callout`, `TechHeavy`, `ComingSoon`, `Screenshot`) — owned by **T93**
- BaseLayout SEO props (`indexable`, `canonical`, `ogImage`) — owned by **T94**
- `robots.txt`, OG card, redirect, header/footer URL surgery — owned by later tickets in the PR

## Acceptance Criteria

- [ ] `web/package.json` declares `@astrojs/mdx`, `@astrojs/sitemap`, `@tailwindcss/typography` as dependencies, with versions resolvable against Astro 6.2.x
- [ ] `web/astro.config.mjs` imports and registers `mdx()` and `sitemap()` in the `integrations` array
- [ ] `web/src/content.config.ts` exists with a minimal `connect` collection definition
- [ ] `web/src/content/connect/_smoke.mdx` exists and contains valid frontmatter + an H1
- [ ] `web/src/pages/connect/[slug].astro` exists and renders the MDX `<Content />` inside `BaseLayout`
- [ ] `cd web && npx tsc --noEmit` exits 0
- [ ] `cd web && npx astro check` exits 0 (zero errors, zero warnings beyond pre-existing)
- [ ] `cd web && npm run build` exits 0 when run with `required_permissions: ["all"]` (sandbox-bypassed per `file:.cursor/rules/build-sandbox-caveat.mdc`)
- [ ] Visiting `/connect/_smoke` in `astro dev` (or after `astro build && astro preview`) renders the stub H1 inside `BaseLayout` chrome
- [ ] Commit message documents the resolved versions of the three new packages

## References

- Epic Brief: `file:docs/Epic_Brief_—_A4_Connect_Claude_#302.md` (Open Assumptions: "@astrojs/mdx is compatible with Astro 6 + rolldown-vite")
- Tech Plan: `file:docs/Tech_Plan_—_A4_Connect_Claude_#302.md` — see Critical Constraints ("MDX integration is hard-gated by a smoke test in the first commit") and Implementation Notes ("Smoke-test sequencing (commit 1)")
- Workspace rule (mandatory for build commands): `file:.cursor/rules/build-sandbox-caveat.mdc`
- Existing `astro.config.mjs` (already documents one rolldown-vite incompat — same risk surface): `file:web/astro.config.mjs`
- Existing `BaseLayout.astro` (smoke route imports it unmodified): `file:web/src/layouts/BaseLayout.astro`
- Parent epic: #298 — Astro mini-site
- This A4 ticket: #302 — A4 Doc connecteur Claude page
- Unblocks: T93, T94, T95, T96 (all subsequent commits in the A4 PR)
