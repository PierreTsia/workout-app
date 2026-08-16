# T204 — Drawer + Circuits list (nav, not drop)

## Goal

SideDrawer → Bibliothèque → **Circuits** opens `/library/circuits` with GymLogic seed cards. Tap **navigates** to `/library/circuits/:slug` (detail may 404 until T205). **Meet Cindy** picker still instantiates. Stories 1–3, 8–9, 12–13.

## Mode

**AFK** — IA, query filter, and card discriminated props are locked in the Tech Plan.

## Slice

i18n drawer key → SideDrawer link → lazy route → `CircuitCatalogPage` + `CircuitSeedCard.to` → vitest (drawer + list + picker non-regression)

## Dependencies

T207 (docs/ADR). Unblocks T205.

## Scope

### i18n

- `library:drawerCircuits`: EN `Circuits`, FR `Circuits`
- `library:circuitsBrowseTitle`: EN/FR title for the list header
- `library:circuitsBrowseEmpty` / loading / error as needed (mirror exercise browse tone)

### Drawer + router

- Third nested `Link` in `file:src/components/SideDrawer.tsx` → `/library/circuits` (sibling of Programs / Exercises)
- `file:src/router/index.tsx`: lazy `CircuitCatalogPage` under `/library` + `LibraryLayout`
- Leave index `<Navigate to="programs" replace />`
- `file:src/components/SideDrawer.test.tsx`: Circuits `href="/library/circuits"`

### CircuitSeedCard

Discriminated props in `file:src/components/builder/CircuitSeedCard.tsx`:

```ts
type CircuitSeedCardProps = {
  seed: CatalogPreviewRow
  pending?: boolean
  locked?: boolean
} & ({ onSelect: () => void; to?: never } | { to: string; onSelect?: never })
```

- `to` → `Button asChild` + `Link to={to}`. No instantiate.
- Picker keeps `onSelect`. Update existing card tests: picker path unchanged; add a case that `to` renders a link with the href.

Skip cards whose `slug` is null (should not happen on `useBenchmarkSeeds`; still don’t navigate to `/library/circuits/null`).

### List page

- `file:src/pages/library/CircuitCatalogPage.tsx`
- `useBenchmarkSeeds(true)` — do **not** widen the select
- Header + back to `/` (not `/library/programs`)
- Map seeds with `slug` to `<CircuitSeedCard seed={…} to={`/library/circuits/${slug}`} />`
- `vi.mock("@/lib/supabase")` in the page test

### Negative

- `rg` / test: `CircuitCatalogPage` does not import `useInstantiateBenchmarkOnDay` or `instantiateBenchmark`
- Picker test: Circuits tab tap still instantiates (existing `ExerciseLibraryPicker.test.tsx` — must stay green)

## Out of Scope

- Detail body (T205) — a tap may land on a placeholder route that T205 replaces; **or** register `circuits/:slug` in T204 as a stub heading-only page so the link is not a dead router miss. Prefer a minimal slug heading stub so T204 is demoable.
- Story, Rx, history.
- Matrix grouping, search, forks.

## Acceptance Criteria

- [ ] Drawer Library children: Programs, Exercises, **Circuits** → `/library/circuits`
- [ ] `/library/circuits` shows one card per `useBenchmarkSeeds` row (9 when catalog is seeded), using `label` (e.g. `Zeus ⚡`)
- [ ] Card is a link to `/library/circuits/zeus` (slug), not a button that writes
- [ ] `useInstantiateBenchmarkOnDay` is **not** called from the list page
- [ ] Builder picker Circuits tap still instantiates (existing tests green)
- [ ] `/library` still redirects to programs
- [ ] `VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vitest run` on the new/changed tests passes

## References

- Epic Brief stories 1–3, 8–9, 12–13
- Tech Plan `file:docs/Tech_Plan_—_Circuit_Catalog_shelf_#483.md` (card `to`, list hook)
