# T68 — Vendor Chunks, Analyzer & Third-party Deferral

## Goal

Configure Vite's `manualChunks` so that heavy vendor dependencies (Recharts, cmdk + vaul, @tanstack/react-table, Radix primitives, Supabase client) land in their own chunks — preventing duplication across the lazy route chunks introduced in T67 and keeping the cold cache shareable. Add a bundle analyzer script for before/after evidence. Defer Sentry, PostHog-invisible work, and PWA `registerSW` until after first render via `requestIdleCallback`. Together these changes target a sub-150ms TBT and sub-2.5s LCP on `/` mobile.

## Dependencies

- **T67** (Route-Level Code Splitting) must be merged so the `manualChunks` config groups vendors against real lazy boundaries.

## Scope

### Vite config — `file:vite.config.ts`

Add a `manualChunks` function inside `build.rollupOptions.output`:

```typescript
build: {
  sourcemap: true,
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes("node_modules")) {
          if (id.includes("recharts") || id.includes("d3-")) return "chart-vendor"
          if (id.includes("cmdk") || id.includes("vaul")) return "picker-vendor"
          if (id.includes("@tanstack/react-table") || id.includes("@tanstack/table-core")) return "table-vendor"
          if (id.includes("@radix-ui")) return "radix-vendor"
          if (id.includes("@supabase")) return "supabase-vendor"
          if (id.includes("@sentry")) return "sentry-vendor"
          if (id.includes("posthog")) return "posthog-vendor"
          if (id.includes("embla-carousel")) return "embla-vendor"
          if (id.includes("@dnd-kit")) return "dnd-vendor"
          if (id.includes("react-day-picker") || id.includes("date-fns")) return "calendar-vendor"
        }
      },
    },
  },
},
```

Notes:
- `d3-*` is pulled in by recharts transitively; grouping keeps them together.
- `@radix-ui` is large and shared by most routes → one vendor chunk cached across lazy routes.
- `date-fns` goes with calendar because `react-day-picker` depends on it; if another module needs heavy `date-fns` usage, revisit.

### Analyzer — `file:vite.config.ts` + `file:package.json`

Conditionally load `rollup-plugin-visualizer`:

```typescript
import { visualizer } from "rollup-plugin-visualizer"

// inside defineConfig:
plugins: [
  react(),
  VitePWA({ ... }),
  sentryAuthTokenPlugin,
  process.env.ANALYZE === "true" && visualizer({
    filename: "dist/stats.html",
    gzipSize: true,
    brotliSize: true,
    open: true,
  }),
].filter(Boolean),
```

Add to `package.json`:

```json
{
  "scripts": {
    "build:analyze": "ANALYZE=true vite build"
  },
  "devDependencies": {
    "rollup-plugin-visualizer": "^5.12.0"
  }
}
```

Run `npm install rollup-plugin-visualizer --save-dev` and use the latest version.

### Sentry + SW deferral — `file:src/main.tsx`

Current order (approximate, from exploration):

```tsx
initSentry()                  // sync, pre-render
listenForSwUpdate()           // sync, pre-render
await handleVersionUpgrade()  // async, gates render
createRoot(el).render(<App />)
```

Target:

```tsx
await handleVersionUpgrade()
createRoot(el).render(<App />)

const idle = (cb: () => void) =>
  "requestIdleCallback" in window
    ? (window as any).requestIdleCallback(cb, { timeout: 2000 })
    : setTimeout(cb, 500)

idle(() => {
  initSentry()
  listenForSwUpdate()
})
```

Move `import { initSentry }` and `import { listenForSwUpdate }` out of the module top if the functions rely on side effects at import time. Verify with a cold-load test: error thrown in the first 2 seconds should still reach Sentry once it initializes (Sentry will miss the very earliest errors — this is an acceptable trade-off documented in the plan).

### PWA `registerSW` — `file:src/lib/swReloadOnUpdate.ts`

Change:

```typescript
registerSW({
  immediate: true,
  onRegisteredSW(...) { ... },
  onRegisterError(...) { ... },
})
```

To:

```typescript
registerSW({
  immediate: false,
  onRegisteredSW(...) { ... },
  onRegisterError(...) { ... },
})
```

This means new SW versions install on next navigation instead of immediately. `handleVersionUpgrade` in `main.tsx` still forces a reload on version mismatch — unchanged behavior for users.

### Optional: guard against future regressions

Add a simple eslint rule or CI check that warns if `WorkoutPage` imports `@/components/ui/chart` (which would pull recharts into the main chunk via the transitive graph). Implementation detail: can be a custom eslint rule, a CODEOWNERS note, or an explicit PR-template checklist item. **Include as documentation only** unless it's a quick win during implementation.

## Out of Scope

- Route-level `React.lazy` boundaries → **T67** (prerequisite)
- Supabase query optimizations → **T69**
- Deferring i18n locale loading
- Deferring `react-day-picker/style.css` import from `main.tsx`
- PostHog session replay config changes (not currently enabled)
- Replacing `recharts` with a lighter chart library

## Acceptance Criteria

- [ ] `npm run build:analyze` produces `dist/stats.html` and opens it.
- [ ] Main chunk for `/` (excluding vendors) is < 100 KB gzipped.
- [ ] Vendor chunks are named `chart-vendor`, `picker-vendor`, `table-vendor`, `radix-vendor`, `supabase-vendor`, `sentry-vendor`, `posthog-vendor`, `embla-vendor`, `calendar-vendor` (check with `ls dist/assets/`).
- [ ] `/` initial load does NOT fetch `chart-vendor`, `table-vendor`, or `calendar-vendor`.
- [ ] Lighthouse mobile shows **TBT < 150ms** on `/` (clean incognito profile).
- [ ] Lighthouse mobile shows **LCP < 2.5s** on `/`.
- [ ] Sentry `initSentry()` is called after first render (verified via `console.time` or source inspection).
- [ ] `listenForSwUpdate()` is called after first render.
- [ ] Service worker still registers and activates correctly on install and update (verified via DevTools → Application → Service Workers).
- [ ] `handleVersionUpgrade` behavior unchanged (forced reload on version mismatch still works).
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run build` completes without the `Unexpected early exit` error (note: this ticket adds to build complexity; run with `required_permissions: ["all"]` per workspace rule).

## References

- Epic / issue: [#104](https://github.com/PierreTsia/workout-app/issues/104)
- Tech Plan: `file:docs/Tech_Plan_—_Lighthouse_CLS_LCP_Supabase_#104.md`
- T67 (prerequisite): `file:docs/T67_—_Route-Level_Code_Splitting.md`
- Vite `manualChunks` docs: https://vitejs.dev/guide/build.html#chunking-strategy
- `rollup-plugin-visualizer`: https://github.com/btd/rollup-plugin-visualizer
