# T83 — Astro + Tailwind v4 Scaffold in `web/`

## Goal

Add a self-contained Astro 6 + Tailwind v4 project under `web/` that builds, dev-serves, and stays out of the root ESLint scope. This is the local-only foundation slice of A1: nothing is deployed yet, but `npm run dev` and `npm run build` both work inside `web/`, and the SPA at the repo root remains entirely unaffected.

Addresses **Epic Brief stories 1, 7, 8, 9**.

## Mode

**AFK** — pure scaffolding. No credentials, no dashboard ops, no DNS. An agent or freshly-onboarded engineer can take this from the Tech Plan and merge a PR with the acceptance criteria as a checklist.

## Slice

`web/package.json` → `web/postcss.config.mjs` (Tailwind wired) → `web/astro.config.mjs` → `web/src/layouts/BaseLayout.astro` → `web/src/pages/index.astro` → root `eslint.config.js` ignore → local `npm run build` + `npm run dev` verification

## Dependencies

None.

## Scope

### New files in `web/`


| File                               | Content                                                                                                                                                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/package.json`                 | Astro 6 + `@tailwindcss/postcss` + `tailwindcss` deps; `engines.node >=22.12.0`; scripts `dev`, `build`, `preview`, `astro` |
| `web/.gitignore`                   | Astro defaults: `dist`, `.astro`, `node_modules`, `.env*` |
| `web/tsconfig.json`                | Extends `astro/tsconfigs/strict`. **No reference from root `tsconfig.json`** — root `tsc -b` must continue to ignore `web/`. |
| `web/vercel.json`                  | `{ "github": { "enabled": false } }` — same shape as root `file:vercel.json` |
| `web/astro.config.mjs`             | `defineConfig({ output: 'static', site: 'https://docs.gymlogic.me' })` — Tailwind is wired via PostCSS, not Vite plugin (see [withastro/astro#16542](https://github.com/withastro/astro/issues/16542)) |
| `web/postcss.config.mjs`           | Single plugin entry: `{ plugins: { '@tailwindcss/postcss': {} } }`. Astro picks it up automatically. |
| `web/src/styles/global.css`        | Single line: `@import "tailwindcss";` |
| `web/src/layouts/BaseLayout.astro` | `<head>` block: `<title>`, `<meta name="description">`, `<meta name="robots" content="noindex">`, viewport meta; imports `../styles/global.css` from frontmatter; renders `<slot />` inside `<body>` |
| `web/src/pages/index.astro`        | Imports `BaseLayout`, sets title "GymLogic — Coming soon", renders one `<h1>` with a Tailwind utility class to prove the pipeline works |


### Modified files at root


| File                    | Change                                                                    |
| ----------------------- | ------------------------------------------------------------------------- |
| `file:eslint.config.js` | One line: `globalIgnores(['dist'])` → `globalIgnores(['dist', 'web/**'])` |


### Local verification (manual, in PR description)

```bash
cd web
npm install
npm run dev    # opens localhost:4321 with placeholder + Tailwind class applied
npm run build  # produces web/dist/ with the static site
```

```bash
# from repo root
npm run lint   # passes, does not scan web/
npm run build  # SPA build unaffected
```

## Out of Scope

- Vercel deploy → T84 + T85
- CI YAML changes → T84
- Vercel project provisioning, DNS, secrets, branch protection → T85
- MDX integration / content collections → A4 (#302)
- Sitemap, OG meta, robots.txt (proper) → A6 (#304)
- shadcn primitive replication / nav / footer → A2 (#300)
- ESLint / Prettier inside `web/` → A2

## Acceptance Criteria

- `cd web && npm install && npm run dev` serves the placeholder on `localhost:4321` with the Tailwind utility class visibly applied (e.g., `text-3xl font-bold` renders large bold text)
- `cd web && npm run build` exits 0 and produces `web/dist/index.html`
- `web/dist/index.html` contains `<meta name="robots" content="noindex">` and a `<title>` and `<meta name="description">`
- From repo root, `npm run build` exits 0 with no new warnings or errors compared to `main`
- From repo root, `npm run lint` exits 0 and does not scan any file under `web/` (verify by adding a deliberately ESLint-violating `.ts` file under `web/`, confirming lint passes, then deleting it before commit — or by running `npx eslint --debug web/ 2>&1 | grep ignored`)
- Root `tsc -b` exits 0 unchanged (verify by running before and after the PR's changes)
- `web/package.json` declares `"engines": { "node": ">=22.12.0" }` (Astro 6 minimum)
- `web/vercel.json` contains `{ "github": { "enabled": false } }`

## References

- Epic Brief: `file:docs/Epic_Brief_—_Bootstrap_Astro_Mini-Site_#299.md` (stories 1, 7, 8, 9; in-scope items 1-4 and 10)
- Tech Plan: `file:docs/Tech_Plan_—_Astro_Bootstrap_#299.md` — sections "New Files & Responsibilities", "Component Responsibilities" (web/ subsection), Critical Constraints
- Parent epic: #298
- This ticket: #299 (sub-task A1)

